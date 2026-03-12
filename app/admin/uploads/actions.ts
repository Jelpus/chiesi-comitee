'use server';

import 'server-only';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { getStorageClient, getUploadsBucketName } from '@/lib/storage/client';
import { inspectExcelWorkbook, parseExcelRows } from '@/lib/uploads/parse-excel';
import { normalizeUpload } from '@/lib/uploads/normalize-upload';
import { publishUploadToMart } from '@/lib/uploads/publish-upload';

type UploadRowParam = {
    rowNumber: number;
    rowPayloadJson: string;
    sheetName: string;
};

function sanitizeFileName(fileName: string) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function chunkRows<T>(rows: T[], chunkSize: number) {
    const chunks: T[][] = [];
    for (let i = 0; i < rows.length; i += chunkSize) {
        chunks.push(rows.slice(i, i + chunkSize));
    }
    return chunks;
}

async function insertUploadRecord(params: {
    uploadId: string;
    moduleCode: string;
    periodMonth: string;
    sourceFileName: string;
    storagePath: string;
    reportingVersionId: string;
    sourceSheetsJson: string;
    selectedSheetName: string;
    selectedHeaderRow: number;
}) {
    const client = getBigQueryClient();

    const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_raw.uploads\`
    (
      upload_id,
      module_code,
      period_month,
      uploaded_by,
      uploaded_at,
      source_file_name,
      storage_path,
      status,
      rows_total,
      rows_valid,
      rows_error,
      reporting_version_id,
      source_sheets_json,
      selected_sheet_name,
      selected_header_row
    )
    VALUES
    (
      @uploadId,
      @moduleCode,
      DATE(@periodMonth),
      @uploadedBy,
      CURRENT_TIMESTAMP(),
      @sourceFileName,
      @storagePath,
      @status,
      @rowsTotal,
      @rowsValid,
      @rowsError,
      @reportingVersionId,
      PARSE_JSON(@sourceSheetsJson),
      @selectedSheetName,
      @selectedHeaderRow
    )
  `;

    await client.query({
        query,
        params: {
            uploadId: params.uploadId,
            moduleCode: params.moduleCode,
            periodMonth: params.periodMonth,
            uploadedBy: 'system',
            sourceFileName: params.sourceFileName,
            storagePath: params.storagePath,
            status: 'processing',
            rowsTotal: 0,
            rowsValid: 0,
            rowsError: 0,
            reportingVersionId: params.reportingVersionId,
            sourceSheetsJson: params.sourceSheetsJson,
            selectedSheetName: params.selectedSheetName,
            selectedHeaderRow: params.selectedHeaderRow,
        },
    });
}

async function insertUploadRows(uploadId: string, rows: UploadRowParam[]) {
    if (rows.length === 0) return;

    const client = getBigQueryClient();
    const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\`
    (
      upload_id,
      raw_row_id,
      row_number,
      row_payload_json,
      validation_status,
      validation_error_json,
      sheet_name
    )
    SELECT
      @uploadId,
      GENERATE_UUID(),
      row.row_number,
      PARSE_JSON(row.row_payload_json),
      'pending',
      PARSE_JSON('[]'),
      row.sheet_name
    FROM UNNEST(@rows) AS row
  `;

    const chunks = chunkRows(rows, 500);

    for (const chunk of chunks) {
        await client.query({
            query,
            params: {
                uploadId,
                rows: chunk.map((row) => ({
                    row_number: row.rowNumber,
                    row_payload_json: row.rowPayloadJson,
                    sheet_name: row.sheetName,
                })),
            },
        });
    }
}

async function updateUploadCounters(uploadId: string, rowCount: number) {
    const client = getBigQueryClient();
    const query = `
    UPDATE \`chiesi-committee.chiesi_committee_raw.uploads\`
    SET
      status = 'raw_loaded',
      rows_total = @rowsTotal,
      rows_valid = 0,
      rows_error = 0
    WHERE upload_id = @uploadId
  `;

    await client.query({
        query,
        params: {
            uploadId,
            rowsTotal: rowCount,
        },
    });
}

async function markUploadAsError(uploadId: string) {
    const client = getBigQueryClient();

    await client.query({
        query: `
      UPDATE \`chiesi-committee.chiesi_committee_raw.uploads\`
      SET status = 'error'
      WHERE upload_id = @uploadId
    `,
        params: { uploadId },
    });
}

async function setUploadStatus(uploadId: string, status: string) {
    const client = getBigQueryClient();

    await client.query({
        query: `
      UPDATE \`chiesi-committee.chiesi_committee_raw.uploads\`
      SET status = @status
      WHERE upload_id = @uploadId
    `,
        params: { uploadId, status },
    });
}

async function updateUploadNormalizationResult(params: {
    uploadId: string;
    rowsValid: number;
    rowsError: number;
}) {
    const client = getBigQueryClient();

    await client.query({
        query: `
      UPDATE \`chiesi-committee.chiesi_committee_raw.uploads\`
      SET
        status = 'normalized',
        rows_valid = @rowsValid,
        rows_error = @rowsError
      WHERE upload_id = @uploadId
    `,
        params: params,
    });
}

async function getUploadContext(uploadId: string) {
    const client = getBigQueryClient();

    const [rows] = await client.query({
        query: `
      SELECT module_code, status
      FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
      WHERE upload_id = @uploadId
      LIMIT 1
    `,
        params: { uploadId },
    });

    const row = rows[0] as { module_code?: unknown; status?: unknown } | undefined;
    const moduleCode = row?.module_code ? String(row.module_code) : '';
    const status = row?.status ? String(row.status) : '';

    if (!moduleCode) {
        throw new Error(`module_code not found for upload_id ${uploadId}.`);
    }

    return { moduleCode, status };
}

export async function createUploadRecord(formData: FormData) {
  const file = formData.get('file');
  const moduleCode = String(formData.get('moduleCode') ?? '');
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '');
  const periodMonth = String(formData.get('periodMonth') ?? '');
  const selectedSheetName = String(formData.get('selectedSheetName') ?? '').trim();
  const headerRowValue = Number(formData.get('headerRow') ?? 1);
  const headerRow = Number.isFinite(headerRowValue) && headerRowValue > 0 ? headerRowValue : 1;

    if (!(file instanceof File) || file.size === 0) {
        throw new Error('You must select an Excel file to inspect sheets.');
    }

    if (!moduleCode || !reportingVersionId || !periodMonth) {
        throw new Error('Missing required form fields.');
    }

    const uploadId = randomUUID();

    const cleanFileName = sanitizeFileName(file.name);
    const bucketName = getUploadsBucketName();
    const storageObjectPath =
        `committee_uploads/${periodMonth}/${moduleCode}/${uploadId}_${cleanFileName}`;

    const storagePath = `gs://${bucketName}/${storageObjectPath}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const sourceSheets = inspectExcelWorkbook(fileBuffer);
    const effectiveSelectedSheetName =
      selectedSheetName && sourceSheets.includes(selectedSheetName)
        ? selectedSheetName
        : sourceSheets[0] ?? 'UNKNOWN';

    await insertUploadRecord({
        uploadId,
        moduleCode,
        periodMonth,
        sourceFileName: file.name,
        storagePath,
        reportingVersionId,
        sourceSheetsJson: JSON.stringify(sourceSheets),
        selectedSheetName: effectiveSelectedSheetName,
        selectedHeaderRow: headerRow,
    });

    try {
        const storageClient = getStorageClient();
        const bucket = storageClient.bucket(bucketName);

    await bucket.file(storageObjectPath).save(fileBuffer, {
      resumable: false,
      contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      metadata: {
        metadata: {
                    upload_id: uploadId,
          module_code: moduleCode,
          period_month: periodMonth,
          reporting_version_id: reportingVersionId,
          selected_sheet_name: effectiveSelectedSheetName,
          header_row: String(headerRow),
        },
      },
    });

    const parsedRows = parseExcelRows(fileBuffer, {
      sheetName: effectiveSelectedSheetName,
      headerRow,
    });

        await insertUploadRows(
            uploadId,
            parsedRows.map((row) => ({
                rowNumber: row.rowNumber,
                rowPayloadJson: JSON.stringify(row.payload),
                sheetName: effectiveSelectedSheetName,
            })),
        );

    await updateUploadCounters(uploadId, parsedRows.length);
  } catch (error) {
    await markUploadAsError(uploadId);
    throw error;
  }

  revalidatePath('/admin/uploads');
  return { ok: true, uploadId };
}

export async function inspectUploadWorkbook(formData: FormData) {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('You must select an Excel file to inspect sheets.');
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const sheetNames = inspectExcelWorkbook(fileBuffer);

  return {
    sheetNames,
    suggestedSheetName: sheetNames[0] ?? '',
    suggestedHeaderRow: 1,
  };
}

export async function normalizeSalesInternalUpload(uploadId: string) {
  if (!uploadId) {
    throw new Error('uploadId is required for normalization.');
  }

  return normalizeUpload(uploadId, 'sales_internal');
}

export async function processUpload(uploadId: string) {
    if (!uploadId) {
        throw new Error('uploadId is required for processing.');
    }

    const { moduleCode, status } = await getUploadContext(uploadId);
    if (status !== 'raw_loaded' && status !== 'error') {
        throw new Error(`Upload ${uploadId} is not ready to process (current status: ${status}).`);
    }

    await setUploadStatus(uploadId, 'normalizing');

    try {
        const result = await normalizeUpload(uploadId, moduleCode);

        await updateUploadNormalizationResult({
            uploadId,
            rowsValid: result.rowsValid,
            rowsError: result.rowsError,
        });

        revalidatePath('/admin/uploads');
        return result;
    } catch (error) {
        await markUploadAsError(uploadId);
        revalidatePath('/admin/uploads');
        throw error;
    }
}

export async function publishUpload(uploadId: string) {
    if (!uploadId) {
        throw new Error('uploadId is required for publishing.');
    }

    const { status } = await getUploadContext(uploadId);
    if (status !== 'normalized' && status !== 'published') {
        throw new Error(`Upload ${uploadId} is not ready to publish (status: ${status}).`);
    }

    await setUploadStatus(uploadId, 'publishing');

    try {
        const result = await publishUploadToMart(uploadId);
        await setUploadStatus(uploadId, 'published');
        revalidatePath('/admin/uploads');
        revalidatePath('/executive');
        return result;
    } catch (error) {
        await setUploadStatus(uploadId, status);
        revalidatePath('/admin/uploads');
        throw error;
    }
}




