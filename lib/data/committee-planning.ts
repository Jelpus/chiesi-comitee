import 'server-only';

import { randomUUID } from 'crypto';
import { getBigQueryClient } from '@/lib/bigquery/client';

const PLANNING_TABLE = 'chiesi-committee.chiesi_committee_admin.committee_planning';
const AUTOMATION_LOG_TABLE = 'chiesi-committee.chiesi_committee_admin.committee_automation_log';

export type PlanningEventType = 'open_request_info' | 'reminder_1' | 'reminder_2' | 'validation';

export type CommitteePlan = {
  planningId: string;
  periodMonth: string;
  committeeDate: string;
  requestInfoDate: string;
  reminder1Date: string;
  reminder2Date: string;
  validationDate: string;
  reportingVersionId: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  events: Partial<Record<PlanningEventType, { scheduledDate: string; status: string; processedAt: string | null; message: string | null }>>;
};

export type SaveCommitteePlanInput = Omit<
  CommitteePlan,
  'planningId' | 'requestInfoDate' | 'reportingVersionId' | 'createdAt' | 'updatedAt' | 'events'
> & { planningId?: string };

let ensureTablesPromise: Promise<void> | null = null;

export async function ensureCommitteePlanningTables() {
  if (ensureTablesPromise) return ensureTablesPromise;
  const client = getBigQueryClient();
  ensureTablesPromise = client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`${PLANNING_TABLE}\` (
        planning_id STRING NOT NULL,
        period_month DATE NOT NULL,
        committee_date DATE NOT NULL,
        request_info_date DATE NOT NULL,
        reminder_1_date DATE NOT NULL,
        reminder_2_date DATE NOT NULL,
        validation_date DATE NOT NULL,
        reporting_version_id STRING,
        is_active BOOL NOT NULL,
        notes STRING,
        created_at TIMESTAMP NOT NULL,
        created_by STRING,
        updated_at TIMESTAMP NOT NULL,
        updated_by STRING
      );

      CREATE TABLE IF NOT EXISTS \`${AUTOMATION_LOG_TABLE}\` (
        planning_id STRING NOT NULL,
        event_type STRING NOT NULL,
        scheduled_date DATE NOT NULL,
        status STRING NOT NULL,
        processed_at TIMESTAMP NOT NULL,
        message STRING,
        reporting_version_id STRING
      );
    `,
  }).then(() => undefined);
  return ensureTablesPromise;
}

function primitive(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    return String((value as { value: unknown }).value ?? '');
  }
  return String(value);
}

function validateDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD.`);
}

export async function getCommitteePlans(): Promise<CommitteePlan[]> {
  await ensureCommitteePlanningTables();
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH latest_events AS (
        SELECT planning_id, event_type, scheduled_date, status, processed_at, message
        FROM \`${AUTOMATION_LOG_TABLE}\`
        QUALIFY ROW_NUMBER() OVER (PARTITION BY planning_id, event_type ORDER BY processed_at DESC) = 1
      ), event_map AS (
        SELECT planning_id, TO_JSON_STRING(ARRAY_AGG(STRUCT(event_type, CAST(scheduled_date AS STRING) AS scheduled_date, status, CAST(processed_at AS STRING) AS processed_at, message))) AS events_json
        FROM latest_events
        GROUP BY planning_id
      )
      SELECT
        p.planning_id,
        CAST(p.period_month AS STRING) AS period_month,
        CAST(p.committee_date AS STRING) AS committee_date,
        CAST(p.request_info_date AS STRING) AS request_info_date,
        CAST(p.reminder_1_date AS STRING) AS reminder_1_date,
        CAST(p.reminder_2_date AS STRING) AS reminder_2_date,
        CAST(p.validation_date AS STRING) AS validation_date,
        p.reporting_version_id,
        p.is_active,
        p.notes,
        CAST(p.created_at AS STRING) AS created_at,
        CAST(p.updated_at AS STRING) AS updated_at,
        e.events_json
      FROM \`${PLANNING_TABLE}\` p
      LEFT JOIN event_map e USING (planning_id)
      ORDER BY p.committee_date DESC
    `,
  });

  return (rows as Array<Record<string, unknown>>).map((row) => {
    const events: CommitteePlan['events'] = {};
    try {
      const parsed = JSON.parse(primitive(row.events_json) || '[]') as Array<Record<string, unknown>>;
      for (const event of parsed) {
        const type = primitive(event.event_type) as PlanningEventType;
        events[type] = {
          scheduledDate: primitive(event.scheduled_date),
          status: primitive(event.status),
          processedAt: primitive(event.processed_at) || null,
          message: primitive(event.message) || null,
        };
      }
    } catch {
      // A malformed historical log must not prevent Planning from loading.
    }
    return {
      planningId: primitive(row.planning_id),
      periodMonth: primitive(row.period_month).slice(0, 7),
      committeeDate: primitive(row.committee_date),
      requestInfoDate: primitive(row.request_info_date),
      reminder1Date: primitive(row.reminder_1_date),
      reminder2Date: primitive(row.reminder_2_date),
      validationDate: primitive(row.validation_date),
      reportingVersionId: primitive(row.reporting_version_id) || null,
      isActive: Boolean(row.is_active),
      notes: primitive(row.notes) || null,
      createdAt: primitive(row.created_at),
      updatedAt: primitive(row.updated_at),
      events,
    };
  });
}

export async function getCommitteeValidationDate(periodMonth: string) {
  const normalizedPeriod = periodMonth.trim().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(normalizedPeriod)) return null;
  await ensureCommitteePlanningTables();
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT CAST(validation_date AS STRING) AS validation_date
      FROM \`${PLANNING_TABLE}\`
      WHERE period_month = DATE(@periodMonth)
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    params: { periodMonth: `${normalizedPeriod}-01` },
  });
  const value = primitive((rows as Array<Record<string, unknown>>)[0]?.validation_date);
  return value || null;
}

export async function saveCommitteePlan(input: SaveCommitteePlanInput, updatedBy = 'admin_panel') {
  const planningId = input.planningId?.trim() || `cp_${randomUUID()}`;
  const periodMonth = input.periodMonth.trim();
  if (!/^\d{4}-\d{2}$/.test(periodMonth)) throw new Error('Period must use YYYY-MM.');
  const requestInfoDate = `${periodMonth}-01`;
  validateDate(input.committeeDate, 'Committee date');
  validateDate(input.reminder1Date, 'Reminder 1 date');
  validateDate(input.reminder2Date, 'Reminder 2 date');
  validateDate(input.validationDate, 'Validation date');

  const timeline = [requestInfoDate, input.reminder1Date, input.reminder2Date, input.validationDate, input.committeeDate];
  if (timeline.some((date, index) => index > 0 && date < timeline[index - 1])) {
    throw new Error('Dates must follow this order: Request Info, Reminder 1, Reminder 2, Validation, Committee.');
  }

  await ensureCommitteePlanningTables();
  const client = getBigQueryClient();
  const [duplicateRows] = await client.query({
    query: `
      SELECT planning_id
      FROM \`${PLANNING_TABLE}\`
      WHERE period_month = DATE(@periodMonth)
        AND planning_id != @planningId
      LIMIT 1
    `,
    params: { planningId, periodMonth: `${periodMonth}-01` },
  });
  if (duplicateRows.length > 0) {
    throw new Error(`A Committee plan already exists for period ${periodMonth}. Edit the existing plan instead.`);
  }

  await client.query({
    query: `
      MERGE \`${PLANNING_TABLE}\` AS target
      USING (SELECT @planningId AS planning_id) AS source
      ON target.planning_id = source.planning_id
      WHEN MATCHED THEN UPDATE SET
        period_month = DATE(@periodMonth),
        committee_date = DATE(@committeeDate),
        request_info_date = DATE(@requestInfoDate),
        reminder_1_date = DATE(@reminder1Date),
        reminder_2_date = DATE(@reminder2Date),
        validation_date = DATE(@validationDate),
        is_active = @isActive,
        notes = NULLIF(@notes, ''),
        updated_at = CURRENT_TIMESTAMP(),
        updated_by = @updatedBy
      WHEN NOT MATCHED THEN INSERT (
        planning_id, period_month, committee_date, request_info_date, reminder_1_date, reminder_2_date,
        validation_date, is_active, notes, created_at, created_by, updated_at, updated_by
      ) VALUES (
        @planningId, DATE(@periodMonth), DATE(@committeeDate), DATE(@requestInfoDate), DATE(@reminder1Date),
        DATE(@reminder2Date), DATE(@validationDate), @isActive, NULLIF(@notes, ''), CURRENT_TIMESTAMP(),
        @updatedBy, CURRENT_TIMESTAMP(), @updatedBy
      )
    `,
    params: {
      planningId,
      periodMonth: `${periodMonth}-01`,
      committeeDate: input.committeeDate,
      requestInfoDate,
      reminder1Date: input.reminder1Date,
      reminder2Date: input.reminder2Date,
      validationDate: input.validationDate,
      isActive: input.isActive,
      notes: input.notes?.trim() ?? '',
      updatedBy,
    },
  });
  return { planningId };
}

export async function setCommitteePlanActive(planningId: string, isActive: boolean) {
  await ensureCommitteePlanningTables();
  const client = getBigQueryClient();
  await client.query({
    query: `
      UPDATE \`${PLANNING_TABLE}\`
      SET is_active = @isActive, updated_at = CURRENT_TIMESTAMP(), updated_by = 'admin_panel'
      WHERE planning_id = @planningId
    `,
    params: { planningId: planningId.trim(), isActive },
  });
}

export async function attachReportingVersion(planningId: string, reportingVersionId: string) {
  await ensureCommitteePlanningTables();
  const client = getBigQueryClient();
  await client.query({
    query: `
      UPDATE \`${PLANNING_TABLE}\`
      SET reporting_version_id = @reportingVersionId, updated_at = CURRENT_TIMESTAMP(), updated_by = 'planning_automation'
      WHERE planning_id = @planningId
    `,
    params: { planningId, reportingVersionId },
  });
}

export async function hasSuccessfulPlanningEvent(planningId: string, eventType: PlanningEventType, scheduledDate: string) {
  await ensureCommitteePlanningTables();
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT COUNT(*) AS total
      FROM \`${AUTOMATION_LOG_TABLE}\`
      WHERE planning_id = @planningId
        AND event_type = @eventType
        AND scheduled_date = DATE(@scheduledDate)
        AND status = 'succeeded'
    `,
    params: { planningId, eventType, scheduledDate },
  });
  return Number((rows as Array<Record<string, unknown>>)[0]?.total ?? 0) > 0;
}

export async function logPlanningEvent(input: {
  planningId: string;
  eventType: PlanningEventType;
  scheduledDate: string;
  status: 'succeeded' | 'failed';
  message: string;
  reportingVersionId?: string | null;
}) {
  await ensureCommitteePlanningTables();
  const client = getBigQueryClient();
  await client.query({
    query: `
      INSERT INTO \`${AUTOMATION_LOG_TABLE}\`
        (planning_id, event_type, scheduled_date, status, processed_at, message, reporting_version_id)
      VALUES
        (@planningId, @eventType, DATE(@scheduledDate), @status, CURRENT_TIMESTAMP(), @message, NULLIF(@reportingVersionId, ''))
    `,
    params: { ...input, reportingVersionId: input.reportingVersionId ?? '' },
  });
}
