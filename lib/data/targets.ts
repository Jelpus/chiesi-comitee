import 'server-only';
import { randomUUID } from 'crypto';
import { getBigQueryClient } from '@/lib/bigquery/client';

export type AdminTargetRow = {
  targetId: string;
  revisionNumber: number;
  reportingVersionId: string | null;
  periodMonth: string | null;
  area: string;
  kpiName: string;
  kpiLabel: string | null;
  qtyUnit: string;
  targetValueText: string;
  targetValueNumeric: number | null;
  formFields: string | null;
  isActive: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type UpsertTargetInput = {
  targetId?: string;
  reportingVersionId: string;
  periodMonth: string;
  area: string;
  kpiName: string;
  kpiLabel?: string | null;
  qtyUnit: string;
  targetValueText: string;
  targetValueNumeric: number | null;
  formFields?: string | null;
  isActive: boolean;
  updatedBy?: string;
};

const TARGETS_TABLE = 'chiesi-committee.chiesi_committee_admin.kpi_targets';

let ensureTargetsTablePromise: Promise<void> | null = null;

function isBigQueryUpdateRateLimitError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('job exceeded rate limits') ||
    message.includes('table exceeded quota for table update operations') ||
    message.includes('exceeded quota for table update operations')
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryWithUpdateRateLimitRetry<T>(
  run: () => Promise<T>,
  maxAttempts = 7,
): Promise<T> {
  let attempt = 0;
  let delayMs = 1500;
  while (true) {
    try {
      return await run();
    } catch (error) {
      attempt += 1;
      if (!isBigQueryUpdateRateLimitError(error) || attempt >= maxAttempts) {
        throw error;
      }
      await sleep(delayMs);
      delayMs *= 2;
    }
  }
}

async function ensureTargetsTable() {
  if (!ensureTargetsTablePromise) {
    ensureTargetsTablePromise = (async () => {
      const client = getBigQueryClient();
      await queryWithUpdateRateLimitRetry(() => client.query({
        query: `
          CREATE TABLE IF NOT EXISTS \`${TARGETS_TABLE}\` (
            target_id STRING,
            revision_number INT64,
            is_deleted BOOL,
            reporting_version_id STRING,
            period_month DATE,
            area STRING,
            kpi_name STRING,
            kpi_label STRING,
            qty_unit STRING,
            target_value_text STRING,
            target_value_numeric NUMERIC,
            form_fields STRING,
            is_active BOOL,
            created_at TIMESTAMP,
            created_by STRING,
            updated_at TIMESTAMP,
            updated_by STRING
          )
        `,
      }));
      await queryWithUpdateRateLimitRetry(() => client.query({
        query: `
          ALTER TABLE \`${TARGETS_TABLE}\`
          ADD COLUMN IF NOT EXISTS kpi_label STRING
        `,
      }));
      await queryWithUpdateRateLimitRetry(() => client.query({
        query: `
          ALTER TABLE \`${TARGETS_TABLE}\`
          ADD COLUMN IF NOT EXISTS revision_number INT64
        `,
      }));
      await queryWithUpdateRateLimitRetry(() => client.query({
        query: `
          ALTER TABLE \`${TARGETS_TABLE}\`
          ADD COLUMN IF NOT EXISTS is_deleted BOOL
        `,
      }));
      await queryWithUpdateRateLimitRetry(() => client.query({
        query: `
          ALTER TABLE \`${TARGETS_TABLE}\`
          ADD COLUMN IF NOT EXISTS reporting_version_id STRING
        `,
      }));
      await queryWithUpdateRateLimitRetry(() => client.query({
        query: `
          ALTER TABLE \`${TARGETS_TABLE}\`
          ADD COLUMN IF NOT EXISTS period_month DATE
        `,
      }));
      await queryWithUpdateRateLimitRetry(() => client.query({
        query: `
          ALTER TABLE \`${TARGETS_TABLE}\`
          ADD COLUMN IF NOT EXISTS form_fields STRING
        `,
      }));
    })();
  }
  await ensureTargetsTablePromise;
}

function buildTargetFilters(area?: string, reportingVersionId?: string, periodMonth?: string) {
  const hasArea = Boolean(area && area.trim());
  const hasVersion = Boolean(reportingVersionId && reportingVersionId.trim());
  const hasPeriod = Boolean(periodMonth && periodMonth.trim());
  const whereClauses = ['1 = 1'];
  const params: Record<string, unknown> = {};

  if (hasArea) {
    whereClauses.push('LOWER(TRIM(area)) = LOWER(TRIM(@area))');
    params.area = area;
  }
  if (hasVersion) {
    whereClauses.push('(reporting_version_id = @reportingVersionId OR @reportingVersionId = \'\')');
    params.reportingVersionId = reportingVersionId;
  } else {
    params.reportingVersionId = '';
  }
  if (hasPeriod) {
    whereClauses.push('period_month <= DATE(@periodMonth)');
    params.periodMonth = periodMonth;
  } else {
    params.periodMonth = '2999-12-01';
  }

  return { whereClauses, params };
}

export async function getAdminTargets(
  area?: string,
  reportingVersionId?: string,
  periodMonth?: string,
): Promise<AdminTargetRow[]> {
  await ensureTargetsTable();
  const client = getBigQueryClient();
  const { whereClauses, params } = buildTargetFilters(area, reportingVersionId, periodMonth);

  const [rows] = await client.query({
    query: `
      WITH latest_per_target AS (
        SELECT
          target_id,
          COALESCE(revision_number, 1) AS revision_number,
          COALESCE(is_deleted, FALSE) AS is_deleted,
          reporting_version_id,
          period_month,
          area,
          kpi_name,
          kpi_label,
          qty_unit,
          target_value_text,
          CAST(target_value_numeric AS FLOAT64) AS target_value_numeric,
          form_fields,
          is_active,
          CAST(updated_at AS STRING) AS updated_at,
          updated_by,
          ROW_NUMBER() OVER (
            PARTITION BY target_id
            ORDER BY COALESCE(revision_number, 1) DESC, updated_at DESC, created_at DESC
          ) AS rn_target
        FROM \`${TARGETS_TABLE}\`
        WHERE ${whereClauses.join('\n          AND ')}
      ),
      effective AS (
        SELECT
          target_id,
          revision_number,
          is_deleted,
          reporting_version_id,
          CAST(period_month AS STRING) AS period_month,
          area,
          kpi_name,
          kpi_label,
          qty_unit,
          target_value_text,
          target_value_numeric,
          form_fields,
          is_active,
          updated_at,
          updated_by,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(area)), LOWER(TRIM(kpi_name))
            ORDER BY
              period_month DESC,
              CASE WHEN reporting_version_id = @reportingVersionId THEN 0 ELSE 1 END,
              updated_at DESC
          ) AS rn_effective
        FROM latest_per_target
        WHERE rn_target = 1
          AND is_deleted = FALSE
      )
      SELECT
        target_id,
        revision_number,
        reporting_version_id,
        period_month,
        area,
        kpi_name,
        kpi_label,
        qty_unit,
        target_value_text,
        target_value_numeric,
        form_fields,
        is_active,
        updated_at,
        updated_by
      FROM effective
      WHERE rn_effective = 1
      ORDER BY LOWER(area), LOWER(kpi_name), updated_at DESC
    `,
    params,
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    targetId: String(row.target_id ?? ''),
    revisionNumber: Number(row.revision_number ?? 1),
    reportingVersionId: row.reporting_version_id == null ? null : String(row.reporting_version_id),
    periodMonth: row.period_month == null ? null : String(row.period_month),
    area: String(row.area ?? ''),
    kpiName: String(row.kpi_name ?? ''),
    kpiLabel: row.kpi_label == null ? null : String(row.kpi_label),
    qtyUnit: String(row.qty_unit ?? ''),
    targetValueText: String(row.target_value_text ?? ''),
    targetValueNumeric: row.target_value_numeric == null ? null : Number(row.target_value_numeric),
    formFields: row.form_fields == null ? null : String(row.form_fields),
    isActive: Boolean(row.is_active ?? true),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
    updatedBy: row.updated_by == null ? null : String(row.updated_by),
  }));
}

export async function getAdminTargetAreas(reportingVersionId?: string, periodMonth?: string): Promise<string[]> {
  await ensureTargetsTable();
  const client = getBigQueryClient();
  const { whereClauses, params } = buildTargetFilters(undefined, reportingVersionId, periodMonth);

  const [rows] = await client.query({
    query: `
      WITH latest_per_target AS (
        SELECT
          target_id,
          reporting_version_id,
          period_month,
          area,
          COALESCE(is_deleted, FALSE) AS is_deleted,
          ROW_NUMBER() OVER (
            PARTITION BY target_id
            ORDER BY COALESCE(revision_number, 1) DESC, updated_at DESC, created_at DESC
          ) AS rn_target
        FROM \`${TARGETS_TABLE}\`
        WHERE ${whereClauses.join('\n          AND ')}
          AND area IS NOT NULL
          AND TRIM(area) != ''
      ),
      effective AS (
        SELECT
          area,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(area))
            ORDER BY
              period_month DESC,
              CASE WHEN reporting_version_id = @reportingVersionId THEN 0 ELSE 1 END
          ) AS rn_effective
        FROM latest_per_target
        WHERE rn_target = 1
          AND is_deleted = FALSE
      )
      SELECT DISTINCT area
      FROM effective
      WHERE rn_effective = 1
      ORDER BY area
    `,
    params,
  });

  return (rows as Array<Record<string, unknown>>)
    .map((row) => String(row.area ?? '').trim())
    .filter(Boolean);
}

type LatestTargetRevision = {
  targetId: string;
  revisionNumber: number;
  createdAt: string;
  createdBy: string;
  reportingVersionId: string;
  periodMonth: string;
  area: string;
  kpiName: string;
  kpiLabel: string | null;
  qtyUnit: string;
  targetValueText: string;
  targetValueNumeric: number | null;
  formFields: string | null;
  isActive: boolean;
};

async function getLatestTargetRevisionById(targetId: string): Promise<LatestTargetRevision | null> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        target_id,
        COALESCE(revision_number, 1) AS revision_number,
        CAST(created_at AS STRING) AS created_at,
        created_by,
        reporting_version_id,
        CAST(period_month AS STRING) AS period_month,
        area,
        kpi_name,
        kpi_label,
        qty_unit,
        target_value_text,
        CAST(target_value_numeric AS FLOAT64) AS target_value_numeric,
        form_fields,
        is_active
      FROM \`${TARGETS_TABLE}\`
      WHERE target_id = @targetId
      ORDER BY COALESCE(revision_number, 1) DESC, updated_at DESC, created_at DESC
      LIMIT 1
    `,
    params: { targetId },
  });

  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  return {
    targetId: String(row.target_id ?? ''),
    revisionNumber: Number(row.revision_number ?? 1),
    createdAt: String(row.created_at ?? ''),
    createdBy: String(row.created_by ?? 'system'),
    reportingVersionId: String(row.reporting_version_id ?? ''),
    periodMonth: String(row.period_month ?? ''),
    area: String(row.area ?? ''),
    kpiName: String(row.kpi_name ?? ''),
    kpiLabel: row.kpi_label == null ? null : String(row.kpi_label),
    qtyUnit: String(row.qty_unit ?? ''),
    targetValueText: String(row.target_value_text ?? ''),
    targetValueNumeric: row.target_value_numeric == null ? null : Number(row.target_value_numeric),
    formFields: row.form_fields == null ? null : String(row.form_fields),
    isActive: Boolean(row.is_active ?? true),
  };
}

async function getLatestTargetRevisionByNaturalKey(input: UpsertTargetInput): Promise<LatestTargetRevision | null> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH ranked AS (
        SELECT
          target_id,
          COALESCE(revision_number, 1) AS revision_number,
          COALESCE(is_deleted, FALSE) AS is_deleted,
          CAST(created_at AS STRING) AS created_at,
          created_by,
          reporting_version_id,
          CAST(period_month AS STRING) AS period_month,
          area,
          kpi_name,
          kpi_label,
          qty_unit,
          target_value_text,
          CAST(target_value_numeric AS FLOAT64) AS target_value_numeric,
          form_fields,
          is_active,
          ROW_NUMBER() OVER (
            PARTITION BY target_id
            ORDER BY COALESCE(revision_number, 1) DESC, updated_at DESC, created_at DESC
          ) AS rn
        FROM \`${TARGETS_TABLE}\`
        WHERE reporting_version_id = @reportingVersionId
          AND period_month = DATE(@periodMonth)
          AND LOWER(TRIM(area)) = LOWER(TRIM(@area))
          AND LOWER(TRIM(kpi_name)) = LOWER(TRIM(@kpiName))
      )
      SELECT
        target_id,
        revision_number,
        created_at,
        created_by,
        reporting_version_id,
        period_month,
        area,
        kpi_name,
        kpi_label,
        qty_unit,
        target_value_text,
        target_value_numeric,
        form_fields,
        is_active
      FROM ranked
      WHERE rn = 1
        AND is_deleted = FALSE
      LIMIT 1
    `,
    params: {
      reportingVersionId: input.reportingVersionId,
      periodMonth: input.periodMonth,
      area: input.area,
      kpiName: input.kpiName,
    },
  });

  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  return {
    targetId: String(row.target_id ?? ''),
    revisionNumber: Number(row.revision_number ?? 1),
    createdAt: String(row.created_at ?? ''),
    createdBy: String(row.created_by ?? 'system'),
    reportingVersionId: String(row.reporting_version_id ?? ''),
    periodMonth: String(row.period_month ?? ''),
    area: String(row.area ?? ''),
    kpiName: String(row.kpi_name ?? ''),
    kpiLabel: row.kpi_label == null ? null : String(row.kpi_label),
    qtyUnit: String(row.qty_unit ?? ''),
    targetValueText: String(row.target_value_text ?? ''),
    targetValueNumeric: row.target_value_numeric == null ? null : Number(row.target_value_numeric),
    formFields: row.form_fields == null ? null : String(row.form_fields),
    isActive: Boolean(row.is_active ?? true),
  };
}

async function appendTargetRevision(params: {
  targetId: string;
  revisionNumber: number;
  isDeleted: boolean;
  reportingVersionId: string;
  periodMonth: string;
  area: string;
  kpiName: string;
  kpiLabel: string | null;
  qtyUnit: string;
  targetValueText: string;
  targetValueNumeric: number | null;
  formFields: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedBy: string;
}) {
  const client = getBigQueryClient();
  await queryWithUpdateRateLimitRetry(() => client.query({
    query: `
      INSERT INTO \`${TARGETS_TABLE}\`
      (
        target_id,
        revision_number,
        is_deleted,
        reporting_version_id,
        period_month,
        area,
        kpi_name,
        kpi_label,
        qty_unit,
        target_value_text,
        target_value_numeric,
        form_fields,
        is_active,
        created_at,
        created_by,
        updated_at,
        updated_by
      )
      SELECT
        @targetId,
        @revisionNumber,
        @isDeleted,
        @reportingVersionId,
        DATE(@periodMonth),
        @area,
        @kpiName,
        @kpiLabel,
        @qtyUnit,
        @targetValueText,
        SAFE_CAST(@targetValueNumeric AS NUMERIC),
        @formFields,
        @isActive,
        TIMESTAMP(@createdAt),
        @createdBy,
        CURRENT_TIMESTAMP(),
        @updatedBy
    `,
    params,
    types: {
      targetId: 'STRING',
      revisionNumber: 'INT64',
      isDeleted: 'BOOL',
      reportingVersionId: 'STRING',
      periodMonth: 'STRING',
      area: 'STRING',
      kpiName: 'STRING',
      kpiLabel: 'STRING',
      qtyUnit: 'STRING',
      targetValueText: 'STRING',
      targetValueNumeric: 'NUMERIC',
      formFields: 'STRING',
      isActive: 'BOOL',
      createdAt: 'STRING',
      createdBy: 'STRING',
      updatedBy: 'STRING',
    },
  }));
}

export async function upsertAdminTarget(input: UpsertTargetInput) {
  await ensureTargetsTable();
  const updatedBy = (input.updatedBy ?? 'system').trim() || 'system';
  const targetId = (input.targetId ?? '').trim();

  if (targetId) {
    const latest = await getLatestTargetRevisionById(targetId);
    if (!latest) throw new Error(`Target not found: ${targetId}`);

    await appendTargetRevision({
      targetId: latest.targetId,
      revisionNumber: latest.revisionNumber + 1,
      isDeleted: false,
      reportingVersionId: input.reportingVersionId,
      periodMonth: input.periodMonth,
      area: input.area,
      kpiName: input.kpiName,
      kpiLabel: input.kpiLabel ?? latest.kpiLabel ?? null,
      qtyUnit: input.qtyUnit,
      targetValueText: input.targetValueText,
      targetValueNumeric: input.targetValueNumeric,
      formFields: input.formFields ?? latest.formFields ?? null,
      isActive: input.isActive,
      createdAt: latest.createdAt || new Date().toISOString(),
      createdBy: latest.createdBy || updatedBy,
      updatedBy,
    });
    return { ok: true as const, targetId };
  }

  const existing = await getLatestTargetRevisionByNaturalKey(input);
  if (existing) {
    await appendTargetRevision({
      targetId: existing.targetId,
      revisionNumber: existing.revisionNumber + 1,
      isDeleted: false,
      reportingVersionId: input.reportingVersionId,
      periodMonth: input.periodMonth,
      area: input.area,
      kpiName: input.kpiName,
      kpiLabel: input.kpiLabel ?? existing.kpiLabel ?? null,
      qtyUnit: input.qtyUnit,
      targetValueText: input.targetValueText,
      targetValueNumeric: input.targetValueNumeric,
      formFields: input.formFields ?? existing.formFields ?? null,
      isActive: input.isActive,
      createdAt: existing.createdAt || new Date().toISOString(),
      createdBy: existing.createdBy || updatedBy,
      updatedBy,
    });
    return { ok: true as const, targetId: existing.targetId };
  }

  const newTargetId = randomUUID();
  await appendTargetRevision({
    targetId: newTargetId,
    revisionNumber: 1,
    isDeleted: false,
    reportingVersionId: input.reportingVersionId,
    periodMonth: input.periodMonth,
    area: input.area,
    kpiName: input.kpiName,
    kpiLabel: input.kpiLabel ?? null,
    qtyUnit: input.qtyUnit,
    targetValueText: input.targetValueText,
    targetValueNumeric: input.targetValueNumeric,
    formFields: input.formFields ?? null,
    isActive: input.isActive,
    createdAt: new Date().toISOString(),
    createdBy: updatedBy,
    updatedBy,
  });

  return { ok: true as const, targetId: newTargetId };
}

export async function deleteAdminTarget(targetId: string) {
  await ensureTargetsTable();
  const latest = await getLatestTargetRevisionById(targetId);
  if (!latest) return { ok: true as const };

  await appendTargetRevision({
    targetId: latest.targetId,
    revisionNumber: latest.revisionNumber + 1,
    isDeleted: true,
    reportingVersionId: latest.reportingVersionId,
    periodMonth: latest.periodMonth,
    area: latest.area,
    kpiName: latest.kpiName,
    kpiLabel: latest.kpiLabel,
    qtyUnit: latest.qtyUnit,
    targetValueText: latest.targetValueText,
    targetValueNumeric: latest.targetValueNumeric,
    formFields: latest.formFields,
    isActive: false,
    createdAt: latest.createdAt || new Date().toISOString(),
    createdBy: latest.createdBy || 'system',
    updatedBy: latest.createdBy || 'system',
  });

  return { ok: true as const };
}
