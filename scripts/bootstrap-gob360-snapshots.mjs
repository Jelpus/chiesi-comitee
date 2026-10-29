// One-time release loader. Run with Node 22 --experimental-strip-types.
// The default is inspection; --stage writes both snapshots; --activate publishes them.
import { createHash } from 'node:crypto';
import { createWriteStream, readFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { parseGob360Snapshot } from '../lib/uploads/gob360-snapshot-parser.ts';

const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const mode = args.includes('--stage') ? 'stage' : args.includes('--activate') ? 'activate' : 'inspect';
const reportingVersionId = option('--version');
const periodMonth = option('--period');
const sourceFiles = [
  { moduleCode: 'business_excellence_gob360_air', path: option('--air'), cutoff: option('--air-cutoff') },
  { moduleCode: 'business_excellence_gob360_care', path: option('--care'), cutoff: option('--care-cutoff') },
];
if (!reportingVersionId || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(periodMonth ?? '') ||
    sourceFiles.some((item) => !item.path || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(item.cutoff ?? '')) ||
    sourceFiles.some((item) => item.cutoff > periodMonth)) {
  throw new Error('Provide --version, --period YYYY-MM-01, --air, --air-cutoff, --care, --care-cutoff.');
}

const credentials = {
  client_email: process.env.GCP_CLIENT_EMAIL,
  private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, credentials });
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID, credentials });
const bucket = storage.bucket(process.env.GCS_UPLOAD_BUCKET);
const uploads = '`chiesi-committee.chiesi_committee_raw.uploads`';
const manifest = '`chiesi-committee.gob360_snapshots.manifest`';
const pieces = '`chiesi-committee.gob360_snapshots.pieces`';

function snapshotId(moduleCode, cutoff, sha256) {
  const hex = createHash('sha256').update(`${moduleCode}|${reportingVersionId}|${cutoff}|${sha256}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function getUpload(uploadId) {
  const [rows] = await bq.query({
    query: `SELECT status FROM ${uploads} WHERE upload_id = @uploadId LIMIT 1`,
    params: { uploadId }, location: 'EU',
  });
  return rows[0]?.status ?? null;
}

async function putSource(item) {
  const object = `committee_uploads/${periodMonth}/${item.moduleCode}/${item.uploadId}_${basename(item.path)}`;
  const remote = bucket.file(object);
  const [exists] = await remote.exists();
  if (exists) {
    const [metadata] = await remote.getMetadata();
    if (metadata.metadata?.source_sha256 !== item.sha256) throw new Error(`GCS hash mismatch for ${item.moduleCode}`);
  } else {
    await remote.save(item.buffer, {
      resumable: false,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      metadata: { metadata: {
        upload_id: item.uploadId, module_code: item.moduleCode,
        period_month: periodMonth, reporting_version_id: reportingVersionId,
        selected_sheet_name: item.preview.sheetName, header_row: '3',
        source_sha256: item.sha256,
      } },
    });
  }
  return `gs://${bucket.name}/${object}`;
}

async function insertUpload(item, storagePath) {
  if (await getUpload(item.uploadId)) return;
  await bq.query({
    query: `INSERT INTO ${uploads} (
      upload_id,module_code,period_month,uploaded_by,uploaded_at,source_file_name,
      storage_path,status,rows_total,rows_valid,rows_error,reporting_version_id,
      source_sheets_json,selected_sheet_name,selected_header_row,source_as_of_month,ddd_source
    ) VALUES (
      @uploadId,@moduleCode,DATE(@periodMonth),'release_gob360_snapshot',CURRENT_TIMESTAMP(),@fileName,
      @storagePath,'uploaded',0,0,0,@reportingVersionId,PARSE_JSON(@sheets),@sheetName,3,DATE(@cutoff),NULL
    )`,
    params: {
      uploadId: item.uploadId, moduleCode: item.moduleCode, periodMonth,
      fileName: basename(item.path), storagePath, reportingVersionId,
      sheets: JSON.stringify([item.preview.sheetName]), sheetName: item.preview.sheetName,
      cutoff: item.cutoff,
    },
    location: 'EU',
  });
}

async function writeNdjson(item) {
  const filePath = join(tmpdir(), `gob360-release-${item.uploadId}.ndjson`);
  const stream = createWriteStream(filePath, { encoding: 'utf8' });
  for (const row of item.preview.rows) {
    const record = {
      snapshot_id: item.uploadId, module_code: item.moduleCode,
      clave: row.clave, clave_normalized: row.claveNormalized,
      clue: row.clue, clue_normalized: row.clue.trim().toUpperCase(),
      period_month: row.periodMonth, pieces: row.pieces,
    };
    if (!stream.write(`${JSON.stringify(record)}\n`)) await once(stream, 'drain');
  }
  stream.end();
  await once(stream, 'finish');
  return filePath;
}

async function stage(item) {
  const [manifestRows] = await bq.query({
    query: `SELECT status FROM ${manifest} WHERE snapshot_id = @uploadId LIMIT 1`,
    params: { uploadId: item.uploadId }, location: 'US',
  });
  if (manifestRows[0]?.status === 'active') return;
  const storagePath = await putSource(item);
  await insertUpload(item, storagePath);
  const filePath = await writeNdjson(item);
  try {
    await bq.query({ query: `DELETE FROM ${pieces} WHERE snapshot_id = @uploadId`, params: { uploadId: item.uploadId }, location: 'US' });
    await bq.dataset('gob360_snapshots').table('pieces').load(filePath, {
      sourceFormat: 'NEWLINE_DELIMITED_JSON', writeDisposition: 'WRITE_APPEND', location: 'US',
    });
  } finally {
    await unlink(filePath).catch(() => undefined);
  }
  const [totals] = await bq.query({
    query: `SELECT CAST(period_month AS STRING) month,COUNT(*) controls,SUM(pieces) total
      FROM ${pieces} WHERE snapshot_id = @uploadId GROUP BY period_month ORDER BY period_month`,
    params: { uploadId: item.uploadId }, location: 'US',
  });
  if (totals.reduce((sum, row) => sum + Number(row.controls), 0) !== item.preview.controlRows ||
      totals.length !== item.preview.includedMonths.length ||
      totals.some((row, index) => row.month !== item.preview.includedMonths[index].periodMonth ||
        Math.abs(Number(row.total) - item.preview.includedMonths[index].sourceTotal) > 1e-6)) {
    throw new Error(`BigQuery reconciliation failed for ${item.moduleCode}`);
  }
  await bq.query({
    query: `MERGE ${manifest} target USING (SELECT @uploadId snapshot_id) source
      ON target.snapshot_id=source.snapshot_id
      WHEN MATCHED THEN UPDATE SET module_code=@moduleCode,reporting_version_id=@reportingVersionId,
        validated_through_month=DATE(@cutoff),source_file_name=@fileName,source_sha256=@sha256,
        source_rows=@sourceRows,control_rows=@controlRows,status='staged'
      WHEN NOT MATCHED THEN INSERT (snapshot_id,module_code,reporting_version_id,validated_through_month,
        source_file_name,source_sha256,source_rows,control_rows,status,created_at)
      VALUES (@uploadId,@moduleCode,@reportingVersionId,DATE(@cutoff),@fileName,@sha256,@sourceRows,
        @controlRows,'staged',CURRENT_TIMESTAMP())`,
    params: { uploadId:item.uploadId,moduleCode:item.moduleCode,reportingVersionId,cutoff:item.cutoff,
      fileName:basename(item.path),sha256:item.sha256,sourceRows:item.preview.sourceRows,
      controlRows:item.preview.controlRows }, location:'US',
  });
  await bq.query({
    query: `UPDATE ${uploads} SET status='normalized',rows_total=@sourceRows,rows_valid=@sourceRows,
      rows_error=0 WHERE upload_id=@uploadId`,
    params: { uploadId:item.uploadId,sourceRows:item.preview.sourceRows }, location:'EU',
  });
  console.log('staged',item.moduleCode,item.uploadId,item.preview.controlRows,totals.map(row=>`${row.month}:${row.total}`).join(','));
}

async function activate(item) {
  const [rows] = await bq.query({
    query: `SELECT status,control_rows,source_sha256 FROM ${manifest} WHERE snapshot_id=@uploadId LIMIT 1`,
    params: { uploadId:item.uploadId }, location:'US',
  });
  if (!rows[0] || rows[0].source_sha256 !== item.sha256 || Number(rows[0].control_rows) !== item.preview.controlRows) {
    throw new Error(`Staged snapshot mismatch for ${item.moduleCode}`);
  }
  if (rows[0].status !== 'active') {
    if (rows[0].status !== 'staged') throw new Error(`Invalid manifest status ${rows[0].status}`);
    await bq.query({
      query: `BEGIN TRANSACTION;
        UPDATE ${manifest} SET status='archived' WHERE module_code=@moduleCode AND status='active';
        UPDATE ${manifest} SET status='active',published_at=CURRENT_TIMESTAMP()
        WHERE snapshot_id=@uploadId AND status='staged';
        COMMIT TRANSACTION;`,
      params: { moduleCode:item.moduleCode,uploadId:item.uploadId }, location:'US',
    });
  }
  await bq.query({
    query: `UPDATE ${uploads} SET status='published' WHERE upload_id=@uploadId`,
    params: { uploadId:item.uploadId }, location:'EU',
  });
  console.log('activated',item.moduleCode,item.uploadId);
}

const [versions] = await bq.query({
  query: `SELECT status FROM \`chiesi-committee.chiesi_committee_admin.reporting_versions\`
    WHERE reporting_version_id=@reportingVersionId AND period_month=DATE(@periodMonth) LIMIT 1`,
  params: { reportingVersionId,periodMonth },location:'EU',
});
if (!versions[0] || versions[0].status === 'closed') throw new Error('Reporting version is missing or closed.');
const items = sourceFiles.map((item) => {
  const buffer = readFileSync(item.path);
  const preview = parseGob360Snapshot(buffer,item.moduleCode,item.cutoff);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  return { ...item,buffer,preview,sha256,uploadId:snapshotId(item.moduleCode,item.cutoff,sha256) };
});
for (const item of items) console.log('inspection',item.moduleCode,item.uploadId,
  'sourceRows',item.preview.sourceRows,'controls',item.preview.controlRows,
  'included',item.preview.includedMonths.map(m=>m.periodMonth).join(','),
  'excluded',item.preview.excludedMonths.join(','));
if (mode === 'stage') for (const item of items) await stage(item);
if (mode === 'activate') for (const item of items) await activate(item);
