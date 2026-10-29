import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Job } from '@google-cloud/bigquery';
import { getGob360BigQueryClient, getGob360TableRefs } from './gob360-client';

const MIRROR_PROJECT = 'chiesi-committee';
const MIRROR_DATASET = 'gob360_mirror';

const SOURCES = [
  { key: 'pc', sourceName: 'pcSalesTable', mirrorName: 'pc_sales_source' },
  { key: 'sc', sourceName: 'scSalesTable', mirrorName: 'sc_sales_source' },
] as const;

async function waitForJob(job: Job) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const [metadata] = await job.getMetadata();
    if (metadata.status?.state === 'DONE') {
      if (metadata.status.errorResult) {
        throw new Error(metadata.status.errorResult.message || 'BigQuery job failed.');
      }
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('BigQuery mirror refresh timed out while waiting for the job.');
}

export async function refreshGob360Mirror() {
  const client = getGob360BigQueryClient(true);
  const refs = getGob360TableRefs();
  const dataset = client.dataset(MIRROR_DATASET, { projectId: MIRROR_PROJECT });
  const results: Array<{ source: string; rows: number; refreshedAt: string }> = [];

  for (const item of SOURCES) {
    const source = client.dataset(refs.datasetId, { projectId: refs.projectId }).table(refs[item.sourceName]);
    const live = dataset.table(item.mirrorName);
    const stage = dataset.table(`${item.mirrorName}_stage_${randomUUID().replaceAll('-', '')}`);
    const [sourceMetadata] = await source.getMetadata();
    const sourceRows = Number(sourceMetadata.numRows ?? 0);
    if (!Number.isSafeInteger(sourceRows) || sourceRows < 1) {
      throw new Error(`GOB360 ${item.key}: source has no valid rows.`);
    }

    try {
      const [liveExists] = await live.exists();
      if (liveExists) {
        const [liveMetadata] = await live.getMetadata();
        const previousRows = Number(liveMetadata.numRows ?? 0);
        if (previousRows > 0 && sourceRows < previousRows * 0.9) {
          throw new Error(`GOB360 ${item.key}: source row count dropped by more than 10%.`);
        }
      }

      const [queryJob] = await client.createQueryJob({
        query: `SELECT * FROM \`${refs.projectId}.${refs.datasetId}.${refs[item.sourceName]}\``,
        destination: stage,
        writeDisposition: 'WRITE_EMPTY',
        location: 'US',
      });
      await waitForJob(queryJob);
      const [stageMetadata] = await stage.getMetadata();
      const stagedRows = Number(stageMetadata.numRows ?? 0);
      if (stagedRows !== sourceRows) {
        throw new Error(`GOB360 ${item.key}: staged ${stagedRows} rows, source metadata has ${sourceRows}.`);
      }

      await stage.copy(live, { writeDisposition: 'WRITE_TRUNCATE' });
      const [liveMetadata] = await live.getMetadata();
      if (Number(liveMetadata.numRows ?? 0) !== sourceRows) {
        throw new Error(`GOB360 ${item.key}: published row count differs from source.`);
      }
      results.push({
        source: item.key,
        rows: sourceRows,
        refreshedAt: new Date(Number(liveMetadata.lastModifiedTime)).toISOString(),
      });
    } finally {
      await stage.delete({ ignoreNotFound: true }).catch(() => undefined);
    }
  }
  return { ok: true as const, results };
}
