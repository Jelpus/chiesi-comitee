import 'server-only';
import { randomUUID } from 'crypto';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { getClosingInputAreaMeta } from '@/lib/data/closing-inputs-schema';

const CLOSING_INPUTS_TABLE = 'chiesi-committee.chiesi_committee_stg.stg_closing_inputs';

let ensureTablePromise: Promise<void> | null = null;

export type ClosingInputRow = {
  inputId: string;
  areaSlug: string;
  areaCode: string;
  reportingVersionId: string;
  periodMonth: string;
  sourceAsOfMonth: string;
  reportedBy: string;
  messages: string[];
  additionalComment: string;
  updatedAt: string | null;
};

function normalizeMessages(messages: string[]) {
  return Array.from({ length: 5 }, (_, index) => String(messages[index] ?? '').trim());
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

async function queryWithRetry<T>(
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

async function ensureClosingInputsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      const client = getBigQueryClient();
      await queryWithRetry(() =>
        client.query({
          query: `
            CREATE TABLE IF NOT EXISTS \`${CLOSING_INPUTS_TABLE}\` (
              input_id STRING,
              area_slug STRING,
              area_code STRING,
              reporting_version_id STRING,
              period_month DATE,
              source_as_of_month DATE,
              reported_by STRING,
              message_1 STRING,
              message_2 STRING,
              message_3 STRING,
              message_4 STRING,
              message_5 STRING,
              additional_comment STRING,
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

export async function getClosingInput(params: {
  areaSlug: string;
  reportingVersionId: string;
  periodMonth: string;
}): Promise<ClosingInputRow | null> {
  await ensureClosingInputsTable();
  const client = getBigQueryClient();

  const [rows] = await client.query({
    query: `
      SELECT
        input_id,
        area_slug,
        area_code,
        reporting_version_id,
        CAST(period_month AS STRING) AS period_month,
        CAST(source_as_of_month AS STRING) AS source_as_of_month,
        reported_by,
        message_1,
        message_2,
        message_3,
        message_4,
        message_5,
        additional_comment,
        CAST(updated_at AS STRING) AS updated_at
      FROM \`${CLOSING_INPUTS_TABLE}\`
      WHERE area_slug = @areaSlug
        AND reporting_version_id = @reportingVersionId
        AND period_month = DATE(@periodMonth)
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    params: {
      areaSlug: params.areaSlug,
      reportingVersionId: params.reportingVersionId,
      periodMonth: params.periodMonth,
    },
  });

  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;

  return {
    inputId: String(row.input_id ?? ''),
    areaSlug: String(row.area_slug ?? ''),
    areaCode: String(row.area_code ?? ''),
    reportingVersionId: String(row.reporting_version_id ?? ''),
    periodMonth: String(row.period_month ?? ''),
    sourceAsOfMonth: String(row.source_as_of_month ?? ''),
    reportedBy: String(row.reported_by ?? ''),
    messages: [
      String(row.message_1 ?? ''),
      String(row.message_2 ?? ''),
      String(row.message_3 ?? ''),
      String(row.message_4 ?? ''),
      String(row.message_5 ?? ''),
    ],
    additionalComment: String(row.additional_comment ?? ''),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
  };
}

export async function saveClosingInput(input: {
  areaSlug: string;
  reportingVersionId: string;
  periodMonth: string;
  sourceAsOfMonth: string;
  reportedBy: string;
  messages: string[];
  additionalComment?: string;
}) {
  await ensureClosingInputsTable();

  const areaMeta = getClosingInputAreaMeta(input.areaSlug);
  if (!areaMeta) throw new Error('Invalid area for closing inputs.');
  if (!input.reportingVersionId.trim()) throw new Error('Reporting version is required.');
  if (!input.periodMonth.trim()) throw new Error('Period month is required.');
  if (!input.sourceAsOfMonth.trim()) throw new Error('Source as of month is required.');
  if (!input.reportedBy.trim()) throw new Error('Reported by is required.');

  const messages = normalizeMessages(input.messages);
  if (messages.some((item) => item.length === 0)) {
    throw new Error('All five key messages are required.');
  }

  const client = getBigQueryClient();

  await queryWithRetry(() =>
    client.query({
      query: `
        MERGE \`${CLOSING_INPUTS_TABLE}\` AS target
        USING (
          SELECT
            @areaSlug AS area_slug,
            @areaCode AS area_code,
            @reportingVersionId AS reporting_version_id,
            DATE(@periodMonth) AS period_month,
            DATE(@sourceAsOfMonth) AS source_as_of_month,
            @reportedBy AS reported_by,
            @message1 AS message_1,
            @message2 AS message_2,
            @message3 AS message_3,
            @message4 AS message_4,
            @message5 AS message_5,
            @additionalComment AS additional_comment,
            @inputId AS input_id
        ) AS source_row
        ON target.area_slug = source_row.area_slug
          AND target.reporting_version_id = source_row.reporting_version_id
          AND target.period_month = source_row.period_month
        WHEN MATCHED THEN
          UPDATE SET
            area_code = source_row.area_code,
            source_as_of_month = source_row.source_as_of_month,
            reported_by = source_row.reported_by,
            message_1 = source_row.message_1,
            message_2 = source_row.message_2,
            message_3 = source_row.message_3,
            message_4 = source_row.message_4,
            message_5 = source_row.message_5,
            additional_comment = source_row.additional_comment,
            updated_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN
          INSERT (
            input_id,
            area_slug,
            area_code,
            reporting_version_id,
            period_month,
            source_as_of_month,
            reported_by,
            message_1,
            message_2,
            message_3,
            message_4,
            message_5,
            additional_comment,
            created_at,
            updated_at
          )
          VALUES (
            source_row.input_id,
            source_row.area_slug,
            source_row.area_code,
            source_row.reporting_version_id,
            source_row.period_month,
            source_row.source_as_of_month,
            source_row.reported_by,
            source_row.message_1,
            source_row.message_2,
            source_row.message_3,
            source_row.message_4,
            source_row.message_5,
            source_row.additional_comment,
            CURRENT_TIMESTAMP(),
            CURRENT_TIMESTAMP()
          )
      `,
      params: {
        inputId: randomUUID(),
        areaSlug: input.areaSlug,
        areaCode: areaMeta.areaCode,
        reportingVersionId: input.reportingVersionId.trim(),
        periodMonth: input.periodMonth.trim(),
        sourceAsOfMonth: input.sourceAsOfMonth.trim(),
        reportedBy: input.reportedBy.trim(),
        message1: messages[0],
        message2: messages[1],
        message3: messages[2],
        message4: messages[3],
        message5: messages[4],
        additionalComment: (input.additionalComment ?? '').trim(),
      },
    }),
  );

  return { ok: true as const, saved: 1 };
}

