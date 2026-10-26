import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';

export type UploadListRow = {
  uploadId: string;
  moduleCode: string;
  dddSource: string | null;
  periodMonth: string;
  sourceAsOfMonth: string;
  sourceFileName: string;
  status: string;
  rowsTotal: number;
  rowsValid: number;
  rowsError: number;
  uploadedAt: string;
};

let ensureUploadsAsOfColumnPromise: Promise<void> | null = null;
let ensureUploadsDddSourceColumnPromise: Promise<void> | null = null;

function isTableUpdateQuotaError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('exceeded quota for table update operations') ||
    message.includes('job exceeded rate limits') ||
    message.includes('rate limits')
  );
}

async function ensureUploadsAsOfColumn() {
  if (!ensureUploadsAsOfColumnPromise) {
    ensureUploadsAsOfColumnPromise = (async () => {
      const client = getBigQueryClient();
      try {
        await client.query({
          query: `
            ALTER TABLE \`chiesi-committee.chiesi_committee_raw.uploads\`
            ADD COLUMN IF NOT EXISTS source_as_of_month DATE
          `,
        });
      } catch (error) {
        if (!isTableUpdateQuotaError(error)) throw error;
        console.warn('[ensureUploadsAsOfColumn] skipped due to table update quota', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }

  await ensureUploadsAsOfColumnPromise;
}

async function ensureUploadsDddSourceColumn() {
  if (!ensureUploadsDddSourceColumnPromise) {
    ensureUploadsDddSourceColumnPromise = (async () => {
      const client = getBigQueryClient();
      try {
        await client.query({
          query: `
            ALTER TABLE \`chiesi-committee.chiesi_committee_raw.uploads\`
            ADD COLUMN IF NOT EXISTS ddd_source STRING
          `,
        });
      } catch (error) {
        if (!isTableUpdateQuotaError(error)) throw error;
        console.warn('[ensureUploadsDddSourceColumn] skipped due to table update quota', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }

  await ensureUploadsDddSourceColumnPromise;
}

export async function getUploadsPageData(limit = 50): Promise<UploadListRow[]> {
  const client = getBigQueryClient();
  await ensureUploadsAsOfColumn();
  await ensureUploadsDddSourceColumn();
  const query = `
    SELECT
      upload_id,
      module_code,
      ddd_source,
      CAST(period_month AS STRING) AS period_month,
      CAST(source_as_of_month AS STRING) AS source_as_of_month,
      source_file_name,
      status,
      rows_total,
      rows_valid,
      rows_error,
      CAST(uploaded_at AS STRING) AS uploaded_at
    FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
    ORDER BY uploaded_at DESC
    LIMIT @limit
  `;

  const [rows] = await client.query({
    query,
    params: { limit },
  });

  return (rows as Record<string, unknown>[]).map((row) => ({
    uploadId: String(row.upload_id ?? ''),
    moduleCode: String(row.module_code ?? ''),
    dddSource: row.ddd_source ? String(row.ddd_source) : null,
    periodMonth: String(row.period_month ?? ''),
    sourceAsOfMonth: String(row.source_as_of_month ?? row.period_month ?? ''),
    sourceFileName: String(row.source_file_name ?? ''),
    status: String(row.status ?? 'unknown'),
    rowsTotal: Number(row.rows_total ?? 0),
    rowsValid: Number(row.rows_valid ?? 0),
    rowsError: Number(row.rows_error ?? 0),
    uploadedAt: String(row.uploaded_at ?? ''),
  }));
}

export async function getLatestUploadRow(): Promise<UploadListRow | null> {
  const rows = await getUploadsPageData(1);
  return rows[0] ?? null;
}
