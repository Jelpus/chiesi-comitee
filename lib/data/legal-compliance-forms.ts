import 'server-only';
import { randomUUID } from 'crypto';
import { getBigQueryClient } from '@/lib/bigquery/client';
import type {
  LegalComplianceKpiInput,
  LegalComplianceMonthlyInputRow,
} from '@/lib/data/legal-compliance-forms-schema';

const LEGAL_INPUTS_TABLE = 'chiesi-committee.chiesi_committee_stg.stg_legal_compliance_inputs';

let ensureTablePromise: Promise<void> | null = null;

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
  maxAttempts = 6,
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

function toNullableNumber(value: string | number | null | undefined) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized.replace(/[$,%\s]/g, '').replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

async function ensureLegalInputsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      const client = getBigQueryClient();
      await queryWithUpdateRateLimitRetry(() => client.query({
        query: `
          CREATE TABLE IF NOT EXISTS \`${LEGAL_INPUTS_TABLE}\` (
            input_id STRING,
            period_month DATE,
            source_as_of_month DATE,
            kpi_name STRING,
            objective_count NUMERIC,
            current_count NUMERIC,
            active_count NUMERIC,
            additional_amount_mxn NUMERIC,
            comment STRING,
            reported_by STRING,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
          )
        `,
      }));
      await queryWithUpdateRateLimitRetry(() => client.query({
        query: `
          ALTER TABLE \`${LEGAL_INPUTS_TABLE}\`
          ADD COLUMN IF NOT EXISTS objective_count NUMERIC
        `,
      }));
      await queryWithUpdateRateLimitRetry(() => client.query({
        query: `
          ALTER TABLE \`${LEGAL_INPUTS_TABLE}\`
          ADD COLUMN IF NOT EXISTS current_count NUMERIC
        `,
      }));
      await queryWithUpdateRateLimitRetry(() => client.query({
        query: `
          ALTER TABLE \`${LEGAL_INPUTS_TABLE}\`
          ADD COLUMN IF NOT EXISTS active_count NUMERIC
        `,
      }));
      await queryWithUpdateRateLimitRetry(() => client.query({
        query: `
          ALTER TABLE \`${LEGAL_INPUTS_TABLE}\`
          ADD COLUMN IF NOT EXISTS additional_amount_mxn NUMERIC
        `,
      }));
      await queryWithUpdateRateLimitRetry(() => client.query({
        query: `
          ALTER TABLE \`${LEGAL_INPUTS_TABLE}\`
          ADD COLUMN IF NOT EXISTS comment STRING
        `,
      }));
    })();
  }
  await ensureTablePromise;
}

export async function getLegalComplianceMonthlyInputs(
  periodMonth?: string,
): Promise<LegalComplianceMonthlyInputRow[]> {
  await ensureLegalInputsTable();
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH latest_period AS (
        SELECT CAST(MAX(period_month) AS STRING) AS latest_period_month
        FROM \`${LEGAL_INPUTS_TABLE}\`
      )
      SELECT
        input_id,
        CAST(period_month AS STRING) AS period_month,
        CAST(source_as_of_month AS STRING) AS source_as_of_month,
        kpi_name,
        CAST(objective_count AS FLOAT64) AS objective_count,
        CAST(current_count AS FLOAT64) AS current_count,
        CAST(active_count AS FLOAT64) AS active_count,
        CAST(additional_amount_mxn AS FLOAT64) AS additional_amount_mxn,
        comment,
        reported_by,
        CAST(updated_at AS STRING) AS updated_at
      FROM \`${LEGAL_INPUTS_TABLE}\`
      WHERE period_month = DATE(COALESCE(NULLIF(@periodMonth, ''), (SELECT latest_period_month FROM latest_period)))
      ORDER BY kpi_name
    `,
    params: { periodMonth: periodMonth ?? '' },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    inputId: String(row.input_id ?? ''),
    periodMonth: String(row.period_month ?? ''),
    sourceAsOfMonth: String(row.source_as_of_month ?? ''),
    kpiName: String(row.kpi_name ?? ''),
    objectiveCount:
      toNullableNumber(row.objective_count as number | null),
    currentCount:
      toNullableNumber(row.current_count as number | null),
    activeCount:
      toNullableNumber(row.active_count as number | null),
    additionalAmountMxn: toNullableNumber(row.additional_amount_mxn as number | null),
    comment: String(row.comment ?? ''),
    reportedBy: row.reported_by == null ? null : String(row.reported_by),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
  }));
}

export async function saveLegalComplianceMonthlyInputs(input: {
  periodMonth: string;
  sourceAsOfMonth: string;
  reportedBy: string;
  kpis: LegalComplianceKpiInput[];
}) {
  await ensureLegalInputsTable();
  const client = getBigQueryClient();
  const periodMonth = input.periodMonth.trim();
  const sourceAsOfMonth = input.sourceAsOfMonth.trim() || periodMonth;
  if (!periodMonth) throw new Error('Period month is required.');
  const reportedBy = input.reportedBy.trim() || 'anonymous';
  const kpis = input.kpis.filter((item) => item.kpiName.trim().length > 0);
  if (kpis.length === 0) throw new Error('At least one KPI is required.');

  const kpisPayload = kpis.map((row) => ({
    inputId: randomUUID(),
    kpiName: row.kpiName.trim(),
    objectiveCount: toNullableNumber(row.objectiveCount),
    currentCount: toNullableNumber(row.currentCount),
    activeCount: toNullableNumber(row.activeCount),
    additionalAmountMxn: toNullableNumber(row.additionalAmountMxn),
    comment: row.comment?.trim() ?? '',
  }));
  const rowsJson = JSON.stringify(kpisPayload);

  await queryWithUpdateRateLimitRetry(() => client.query({
    query: `
        MERGE \`${LEGAL_INPUTS_TABLE}\` AS target
        USING (
          WITH payload AS (
            SELECT JSON_QUERY_ARRAY(@rowsJson) AS rows_json
          ),
          source_rows AS (
            SELECT
              JSON_VALUE(item, '$.inputId') AS input_id,
              DATE(@periodMonth) AS period_month,
              DATE(@sourceAsOfMonth) AS source_as_of_month,
              JSON_VALUE(item, '$.kpiName') AS kpi_name,
              SAFE_CAST(JSON_VALUE(item, '$.objectiveCount') AS NUMERIC) AS objective_count,
              SAFE_CAST(JSON_VALUE(item, '$.currentCount') AS NUMERIC) AS current_count,
              SAFE_CAST(JSON_VALUE(item, '$.activeCount') AS NUMERIC) AS active_count,
              SAFE_CAST(JSON_VALUE(item, '$.additionalAmountMxn') AS NUMERIC) AS additional_amount_mxn,
              COALESCE(JSON_VALUE(item, '$.comment'), '') AS comment
            FROM payload, UNNEST(rows_json) AS item
          )
          SELECT * FROM source_rows
        ) AS source_rows
        ON target.period_month = source_rows.period_month
           AND LOWER(TRIM(target.kpi_name)) = LOWER(TRIM(source_rows.kpi_name))
        WHEN MATCHED AND (
          IFNULL(target.objective_count, -999999999) != IFNULL(source_rows.objective_count, -999999999)
          OR IFNULL(target.current_count, -999999999) != IFNULL(source_rows.current_count, -999999999)
          OR IFNULL(target.active_count, -999999999) != IFNULL(source_rows.active_count, -999999999)
          OR IFNULL(target.additional_amount_mxn, -999999999) != IFNULL(source_rows.additional_amount_mxn, -999999999)
          OR IFNULL(target.comment, '') != IFNULL(source_rows.comment, '')
          OR IFNULL(target.reported_by, '') != IFNULL(@reportedBy, '')
          OR IFNULL(CAST(target.source_as_of_month AS STRING), '') != IFNULL(@sourceAsOfMonth, '')
        ) THEN
          UPDATE SET
            source_as_of_month = source_rows.source_as_of_month,
            objective_count = source_rows.objective_count,
            current_count = source_rows.current_count,
            active_count = source_rows.active_count,
            additional_amount_mxn = source_rows.additional_amount_mxn,
            comment = source_rows.comment,
            reported_by = @reportedBy,
            updated_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN
          INSERT (
            input_id, period_month, source_as_of_month, kpi_name, objective_count, current_count,
            active_count, additional_amount_mxn, comment, reported_by, created_at, updated_at
          )
          VALUES (
            source_rows.input_id, source_rows.period_month, source_rows.source_as_of_month, source_rows.kpi_name,
            source_rows.objective_count, source_rows.current_count, source_rows.active_count, source_rows.additional_amount_mxn,
            source_rows.comment, @reportedBy, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
          )
      `,
    params: {
      periodMonth,
      sourceAsOfMonth,
      reportedBy,
      rowsJson,
    },
    types: {
      periodMonth: 'STRING',
      sourceAsOfMonth: 'STRING',
      reportedBy: 'STRING',
      rowsJson: 'STRING',
    },
  }));

  return { ok: true as const, saved: kpis.length };
}
