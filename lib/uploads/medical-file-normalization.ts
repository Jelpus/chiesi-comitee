import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import type { NormalizeUploadResult } from './normalize-upload';

type Validation = { rowNumber: number; validationStatus: string; errors: string[] };
type MedicalRow = {
  rowNumber: number; onekeyId: string; territory: string; territoryNormalized: string;
  bu: string | null; district: string | null; imsId: string | null; fullName: string | null;
  specialtyConsolidated: string | null; periodMonth: string; objetivo: number | null; potencial: string | null;
};
type Dependencies<T extends { row_number: number }> = {
  readPage: (uploadId: string, cursor: number, limit: number) => Promise<T[]>;
  normalize: (rows: T[]) => { validations: Validation[]; normalizedRows: MedicalRow[] };
  ensureSchema: () => Promise<void>;
};

const CHECKPOINT = '`chiesi-committee.chiesi_committee_raw.medical_file_normalization_checkpoints`';
const STAGING = '`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file`';
const RAW = '`chiesi-committee.chiesi_committee_raw.upload_rows_raw`';

// Validation, staging and the cursor commit together. A failed request can repeat
// its last batch without duplicating rows or skipping a batch containing errors.
export async function normalizeMedicalFileInPages<T extends { row_number: number }>(
  uploadId: string, resume: boolean, dependencies: Dependencies<T>,
): Promise<NormalizeUploadResult> {
  const client = getBigQueryClient();
  const startedAt = Date.now();
  await dependencies.ensureSchema();
  await client.query({ query: `CREATE TABLE IF NOT EXISTS ${CHECKPOINT} (
    upload_id STRING, last_row_number INT64, source_rows INT64,
    rows_valid INT64, rows_error INT64, updated_at TIMESTAMP
  )` });
  const [progress] = await client.query({
    query: `SELECT * FROM ${CHECKPOINT} WHERE upload_id = @uploadId`, params: { uploadId },
  });
  if (progress.length > 1) throw new Error('Duplicate medical file normalization checkpoints.');
  if (!resume || progress.length === 0) {
    await client.query({
      query: `BEGIN TRANSACTION;
        DELETE FROM ${STAGING} WHERE upload_id = @uploadId;
        DELETE FROM ${CHECKPOINT} WHERE upload_id = @uploadId;
        INSERT INTO ${CHECKPOINT}
          SELECT @uploadId, 0, COUNT(*), 0, 0, CURRENT_TIMESTAMP()
          FROM ${RAW} WHERE upload_id = @uploadId;
        COMMIT TRANSACTION;`, params: { uploadId },
    });
  }
  const [checkpointRows] = await client.query({
    query: `SELECT * FROM ${CHECKPOINT} WHERE upload_id = @uploadId`, params: { uploadId },
  });
  const checkpoint = checkpointRows[0];
  let cursor = Number(checkpoint.last_row_number);
  let rowsValid = Number(checkpoint.rows_valid);
  let rowsError = Number(checkpoint.rows_error);
  const sourceRows = Number(checkpoint.source_rows);
  let complete = false;

  for (let page = 0; page < 4 && Date.now() - startedAt < 120_000; page += 1) {
    const rows = await dependencies.readPage(uploadId, cursor, 5000);
    if (rows.length === 0) { complete = true; break; }
    const result = dependencies.normalize(rows);
    const medicalRows = new Map(result.normalizedRows.map((row) => [row.rowNumber, row]));
    const records = result.validations.map((validation) => {
      const medical = medicalRows.get(validation.rowNumber);
      return {
        row_number: validation.rowNumber, status: validation.validationStatus, errors: validation.errors,
        medical: medical ? {
          onekey_id: medical.onekeyId, territory: medical.territory,
          territory_normalized: medical.territoryNormalized, bu: medical.bu, district: medical.district,
          ims_id: medical.imsId, full_name: medical.fullName,
          specialty_consolidated: medical.specialtyConsolidated, period_month: medical.periodMonth,
          objetivo: medical.objetivo, potencial: medical.potencial,
        } : null,
      };
    });
    // Keep JSON parameters comfortably below BigQuery's request size limit.
    const batches: typeof records[] = [];
    let batch: typeof records = [];
    let bytes = 2;
    for (const record of records) {
      const size = Buffer.byteLength(JSON.stringify(record), 'utf8') + 1;
      if (size > 2_000_000) throw new Error(`Medical file row ${record.row_number} exceeds the batch size limit.`);
      if (bytes + size > 2_000_000 && batch.length) { batches.push(batch); batch = []; bytes = 2; }
      batch.push(record); bytes += size;
    }
    if (batch.length) batches.push(batch);
    for (const batch of batches) {
      const lastRow = batch[batch.length - 1].row_number;
      const valid = batch.filter((row) => row.status === 'valid').length;
      const errors = batch.length - valid;
      await client.query({
        query: `
          CREATE TEMP TABLE batch AS
            SELECT CAST(JSON_VALUE(item, '$.row_number') AS INT64) row_number,
              JSON_VALUE(item, '$.status') status, JSON_QUERY(item, '$.errors') errors,
              JSON_QUERY(item, '$.medical') medical
            FROM UNNEST(JSON_QUERY_ARRAY(PARSE_JSON(@batch))) item;
          BEGIN TRANSACTION;
          ASSERT (SELECT COUNT(*) = 1 FROM ${CHECKPOINT}
            WHERE upload_id = @uploadId AND last_row_number = @cursor)
            AS 'Medical file normalization advanced in another request; retry Normalize.';
          ASSERT (SELECT COUNT(*) = @batchCount FROM ${RAW} r JOIN batch b USING(row_number)
            WHERE r.upload_id = @uploadId) AS 'Medical file RAW rows changed during normalization.';
          DELETE FROM ${STAGING} WHERE upload_id = @uploadId AND row_number > @cursor AND row_number <= @lastRow;
          INSERT INTO ${STAGING} (upload_id, row_number, onekey_id, territory, territory_normalized,
            bu, district, ims_id, full_name, specialty_consolidated, period_month,
            objetivo, potencial, source_payload_json, normalized_at)
          SELECT @uploadId, b.row_number,
            JSON_VALUE(medical, '$.onekey_id'), JSON_VALUE(medical, '$.territory'),
            JSON_VALUE(medical, '$.territory_normalized'), JSON_VALUE(medical, '$.bu'),
            JSON_VALUE(medical, '$.district'), JSON_VALUE(medical, '$.ims_id'),
            JSON_VALUE(medical, '$.full_name'), JSON_VALUE(medical, '$.specialty_consolidated'),
            DATE(JSON_VALUE(medical, '$.period_month')), SAFE_CAST(JSON_VALUE(medical, '$.objetivo') AS NUMERIC),
            JSON_VALUE(medical, '$.potencial'), r.row_payload_json, CURRENT_TIMESTAMP()
          FROM batch b JOIN ${RAW} r USING(row_number)
          WHERE r.upload_id = @uploadId AND b.status = 'valid';
          UPDATE ${RAW} r SET validation_status = b.status, validation_error_json = b.errors
            FROM batch b WHERE r.upload_id = @uploadId AND r.row_number = b.row_number;
          UPDATE ${CHECKPOINT} SET last_row_number = @lastRow, rows_valid = rows_valid + @valid,
            rows_error = rows_error + @errors, updated_at = CURRENT_TIMESTAMP() WHERE upload_id = @uploadId;
          COMMIT TRANSACTION;`,
        params: { uploadId, cursor, lastRow, valid, errors, batchCount: batch.length, batch: JSON.stringify(batch) },
      });
      cursor = lastRow; rowsValid += valid; rowsError += errors;
    }
    console.info('[normalizeMedicalFileInPages] progress', { uploadId, cursor, rowsValid, rowsError, sourceRows });
  }
  const [verification] = await client.query({
    query: `SELECT
      (SELECT COUNT(*) FROM ${RAW} WHERE upload_id = @uploadId) source_rows,
      (SELECT COUNT(*) FROM ${RAW} WHERE upload_id = @uploadId AND row_number > @cursor) remaining,
      COUNT(*) staged, COUNT(DISTINCT row_number) distinct_staged
      FROM ${STAGING} WHERE upload_id = @uploadId`, params: { uploadId, cursor },
  });
  const state = verification[0];
  complete ||= Number(state.remaining) === 0;
  if (Number(state.source_rows) !== sourceRows || Number(state.staged) !== rowsValid ||
      Number(state.distinct_staged) !== rowsValid || (complete && rowsValid + rowsError !== sourceRows)) {
    throw new Error('Medical file normalization verification failed; staging is incomplete or RAW changed.');
  }
  const [issues] = await client.query({
    query: `SELECT JSON_VALUE(issue) reason, COUNT(*) count FROM ${RAW},
      UNNEST(JSON_QUERY_ARRAY(validation_error_json)) issue
      WHERE upload_id = @uploadId AND row_number <= @cursor AND validation_status = 'error'
      GROUP BY reason ORDER BY count DESC, reason LIMIT 3`, params: { uploadId, cursor },
  });
  if (complete && rowsValid > 0) {
    // Preserve replacement semantics, but retire previous staging only after the
    // complete replacement has passed verification.
    await client.query({
      query: `DELETE FROM ${STAGING} WHERE upload_id IN (
        SELECT previous.upload_id
        FROM \`chiesi-committee.chiesi_committee_raw.uploads\` previous
        JOIN \`chiesi-committee.chiesi_committee_raw.uploads\` current_upload
          ON previous.reporting_version_id = current_upload.reporting_version_id
          AND previous.period_month = current_upload.period_month
        WHERE current_upload.upload_id = @uploadId AND previous.upload_id != @uploadId
          AND LOWER(TRIM(previous.module_code)) IN (
            'business_excellence_salesforce_fichero_medico', 'business_excellence_fichero_medico', 'fichero_medico')
      )`, params: { uploadId },
    });
  }
  return { ok: true, incomplete: !complete, normalizedRows: rowsValid, rowsValid, rowsError, rowsSkipped: 0,
    topValidationIssues: issues.map((row) => ({ reason: String(row.reason), count: Number(row.count) })) };
}
