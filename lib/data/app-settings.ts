import 'server-only';

import { getBigQueryClient } from '@/lib/bigquery/client';

const APP_SETTINGS_TABLE = 'chiesi-committee.chiesi_committee_admin.app_settings';

export const DEFAULT_APP_SETTINGS = {
  committeeResponsibleName: 'Adriana Rodriguez',
  committeeResponsibleEmail: 'a.rodriguezp@chiesi.com',
  reminder1DaysBefore: 10,
  reminder2DaysBefore: 5,
  validationDaysBefore: 3,
} as const;

export type AppSettings = {
  committeeResponsibleName: string;
  committeeResponsibleEmail: string;
  reminder1DaysBefore: number;
  reminder2DaysBefore: number;
  validationDaysBefore: number;
};

let ensureTablePromise: Promise<void> | null = null;

async function ensureAppSettingsTable() {
  if (ensureTablePromise) return ensureTablePromise;
  const client = getBigQueryClient();
  ensureTablePromise = client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`${APP_SETTINGS_TABLE}\` (
        setting_key STRING NOT NULL,
        setting_value STRING NOT NULL,
        description STRING,
        updated_at TIMESTAMP NOT NULL,
        updated_by STRING
      );

      MERGE \`${APP_SETTINGS_TABLE}\` AS target
      USING UNNEST([
        STRUCT('committee_responsible_name' AS setting_key, 'Adriana Rodriguez' AS setting_value, 'Committee responsible name' AS description),
        STRUCT('committee_responsible_email', 'a.rodriguezp@chiesi.com', 'Committee responsible email'),
        STRUCT('planning_reminder_1_days_before', '10', 'Default days before Committee for first reminder'),
        STRUCT('planning_reminder_2_days_before', '5', 'Default days before Committee for second reminder'),
        STRUCT('planning_validation_days_before', '3', 'Default days before Committee for validation')
      ]) AS source
      ON target.setting_key = source.setting_key
      WHEN NOT MATCHED THEN INSERT (setting_key, setting_value, description, updated_at, updated_by)
      VALUES (source.setting_key, source.setting_value, source.description, CURRENT_TIMESTAMP(), 'migration_default');
    `,
  }).then(() => undefined);
  return ensureTablePromise;
}

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 365 ? parsed : fallback;
}

export async function getAppSettings(): Promise<AppSettings> {
  await ensureAppSettingsTable();
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `SELECT setting_key, setting_value FROM \`${APP_SETTINGS_TABLE}\``,
  });
  const values = new Map(
    (rows as Array<Record<string, unknown>>).map((row) => [String(row.setting_key ?? ''), String(row.setting_value ?? '')]),
  );

  return {
    committeeResponsibleName:
      values.get('committee_responsible_name')?.trim() || DEFAULT_APP_SETTINGS.committeeResponsibleName,
    committeeResponsibleEmail:
      values.get('committee_responsible_email')?.trim().toLowerCase() || DEFAULT_APP_SETTINGS.committeeResponsibleEmail,
    reminder1DaysBefore: positiveInteger(
      values.get('planning_reminder_1_days_before'),
      DEFAULT_APP_SETTINGS.reminder1DaysBefore,
    ),
    reminder2DaysBefore: positiveInteger(
      values.get('planning_reminder_2_days_before'),
      DEFAULT_APP_SETTINGS.reminder2DaysBefore,
    ),
    validationDaysBefore: positiveInteger(
      values.get('planning_validation_days_before'),
      DEFAULT_APP_SETTINGS.validationDaysBefore,
    ),
  };
}

export async function updateAppSettings(settings: AppSettings, updatedBy = 'admin_panel') {
  const name = settings.committeeResponsibleName.trim();
  const email = settings.committeeResponsibleEmail.trim().toLowerCase();
  if (!name) throw new Error('Committee responsible name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid committee responsible email.');

  const numericValues = [
    settings.reminder1DaysBefore,
    settings.reminder2DaysBefore,
    settings.validationDaysBefore,
  ];
  if (numericValues.some((value) => !Number.isInteger(value) || value < 0 || value > 365)) {
    throw new Error('Planning offsets must be whole numbers between 0 and 365.');
  }

  await ensureAppSettingsTable();
  const client = getBigQueryClient();
  await client.query({
    query: `
      MERGE \`${APP_SETTINGS_TABLE}\` AS target
      USING UNNEST([
        STRUCT('committee_responsible_name' AS setting_key, @name AS setting_value),
        STRUCT('committee_responsible_email', @email),
        STRUCT('planning_reminder_1_days_before', CAST(@reminder1DaysBefore AS STRING)),
        STRUCT('planning_reminder_2_days_before', CAST(@reminder2DaysBefore AS STRING)),
        STRUCT('planning_validation_days_before', CAST(@validationDaysBefore AS STRING))
      ]) AS source
      ON target.setting_key = source.setting_key
      WHEN MATCHED THEN UPDATE SET
        setting_value = source.setting_value,
        updated_at = CURRENT_TIMESTAMP(),
        updated_by = @updatedBy
      WHEN NOT MATCHED THEN INSERT (setting_key, setting_value, updated_at, updated_by)
      VALUES (source.setting_key, source.setting_value, CURRENT_TIMESTAMP(), @updatedBy)
    `,
    params: {
      name,
      email,
      reminder1DaysBefore: settings.reminder1DaysBefore,
      reminder2DaysBefore: settings.reminder2DaysBefore,
      validationDaysBefore: settings.validationDaysBefore,
      updatedBy,
    },
  });
}
