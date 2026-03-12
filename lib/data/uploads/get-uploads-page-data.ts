import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';

export type UploadListRow = {
  uploadId: string;
  moduleCode: string;
  periodMonth: string;
  sourceFileName: string;
  status: string;
  rowsTotal: number;
  rowsValid: number;
  rowsError: number;
  uploadedAt: string;
};

export async function getUploadsPageData(limit = 50): Promise<UploadListRow[]> {
  const client = getBigQueryClient();
  const query = `
    SELECT
      upload_id,
      module_code,
      CAST(period_month AS STRING) AS period_month,
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
    periodMonth: String(row.period_month ?? ''),
    sourceFileName: String(row.source_file_name ?? ''),
    status: String(row.status ?? 'unknown'),
    rowsTotal: Number(row.rows_total ?? 0),
    rowsValid: Number(row.rows_valid ?? 0),
    rowsError: Number(row.rows_error ?? 0),
    uploadedAt: String(row.uploaded_at ?? ''),
  }));
}
