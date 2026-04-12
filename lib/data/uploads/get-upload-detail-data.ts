import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';

export type UploadDetailHeader = {
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
  selectedSheetName: string;
  selectedHeaderRow: number;
  uploadedAt: string;
  lastErrorMessage: string | null;
};

export type UploadErrorRow = {
  rowNumber: number;
  errors: string[];
  payloadJson: string;
};

export type UploadDetailData = {
  header: UploadDetailHeader;
  errors: UploadErrorRow[];
};

let ensureUploadsAsOfColumnPromise: Promise<void> | null = null;
let ensureUploadsErrorColumnPromise: Promise<void> | null = null;
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

async function ensureUploadsErrorColumn() {
  if (!ensureUploadsErrorColumnPromise) {
    ensureUploadsErrorColumnPromise = (async () => {
      const client = getBigQueryClient();
      try {
        await client.query({
          query: `
            ALTER TABLE \`chiesi-committee.chiesi_committee_raw.uploads\`
            ADD COLUMN IF NOT EXISTS last_error_message STRING
          `,
        });
      } catch (error) {
        if (!isTableUpdateQuotaError(error)) throw error;
        console.warn('[ensureUploadsErrorColumn] skipped due to table update quota', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }

  await ensureUploadsErrorColumnPromise;
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

export async function getUploadDetailData(uploadId: string): Promise<UploadDetailData> {
  const client = getBigQueryClient();
  await ensureUploadsAsOfColumn();
  await ensureUploadsErrorColumn();
  await ensureUploadsDddSourceColumn();

  const [uploadRows] = await client.query({
    query: `
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
        selected_sheet_name,
        selected_header_row,
        last_error_message,
        CAST(uploaded_at AS STRING) AS uploaded_at
      FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
      WHERE upload_id = @uploadId
      LIMIT 1
    `,
    params: { uploadId },
  });

  const row = (uploadRows as Record<string, unknown>[])[0];
  if (!row) {
    throw new Error(`Upload not found with ID ${uploadId}.`);
  }

  const [errorRows] = await client.query({
    query: `
      SELECT
        row_number,
        TO_JSON_STRING(validation_error_json) AS validation_error_json,
        TO_JSON_STRING(row_payload_json) AS row_payload_json
      FROM \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\`
      WHERE upload_id = @uploadId
        AND validation_status = 'error'
      ORDER BY row_number
      LIMIT 200
    `,
    params: { uploadId },
  });

  const errors: UploadErrorRow[] = (errorRows as Record<string, unknown>[]).map((item) => {
    const parsedErrors = JSON.parse(String(item.validation_error_json ?? '[]')) as unknown[];
    return {
      rowNumber: Number(item.row_number ?? 0),
      errors: parsedErrors.map((error) => String(error)),
      payloadJson: String(item.row_payload_json ?? '{}'),
    };
  });

  return {
    header: {
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
      selectedSheetName: String(row.selected_sheet_name ?? ''),
      selectedHeaderRow: Number(row.selected_header_row ?? 1),
      uploadedAt: String(row.uploaded_at ?? ''),
      lastErrorMessage: row.last_error_message ? String(row.last_error_message) : null,
    },
    errors,
  };
}


