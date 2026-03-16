import 'server-only';
import { randomUUID } from 'crypto';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { type RaMonthlyInputRow, type RaTopicInput } from '@/lib/data/ra-forms-schema';

const RA_INPUTS_TABLE = 'chiesi-committee.chiesi_committee_stg.stg_ra_quality_fv_inputs';

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

function toNullableInt(value: string | number | null | undefined) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized.replace(/[^0-9-]/g, ''));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

async function ensureRaInputsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      const client = getBigQueryClient();
      await queryWithUpdateRateLimitRetry(() => client.query({
        query: `
          CREATE TABLE IF NOT EXISTS \`${RA_INPUTS_TABLE}\` (
            input_id STRING,
            period_month DATE,
            source_as_of_month DATE,
            topic STRING,
            target_label STRING,
            result_summary STRING,
            on_time_count INT64,
            late_count INT64,
            pending_count INT64,
            active_count INT64,
            overdue_count INT64,
            ytd_count INT64,
            comment STRING,
            reported_by STRING,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
          )
        `,
      }));
    })();
  }
  await ensureTablePromise;
}

export async function getRaMonthlyInputs(periodMonth?: string): Promise<RaMonthlyInputRow[]> {
  await ensureRaInputsTable();
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH latest_period AS (
        SELECT
          CAST(MAX(period_month) AS STRING) AS latest_period_month
        FROM \`${RA_INPUTS_TABLE}\`
      )
      SELECT
        input_id,
        CAST(period_month AS STRING) AS period_month,
        CAST(source_as_of_month AS STRING) AS source_as_of_month,
        topic,
        target_label,
        result_summary,
        on_time_count,
        late_count,
        pending_count,
        active_count,
        overdue_count,
        ytd_count,
        comment,
        reported_by,
        CAST(updated_at AS STRING) AS updated_at
      FROM \`${RA_INPUTS_TABLE}\`
      WHERE period_month = DATE(COALESCE(NULLIF(@periodMonth, ''), (SELECT latest_period_month FROM latest_period)))
      ORDER BY topic
    `,
    params: {
      periodMonth: periodMonth ?? '',
    },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    inputId: String(row.input_id ?? ''),
    periodMonth: String(row.period_month ?? ''),
    sourceAsOfMonth: String(row.source_as_of_month ?? ''),
    topic: String(row.topic ?? ''),
    targetLabel: String(row.target_label ?? ''),
    resultSummary: String(row.result_summary ?? ''),
    onTimeCount: toNullableInt(row.on_time_count as number | null),
    lateCount: toNullableInt(row.late_count as number | null),
    pendingCount: toNullableInt(row.pending_count as number | null),
    activeCount: toNullableInt(row.active_count as number | null),
    overdueCount: toNullableInt(row.overdue_count as number | null),
    ytdCount: toNullableInt(row.ytd_count as number | null),
    comment: String(row.comment ?? ''),
    reportedBy: row.reported_by == null ? null : String(row.reported_by),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
  }));
}

export async function saveRaMonthlyInputs(input: {
  periodMonth: string;
  sourceAsOfMonth: string;
  reportedBy: string;
  topics: RaTopicInput[];
}) {
  await ensureRaInputsTable();
  const client = getBigQueryClient();
  const periodMonth = (input.periodMonth ?? '').trim();
  const sourceAsOfMonth = (input.sourceAsOfMonth ?? '').trim() || periodMonth;
  if (!periodMonth) {
    throw new Error('Period month is required.');
  }

  const reportedBy = (input.reportedBy ?? '').trim() || 'anonymous';
  const topics = input.topics.filter((item) => (item.topic ?? '').trim().length > 0);
  if (topics.length === 0) {
    throw new Error('At least one topic is required.');
  }

  const topicsPayload = topics.map((row) => ({
    inputId: randomUUID(),
    topic: row.topic.trim(),
    targetLabel: row.targetLabel?.trim() ?? '',
    resultSummary: row.resultSummary?.trim() ?? '',
    onTimeCount: toNullableInt(row.onTimeCount),
    lateCount: toNullableInt(row.lateCount),
    pendingCount: toNullableInt(row.pendingCount),
    activeCount: toNullableInt(row.activeCount),
    overdueCount: toNullableInt(row.overdueCount),
    ytdCount: toNullableInt(row.ytdCount),
    comment: row.comment?.trim() ?? '',
  }));
  const rowsJson = JSON.stringify(topicsPayload);

  await queryWithUpdateRateLimitRetry(() =>
    client.query({
      query: `
        MERGE \`${RA_INPUTS_TABLE}\` AS target
        USING (
          WITH payload AS (
            SELECT JSON_QUERY_ARRAY(@rowsJson) AS rows_json
          ),
          source_rows AS (
            SELECT
              JSON_VALUE(item, '$.inputId') AS input_id,
              DATE(@periodMonth) AS period_month,
              DATE(@sourceAsOfMonth) AS source_as_of_month,
              JSON_VALUE(item, '$.topic') AS topic,
              COALESCE(JSON_VALUE(item, '$.targetLabel'), '') AS target_label,
              COALESCE(JSON_VALUE(item, '$.resultSummary'), '') AS result_summary,
              SAFE_CAST(JSON_VALUE(item, '$.onTimeCount') AS INT64) AS on_time_count,
              SAFE_CAST(JSON_VALUE(item, '$.lateCount') AS INT64) AS late_count,
              SAFE_CAST(JSON_VALUE(item, '$.pendingCount') AS INT64) AS pending_count,
              SAFE_CAST(JSON_VALUE(item, '$.activeCount') AS INT64) AS active_count,
              SAFE_CAST(JSON_VALUE(item, '$.overdueCount') AS INT64) AS overdue_count,
              SAFE_CAST(JSON_VALUE(item, '$.ytdCount') AS INT64) AS ytd_count,
              COALESCE(JSON_VALUE(item, '$.comment'), '') AS comment
            FROM payload, UNNEST(rows_json) AS item
          )
          SELECT * FROM source_rows
        ) AS source_rows
        ON target.period_month = source_rows.period_month
          AND LOWER(TRIM(target.topic)) = LOWER(TRIM(source_rows.topic))
        WHEN MATCHED AND (
          IFNULL(target.target_label, '') != IFNULL(source_rows.target_label, '')
          OR IFNULL(target.result_summary, '') != IFNULL(source_rows.result_summary, '')
          OR IFNULL(target.on_time_count, -999999999) != IFNULL(source_rows.on_time_count, -999999999)
          OR IFNULL(target.late_count, -999999999) != IFNULL(source_rows.late_count, -999999999)
          OR IFNULL(target.pending_count, -999999999) != IFNULL(source_rows.pending_count, -999999999)
          OR IFNULL(target.active_count, -999999999) != IFNULL(source_rows.active_count, -999999999)
          OR IFNULL(target.overdue_count, -999999999) != IFNULL(source_rows.overdue_count, -999999999)
          OR IFNULL(target.ytd_count, -999999999) != IFNULL(source_rows.ytd_count, -999999999)
          OR IFNULL(target.comment, '') != IFNULL(source_rows.comment, '')
          OR IFNULL(target.reported_by, '') != IFNULL(@reportedBy, '')
          OR IFNULL(CAST(target.source_as_of_month AS STRING), '') != IFNULL(@sourceAsOfMonth, '')
        ) THEN
          UPDATE SET
            source_as_of_month = source_rows.source_as_of_month,
            target_label = source_rows.target_label,
            result_summary = source_rows.result_summary,
            on_time_count = source_rows.on_time_count,
            late_count = source_rows.late_count,
            pending_count = source_rows.pending_count,
            active_count = source_rows.active_count,
            overdue_count = source_rows.overdue_count,
            ytd_count = source_rows.ytd_count,
            comment = source_rows.comment,
            reported_by = @reportedBy,
            updated_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN
          INSERT (
            input_id, period_month, source_as_of_month, topic, target_label, result_summary,
            on_time_count, late_count, pending_count, active_count, overdue_count, ytd_count,
            comment, reported_by, created_at, updated_at
          )
          VALUES (
            source_rows.input_id, source_rows.period_month, source_rows.source_as_of_month, source_rows.topic,
            source_rows.target_label, source_rows.result_summary, source_rows.on_time_count, source_rows.late_count,
            source_rows.pending_count, source_rows.active_count, source_rows.overdue_count, source_rows.ytd_count,
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
    }),
  );

  return { ok: true as const, saved: topics.length };
}
