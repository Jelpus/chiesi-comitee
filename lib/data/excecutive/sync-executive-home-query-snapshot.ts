import 'server-only';

import { getBigQueryClient } from '@/lib/bigquery/client';
import { getExecutiveHomeQueryRows } from './get-executive-home-query';

const SNAPSHOT_TABLE = 'chiesi-committee.chiesi_committee_mart.mart_executive_home_query_snapshot';

const AREA_LABELS: Record<string, string> = {
  internal_sales: 'Internal Sales',
  commercial_operations: 'Commercial Operations',
  business_excellence: 'Business Excellence',
  medical: 'Medical',
  opex: 'Opex',
  human_resources: 'Human Resources',
  ra_quality_fv: 'RA - Quality - FV',
  legal_compliance: 'Legal & Compliance',
};

function toAreaLabel(value: string) {
  const normalized = value.toLowerCase().trim();
  const mapped = AREA_LABELS[normalized];
  if (mapped) return mapped;
  return normalized
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function isBigQueryUpdateRateLimitError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('job exceeded rate limits') ||
    message.includes('table exceeded quota for table update operations') ||
    message.includes('exceeded quota for table update operations')
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryWithRetry<T>(run: () => Promise<T>, maxAttempts = 6): Promise<T> {
  let attempt = 0;
  let delayMs = 1200;
  while (true) {
    try {
      return await run();
    } catch (error) {
      attempt += 1;
      if (!isBigQueryUpdateRateLimitError(error) || attempt >= maxAttempts) {
        throw error;
      }
      await sleep(delayMs);
      delayMs *= 2;
    }
  }
}

let ensurePromise: Promise<void> | null = null;
async function ensureSnapshotTable() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const client = getBigQueryClient();
      await queryWithRetry(() =>
        client.query({
          query: `
            CREATE TABLE IF NOT EXISTS \`${SNAPSHOT_TABLE}\` (
              period DATE,
              version STRING,
              area STRING,
              area_code STRING,
              area_order INT64,
              main_kpi_value STRING,
              target_value STRING,
              variance_value STRING,
              landing_url STRING,
              updated_at TIMESTAMP
            )
          `,
        }),
      );
      await queryWithRetry(() =>
        client.query({
          query: `ALTER TABLE \`${SNAPSHOT_TABLE}\` ADD COLUMN IF NOT EXISTS area_code STRING`,
        }),
      );
      await queryWithRetry(() =>
        client.query({
          query: `ALTER TABLE \`${SNAPSHOT_TABLE}\` ADD COLUMN IF NOT EXISTS area_order INT64`,
        }),
      );
    })();
  }
  await ensurePromise;
}

export async function syncExecutiveHomeQuerySnapshot(reportingVersionId?: string) {
  await ensureSnapshotTable();
  const rows = await getExecutiveHomeQueryRows({ reportingVersionId });
  const client = getBigQueryClient();

  if (rows.length === 0) {
    return { ok: true as const, upserted: 0 };
  }

  const rowsWithPresentation = rows.map((row, index) => ({
    ...row,
    area_code: row.area,
    area: toAreaLabel(row.area),
    area_order: index + 1,
  }));

  const versions = [...new Set(rows.map((row) => row.version))];
  await queryWithRetry(() =>
    client.query({
      query: `
        DELETE FROM \`${SNAPSHOT_TABLE}\`
        WHERE version IN UNNEST(@versions)
      `,
      params: { versions },
    }),
  );

  await queryWithRetry(() =>
    client.query({
      query: `
        INSERT INTO \`${SNAPSHOT_TABLE}\`
        (period, version, area, area_code, area_order, main_kpi_value, target_value, variance_value, landing_url, updated_at)
        SELECT
          DATE(row.period),
          row.version,
          row.area,
          row.area_code,
          row.area_order,
          row.main_kpi_value,
          row.target_value,
          row.variance_value,
          row.landing_url,
          CURRENT_TIMESTAMP()
        FROM UNNEST(@rows) AS row
      `,
      params: {
        rows: rowsWithPresentation.map((row) => ({
          period: row.period,
          version: row.version,
          area: row.area,
          area_code: row.area_code,
          area_order: row.area_order,
          main_kpi_value: row.main_kpi_value,
          target_value: row.target_value,
          variance_value: row.variance_value,
          landing_url: row.landing_url,
        })),
      },
    }),
  );

  return { ok: true as const, upserted: rows.length };
}
