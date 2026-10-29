// One-time migration. Default mode inspects; --apply creates the restricted mirror,
// copies the source tables, authorizes the effective views and switches their SQL.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const { BigQuery } = require('@google-cloud/bigquery');

const committeeProject = 'chiesi-committee';
const mirrorDatasetId = 'gob360_mirror';
const snapshotDatasetId = 'gob360_snapshots';
const sourceProject = process.env.GOB360_PROJECT_ID;
const sourceDataset = process.env.GOB360_DATASET_ID || 'CHIESI_EXTERNAL';
const sources = [
  { name: 'pc', source: process.env.GOB360_PC_TABLE || 'CHIESI_PC_VENTAS_EXTERNAL', mirror: 'pc_sales_source', viewSql: 'sql/views/vw_gob360_pc_sales_effective.sql', view: 'vw_pc_sales_effective' },
  { name: 'sc', source: process.env.GOB360_SC_TABLE || 'CHIESI_SC_VENTAS_EXTERNAL', mirror: 'sc_sales_source', viewSql: 'sql/views/vw_gob360_sc_sales_effective.sql', view: 'vw_sc_sales_effective' },
];
const committee = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});
const gob = new BigQuery({
  projectId: sourceProject,
  credentials: {
    client_email: process.env.GOB360_CLIENT_EMAIL,
    private_key: process.env.GOB360_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

if (!sourceProject || !process.env.GOB360_CLIENT_EMAIL || !process.env.GOB360_PRIVATE_KEY ||
    !process.env.GCP_CLIENT_EMAIL || !process.env.GCP_PRIVATE_KEY) {
  throw new Error('Missing Committee or GOB360 credentials.');
}

async function waitForJob(job) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const [metadata] = await job.getMetadata();
    if (metadata.status?.state === 'DONE') {
      if (metadata.status.errorResult) throw new Error(metadata.status.errorResult.message);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('BigQuery job timed out.');
}

async function ensureMirrorDataset() {
  const dataset = committee.dataset(mirrorDatasetId);
  const [exists] = await dataset.exists();
  const desired = [
    { role: 'OWNER', specialGroup: 'projectOwners' },
    { role: 'OWNER', userByEmail: process.env.GCP_CLIENT_EMAIL },
    { role: 'WRITER', userByEmail: process.env.GOB360_CLIENT_EMAIL },
    ...sources.map(({view}) => ({view:{projectId:committeeProject,datasetId:snapshotDatasetId,tableId:view}})),
  ];
  if (!exists) {
    await dataset.create({ location: 'US', access: desired });
  }
  const [metadata] = await dataset.getMetadata();
  if (metadata.location?.toUpperCase() !== 'US') throw new Error('Mirror dataset must be in US.');
  if (exists && metadata.access?.some((entry) => entry.specialGroup === 'projectReaders' || entry.specialGroup === 'projectWriters')) {
    throw new Error('Existing mirror dataset has broad project access; review its ACL before setup.');
  }
  const current = metadata.access ?? [];
  const additions = desired.filter((entry) => !current.some((prior) => JSON.stringify(prior) === JSON.stringify(entry)));
  await dataset.setMetadata({ access: [...current, ...additions] });
  const [confirmed] = await dataset.getMetadata();
  if (confirmed.access?.some((entry) => entry.specialGroup === 'projectReaders' || entry.specialGroup === 'projectWriters')) {
    throw new Error('Mirror dataset still has broad project access.');
  }
  for (const {view} of sources) {
    if (!confirmed.access?.some((entry) => entry.view?.projectId === committeeProject && entry.view?.datasetId === snapshotDatasetId && entry.view?.tableId === view)) {
      throw new Error(`View ${view} was not authorized on mirror dataset.`);
    }
  }
  return dataset;
}

async function refreshSource(item) {
  const source = gob.dataset(sourceDataset, {projectId:sourceProject}).table(item.source);
  const mirrorDataset = gob.dataset(mirrorDatasetId, {projectId:committeeProject});
  const live = mirrorDataset.table(item.mirror);
  const stage = mirrorDataset.table(`${item.mirror}_stage_${randomUUID().replaceAll('-', '')}`);
  const [sourceMetadata] = await source.getMetadata();
  const expectedRows = Number(sourceMetadata.numRows ?? 0);
  if (!Number.isSafeInteger(expectedRows) || expectedRows < 1) throw new Error(`${item.name} source is empty.`);
  try {
    const [liveExists] = await live.exists();
    if (liveExists) {
      const [oldMetadata] = await live.getMetadata();
      if (expectedRows < Number(oldMetadata.numRows ?? 0) * 0.9) throw new Error(`${item.name} source row count dropped by more than 10%.`);
    }
    const [queryJob] = await gob.createQueryJob({
      query: `SELECT * FROM \`${sourceProject}.${sourceDataset}.${item.source}\``,
      destination: stage,
      writeDisposition: 'WRITE_EMPTY',
      location: 'US',
    });
    await waitForJob(queryJob);
    const [stageMetadata] = await stage.getMetadata();
    if (Number(stageMetadata.numRows ?? 0) !== expectedRows) throw new Error(`${item.name} staged count differs from source.`);
    await stage.copy(live, {writeDisposition:'WRITE_TRUNCATE'});
    const [liveMetadata] = await live.getMetadata();
    if (Number(liveMetadata.numRows ?? 0) !== expectedRows) throw new Error(`${item.name} published count differs from source.`);
    console.log(JSON.stringify({source:item.name, rows:expectedRows, refreshedAt:new Date(Number(liveMetadata.lastModifiedTime)).toISOString()}));
  } finally {
    await stage.delete({ignoreNotFound:true}).catch(() => undefined);
  }
}

async function inspect() {
  const dataset = committee.dataset(mirrorDatasetId);
  const [exists] = await dataset.exists();
  console.log(JSON.stringify({mirrorDatasetExists:exists}));
  if (!exists) return;
  const [metadata] = await dataset.getMetadata();
  console.log(JSON.stringify({location:metadata.location, authorizedViews:metadata.access?.filter((item)=>item.view).map((item)=>item.view), hasBroadReaders:metadata.access?.some((item)=>item.specialGroup==='projectReaders'||item.specialGroup==='projectWriters')}));
  for (const item of sources) {
    const table = dataset.table(item.mirror);
    const [tableExists] = await table.exists();
    if (!tableExists) { console.log(JSON.stringify({source:item.name, exists:false})); continue; }
    const [tableMetadata] = await table.getMetadata();
    console.log(JSON.stringify({source:item.name, rows:Number(tableMetadata.numRows), refreshedAt:new Date(Number(tableMetadata.lastModifiedTime)).toISOString()}));
  }
}

if (process.argv.includes('--apply')) {
  await ensureMirrorDataset();
  for (const item of sources) await refreshSource(item);
  for (const item of sources) {
    const sql = readFileSync(item.viewSql, 'utf8');
    await committee.query({query:sql,location:'US'});
    console.log(JSON.stringify({view:item.view, switchedToMirror:true}));
  }
  await inspect();
} else {
  await inspect();
}
