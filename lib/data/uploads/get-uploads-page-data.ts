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

async function ensureUploadsAsOfColumn() {
  if (!ensureUploadsAsOfColumnPromise) {
    ensureUploadsAsOfColumnPromise = (async () => {
      const client = getBigQueryClient();
      await client.query({
        query: `
          ALTER TABLE \`chiesi-committee.chiesi_committee_raw.uploads\`
          ADD COLUMN IF NOT EXISTS source_as_of_month DATE
        `,
      });
    })();
  }

  await ensureUploadsAsOfColumnPromise;
}

async function ensureUploadsDddSourceColumn() {
  if (!ensureUploadsDddSourceColumnPromise) {
    ensureUploadsDddSourceColumnPromise = (async () => {
      const client = getBigQueryClient();
      await client.query({
        query: `
          ALTER TABLE \`chiesi-committee.chiesi_committee_raw.uploads\`
          ADD COLUMN IF NOT EXISTS ddd_source STRING
        `,
      });
    })();
  }

  await ensureUploadsDddSourceColumnPromise;
}

async function reconcileStaleUploads() {
  const client = getBigQueryClient();

  await client.query({
    query: `
      UPDATE \`chiesi-committee.chiesi_committee_raw.uploads\` u
      SET
        status = 'raw_loaded',
        rows_total = (
          SELECT COUNT(1)
          FROM \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\` r
          WHERE r.upload_id = u.upload_id
        )
      WHERE u.status IN ('processing', 'uploading', 'parsing', 'loading_raw')
        AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), u.uploaded_at, MINUTE) >= 5
        AND EXISTS (
          SELECT 1
          FROM \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\` r
          WHERE r.upload_id = u.upload_id
          LIMIT 1
        )
    `,
  });

  await client.query({
    query: `
      UPDATE \`chiesi-committee.chiesi_committee_raw.uploads\` u
      SET status = 'error'
      WHERE u.status IN ('processing', 'uploading', 'parsing', 'loading_raw')
        AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), u.uploaded_at, MINUTE) >= 5
        AND NOT EXISTS (
          SELECT 1
          FROM \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\` r
          WHERE r.upload_id = u.upload_id
          LIMIT 1
        )
    `,
  });

  await client.query({
    query: `
      UPDATE \`chiesi-committee.chiesi_committee_raw.uploads\` u
      SET status = 'raw_loaded'
      WHERE u.status = 'normalizing'
        AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), u.uploaded_at, MINUTE) >= 5
    `,
  });
}

export async function getUploadsPageData(limit = 50): Promise<UploadListRow[]> {
  const client = getBigQueryClient();
  await ensureUploadsAsOfColumn();
  await ensureUploadsDddSourceColumn();
  await reconcileStaleUploads();
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
