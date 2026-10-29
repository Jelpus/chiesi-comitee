import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { getStorageClient } from '@/lib/storage/client';
import { refreshAirPublicServingArtifacts } from '@/lib/serving/refresh-air-public-serving';
import { isGob360SnapshotModule, parseGob360Snapshot } from './gob360-snapshot-parser';

const PROJECT = 'chiesi-committee';
const DATASET = 'gob360_snapshots';
const MANIFEST = `\`${PROJECT}.${DATASET}.manifest\``;
const PIECES = `\`${PROJECT}.${DATASET}.pieces\``;

function parseStoragePath(storagePath: string) {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(storagePath);
  if (!match) throw new Error('Ruta GCS invalida para snapshot GOB360.');
  return { bucket: match[1], object: match[2] };
}

async function getUpload(uploadId: string) {
  const [rows] = await getBigQueryClient().query({
    query: `SELECT module_code, reporting_version_id, source_file_name, storage_path,
      CAST(source_as_of_month AS STRING) AS validated_through_month,
      selected_sheet_name
      FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
      WHERE upload_id = @uploadId LIMIT 1`,
    params: { uploadId },
    location: 'EU',
  });
  const row = (rows as Record<string, unknown>[])[0];
  if (!row || !isGob360SnapshotModule(String(row.module_code ?? ''))) {
    throw new Error(`La carga ${uploadId} no es un snapshot GOB360.`);
  }
  return {
    moduleCode: String(row.module_code),
    reportingVersionId: String(row.reporting_version_id ?? ''),
    sourceFileName: String(row.source_file_name ?? ''),
    storagePath: String(row.storage_path ?? ''),
    validatedThroughMonth: String(row.validated_through_month ?? ''),
    sheetName: String(row.selected_sheet_name ?? ''),
  };
}

async function readSource(uploadId: string) {
  const upload = await getUpload(uploadId);
  const { bucket, object } = parseStoragePath(upload.storagePath);
  const [buffer] = await getStorageClient().bucket(bucket).file(object).download();
  const preview = parseGob360Snapshot(
    buffer,
    upload.moduleCode as Parameters<typeof parseGob360Snapshot>[1],
    upload.validatedThroughMonth,
    upload.sheetName || undefined,
  );
  return { upload, buffer, preview };
}

export async function inspectGob360SnapshotUpload(uploadId: string) {
  const { preview } = await readSource(uploadId);
  return { sourceRows: preview.sourceRows, controlRows: preview.controlRows };
}

export async function normalizeGob360SnapshotUpload(uploadId: string) {
  const { upload, buffer, preview } = await readSource(uploadId);
  const client = getBigQueryClient();
  const [activeRows] = await client.query({
    query: `SELECT COUNT(*) AS total FROM ${MANIFEST}
      WHERE snapshot_id = @uploadId AND status = 'active'`,
    params: { uploadId }, location: 'US',
  });
  if (Number((activeRows as Array<{ total: number }>)[0]?.total ?? 0) > 0) {
    throw new Error('Un snapshot activo no se reprocesa: registra una nueva carga.');
  }
  const filePath = join(tmpdir(), `gob360-${uploadId}-${randomUUID()}.ndjson`);
  try {
    const stream = createWriteStream(filePath, { encoding: 'utf8' });
    for (const row of preview.rows) {
      const record = {
        snapshot_id: uploadId,
        module_code: upload.moduleCode,
        clave: row.clave,
        clave_normalized: row.claveNormalized,
        clue: row.clue,
        clue_normalized: row.clue.trim().toUpperCase(),
        period_month: row.periodMonth,
        pieces: row.pieces,
      };
      if (!stream.write(`${JSON.stringify(record)}\n`)) await once(stream, 'drain');
    }
    stream.end();
    await once(stream, 'finish');
    await client.query({
      query: `DELETE FROM ${PIECES} WHERE snapshot_id = @uploadId`,
      params: { uploadId }, location: 'US',
    });
    await client.dataset(DATASET).table('pieces').load(filePath, {
      sourceFormat: 'NEWLINE_DELIMITED_JSON',
      writeDisposition: 'WRITE_APPEND',
      location: 'US',
    });
    const [countRows] = await client.query({
      query: `SELECT COUNT(*) AS total FROM ${PIECES} WHERE snapshot_id = @uploadId`,
      params: { uploadId }, location: 'US',
    });
    const actual = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);
    if (actual !== preview.controlRows) {
      throw new Error(`El snapshot cargo ${actual} controles; se esperaban ${preview.controlRows}.`);
    }
    await client.query({
      query: `MERGE ${MANIFEST} AS target
        USING (SELECT @uploadId AS snapshot_id) AS source
        ON target.snapshot_id = source.snapshot_id
        WHEN MATCHED THEN UPDATE SET
          module_code = @moduleCode,
          reporting_version_id = @reportingVersionId,
          validated_through_month = DATE(@validatedThroughMonth),
          source_file_name = @sourceFileName,
          source_sha256 = @sha256,
          source_rows = @sourceRows,
          control_rows = @controlRows,
          status = 'staged'
        WHEN NOT MATCHED THEN INSERT (
          snapshot_id, module_code, reporting_version_id, validated_through_month,
          source_file_name, source_sha256, source_rows, control_rows, status, created_at
        ) VALUES (
          @uploadId, @moduleCode, @reportingVersionId, DATE(@validatedThroughMonth),
          @sourceFileName, @sha256, @sourceRows, @controlRows, 'staged', CURRENT_TIMESTAMP()
        )`,
      params: {
        uploadId, moduleCode: upload.moduleCode,
        reportingVersionId: upload.reportingVersionId,
        validatedThroughMonth: upload.validatedThroughMonth,
        sourceFileName: upload.sourceFileName,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        sourceRows: preview.sourceRows,
        controlRows: preview.controlRows,
      },
      location: 'US',
    });
    return {
      ok: true as const,
      normalizedRows: actual,
      rowsValid: preview.sourceRows,
      rowsSkipped: 0,
      rowsError: 0,
      topValidationIssues: [],
    };
  } finally {
    await unlink(filePath).catch(() => undefined);
  }
}

export async function publishGob360SnapshotUpload(uploadId: string) {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `SELECT module_code, reporting_version_id, status, control_rows FROM ${MANIFEST}
      WHERE snapshot_id = @uploadId LIMIT 1`,
    params: { uploadId }, location: 'US',
  });
  const manifest = (rows as Array<Record<string, unknown>>)[0];
  if (!manifest || !isGob360SnapshotModule(String(manifest.module_code ?? ''))) {
    throw new Error('Snapshot GOB360 normalizado no encontrado.');
  }
  const controlRows = Number(manifest.control_rows ?? 0);
  if (controlRows < 1) throw new Error('Un snapshot vacio no se puede activar.');
  const refreshServing = async () => {
    if (process.env.GOB360_SNAPSHOT_ENABLED === 'true' &&
        manifest.module_code === 'business_excellence_gob360_air' &&
        manifest.reporting_version_id) {
      await refreshAirPublicServingArtifacts(client, {
        reportingVersionId: String(manifest.reporting_version_id),
      });
    }
  };
  if (manifest.status === 'active') {
    await refreshServing();
    return { ok: true as const, publishedRows: controlRows };
  }
  if (manifest.status !== 'staged') throw new Error('El snapshot no esta listo para publicar.');
  await client.query({
    query: `BEGIN TRANSACTION;
      UPDATE ${MANIFEST} SET status = 'archived'
      WHERE module_code = @moduleCode AND status = 'active';
      UPDATE ${MANIFEST} SET status = 'active', published_at = CURRENT_TIMESTAMP()
      WHERE snapshot_id = @uploadId AND status = 'staged';
      COMMIT TRANSACTION;`,
    params: { uploadId, moduleCode: String(manifest.module_code) },
    location: 'US',
  });
  await refreshServing();
  return { ok: true as const, publishedRows: controlRows };
}
