import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';

type LatestReportingVersion = {
  reporting_version_id: string;
  period_month: string;
  version_name: string;
};

function toPrimitiveString(value: unknown): string {
  if (value == null) return '';

  if (typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    const wrappedValue = (value as { value: unknown }).value;
    return wrappedValue == null ? '' : String(wrappedValue);
  }

  return String(value);
}

export async function getLatestReportingVersion(): Promise<LatestReportingVersion> {
  const client = getBigQueryClient();

  const query = `
    SELECT
      reporting_version_id,
      period_month,
      version_name
    FROM \`chiesi-committee.chiesi_committee_admin.reporting_versions\`
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const [rows] = await client.query({ query });
  const row = rows[0] as Record<string, unknown> | undefined;

  if (!row) {
    throw new Error('No reporting versions found in BigQuery.');
  }

  return {
    reporting_version_id: toPrimitiveString(row.reporting_version_id),
    period_month: toPrimitiveString(row.period_month),
    version_name: toPrimitiveString(row.version_name),
  };
}
