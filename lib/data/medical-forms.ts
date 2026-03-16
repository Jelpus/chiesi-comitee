import 'server-only';
import { randomUUID } from 'crypto';
import { getBigQueryClient } from '@/lib/bigquery/client';
import type { MedicalInputRow, MedicalInputUpsert } from '@/lib/data/medical-forms-schema';

const MEDICAL_INPUTS_TABLE = 'chiesi-committee.chiesi_committee_stg.stg_medical_inputs';

let ensureTablePromise: Promise<void> | null = null;

function toNullableNumber(value: string | number | null | undefined) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized.replace(/[$,%\s]/g, '').replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

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

async function ensureMedicalInputsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      const client = getBigQueryClient();
      await queryWithUpdateRateLimitRetry(() =>
        client.query({
          query: `
          CREATE TABLE IF NOT EXISTS \`${MEDICAL_INPUTS_TABLE}\` (
            input_id STRING,
            period_month DATE,
            source_as_of_month DATE,
            kpi_name STRING,
            result_value_numeric NUMERIC,
            result_value_text STRING,
            comment STRING,
            reported_by STRING,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
          )
        `,
        }),
      );
    })();
  }
  await ensureTablePromise;
}

export async function getMedicalMonthlyInputs(periodMonth?: string): Promise<MedicalInputRow[]> {
  await ensureMedicalInputsTable();
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH latest_period AS (
        SELECT CAST(MAX(period_month) AS STRING) AS latest_period_month
        FROM \`${MEDICAL_INPUTS_TABLE}\`
      )
      SELECT
        input_id,
        CAST(period_month AS STRING) AS period_month,
        CAST(source_as_of_month AS STRING) AS source_as_of_month,
        kpi_name,
        CAST(result_value_numeric AS FLOAT64) AS result_value_numeric,
        result_value_text,
        comment,
        reported_by,
        CAST(updated_at AS STRING) AS updated_at
      FROM \`${MEDICAL_INPUTS_TABLE}\`
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
    resultValueNumeric: toNullableNumber(row.result_value_numeric as number | null),
    resultValueText: String(row.result_value_text ?? ''),
    comment: String(row.comment ?? ''),
    reportedBy: row.reported_by == null ? null : String(row.reported_by),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
  }));
}

export async function saveMedicalMonthlyInputs(input: {
  periodMonth: string;
  sourceAsOfMonth: string;
  reportedBy: string;
  rows: MedicalInputUpsert[];
}) {
  await ensureMedicalInputsTable();
  const client = getBigQueryClient();
  const periodMonth = input.periodMonth.trim();
  const sourceAsOfMonth = input.sourceAsOfMonth.trim() || periodMonth;
  if (!periodMonth) throw new Error('Period month is required.');
  const reportedBy = input.reportedBy.trim() || 'anonymous';
  const rows = input.rows.filter((item) => item.kpiName.trim().length > 0);
  if (rows.length === 0) throw new Error('At least one KPI is required.');

  const rowsPayload = rows.map((row) => ({
    inputId: randomUUID(),
    kpiName: row.kpiName.trim(),
    resultValueNumeric: toNullableNumber(row.resultValueNumeric),
    resultValueText: row.resultValueText?.trim() ?? '',
    comment: row.comment?.trim() ?? '',
  }));
  const rowsJson = JSON.stringify(rowsPayload);

  await queryWithUpdateRateLimitRetry(() =>
    client.query({
      query: `
        MERGE \`${MEDICAL_INPUTS_TABLE}\` AS target
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
              SAFE_CAST(JSON_VALUE(item, '$.resultValueNumeric') AS NUMERIC) AS result_value_numeric,
              COALESCE(JSON_VALUE(item, '$.resultValueText'), '') AS result_value_text,
              COALESCE(JSON_VALUE(item, '$.comment'), '') AS comment
            FROM payload, UNNEST(rows_json) AS item
          )
          SELECT * FROM source_rows
        ) AS source_rows
        ON target.period_month = source_rows.period_month
          AND LOWER(TRIM(target.kpi_name)) = LOWER(TRIM(source_rows.kpi_name))
        WHEN MATCHED AND (
          IFNULL(target.result_value_numeric, -999999999) != IFNULL(source_rows.result_value_numeric, -999999999)
          OR IFNULL(target.result_value_text, '') != IFNULL(source_rows.result_value_text, '')
          OR IFNULL(target.comment, '') != IFNULL(source_rows.comment, '')
          OR IFNULL(target.reported_by, '') != IFNULL(@reportedBy, '')
          OR IFNULL(CAST(target.source_as_of_month AS STRING), '') != IFNULL(@sourceAsOfMonth, '')
        ) THEN
          UPDATE SET
            source_as_of_month = source_rows.source_as_of_month,
            result_value_numeric = source_rows.result_value_numeric,
            result_value_text = source_rows.result_value_text,
            comment = source_rows.comment,
            reported_by = @reportedBy,
            updated_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN
          INSERT (
            input_id, period_month, source_as_of_month, kpi_name, result_value_numeric,
            result_value_text, comment, reported_by, created_at, updated_at
          )
          VALUES (
            source_rows.input_id, source_rows.period_month, source_rows.source_as_of_month, source_rows.kpi_name,
            source_rows.result_value_numeric, source_rows.result_value_text, source_rows.comment, @reportedBy,
            CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
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
    }),
  );

  return { ok: true as const, saved: rows.length };
}
