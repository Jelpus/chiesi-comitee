/* eslint-disable @typescript-eslint/no-require-imports */
// Run from the repository root with: node --env-file=.env.local scripts/recover-uploads.cjs --ids=id1,id2 --run
// Without --run this only reports the selected uploads.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const ids = (option('--ids') || '').split(',').map((id) => id.trim()).filter(Boolean);
const excludedId = '77697ab2-b57a-4e4b-b11f-0a6f6b93c66b';
const run = args.includes('--run');
const republish = args.includes('--republish');
const renormalize = args.includes('--renormalize');
const stopAfterNormalize = args.includes('--stop-after-normalize');

if (!ids.length || ids.some((id) => !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))) {
  throw new Error('Pass one or more UUIDs with --ids=id1,id2.');
}
if (ids.includes(excludedId)) throw new Error(`Excluded upload ${excludedId} cannot be recovered by this script.`);

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(root, request.slice(2));
  if (request === 'server-only' || request === 'next/cache') return request;
  return originalResolve.call(this, request, parent, ...rest);
};
const originalLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === 'server-only') return {};
  if (request === 'next/cache') return { revalidatePath() {} };
  return originalLoad.call(this, request, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  module._compile(compiled, filename);
};

const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const credentials = {
  client_email: process.env.GCP_CLIENT_EMAIL,
  private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};
const bigQuery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID, credentials });
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID, credentials });
const { processUpload, normalizeExistingUpload, publishUpload } = require('../app/admin/uploads/actions.ts');

const stagingByModule = {
  business_excellence_closeup: 'stg_business_excellence_closeup',
  business_excellence_iqvia_weekly: 'stg_business_excellence_weekly_tracking',
  business_excellence_brick_assignment: 'stg_business_excellence_brick_assignment',
  business_excellence_budget_sell_out: 'stg_business_excellence_budget_sell_out',
  business_excellence_ddd: 'stg_business_excellence_pmm',
};

async function getUpload(id) {
  const [rows] = await bigQuery.query({
    query: `SELECT upload_id, module_code, source_file_name, storage_path, status, rows_total, rows_valid, rows_error, last_error_message FROM \`chiesi-committee.chiesi_committee_raw.uploads\` WHERE upload_id = @id`,
    params: { id },
  });
  if (rows.length !== 1) throw new Error(`Expected one upload row for ${id}; found ${rows.length}.`);
  return rows[0];
}

async function countRows(table, id) {
  const [rows] = await bigQuery.query({
    query: `SELECT COUNT(*) AS total FROM \`chiesi-committee.${table}\` WHERE upload_id = @id`,
    params: { id },
  });
  return Number(rows[0]?.total || 0);
}

async function inspect(id) {
  const upload = await getUpload(id);
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(upload.storage_path || '');
  if (!match) throw new Error(`${id}: invalid storage path`);
  const [exists] = await storage.bucket(match[1]).file(match[2]).exists();
  const raw = await countRows('chiesi_committee_raw.upload_rows_raw', id);
  const stagingTable = stagingByModule[upload.module_code];
  if (!stagingTable) throw new Error(`${id}: no staging table configured for ${upload.module_code}`);
  const staging = await countRows(`chiesi_committee_stg.${stagingTable}`, id);
  return { upload, sourceExists: exists, raw, staging };
}

async function recover(id) {
  let state = await inspect(id);
  console.log(JSON.stringify({ id, status: state.upload.status, module: state.upload.module_code, file: state.upload.source_file_name, sourceExists: state.sourceExists, raw: state.raw, staging: state.staging }));
  if (!run || (state.upload.status === 'published' && !republish && !renormalize)) return;
  if (!state.sourceExists) throw new Error(`${id}: source file missing`);
  if (['uploaded', 'error', 'parsing', 'loading_raw'].includes(state.upload.status)) {
    await processUpload(id);
    state = await inspect(id);
    if (state.upload.status !== 'raw_loaded' || state.raw < 1 || state.raw !== Number(state.upload.rows_total)) {
      throw new Error(`${id}: RAW verification failed`);
    }
    console.log(JSON.stringify({ id, phase: 'raw_loaded', raw: state.raw }));
  }
  if (['raw_loaded', 'normalizing'].includes(state.upload.status) || (renormalize && state.upload.status === 'published')) {
    let result;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      result = await normalizeExistingUpload(id);
      state = await inspect(id);
      if (result.phase !== 'normalizing') break;
      if (state.upload.status !== 'normalizing' || state.staging < 1) throw new Error(`${id}: checkpoint verification failed`);
      console.log(JSON.stringify({ id, phase: 'normalizing', staging: state.staging }));
    }
    if (!result) throw new Error(`${id}: normalization did not start`);
    if (result.phase !== 'normalized' || state.upload.status !== 'normalized' || state.staging < 1 || state.staging !== result.normalizedRows) {
      throw new Error(`${id}: normalization verification failed; status=${state.upload.status}, staging=${state.staging}`);
    }
    console.log(JSON.stringify({ id, phase: 'normalized', staging: state.staging, valid: state.upload.rows_valid, errors: state.upload.rows_error }));
  }
  if (!stopAfterNormalize && (state.upload.status === 'normalized' || (state.upload.status === 'published' && republish))) {
    if (state.staging < 1) throw new Error(`${id}: cannot publish empty staging`);
    const result = await publishUpload(id);
    state = await inspect(id);
    if (state.upload.status !== 'published' || result.publishedRows < 1) throw new Error(`${id}: publish verification failed`);
    console.log(JSON.stringify({ id, phase: 'published', publishedRows: result.publishedRows, staging: state.staging }));
  }
}

(async () => {
  for (const id of ids) {
    try { await recover(id); }
    catch (error) { console.error(JSON.stringify({ id, error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
