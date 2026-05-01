import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';

export type ReportingVersionStatus = 'draft' | 'ready_to_show' | 'closed';

export type ReportingVersionOption = {
  reportingVersionId: string;
  periodMonth: string;
  versionName: string;
  status: ReportingVersionStatus;
};

type GetReportingVersionsOptions = {
  statuses?: ReportingVersionStatus[];
};

function normalizeStatus(value: unknown): ReportingVersionStatus {
  if (value === 'ready_to_show' || value === 'closed') return value;
  return 'draft';
}

export async function getReportingVersions(options: GetReportingVersionsOptions = {}): Promise<ReportingVersionOption[]> {
  const client = getBigQueryClient();
  const statuses = options.statuses ?? [];

  const query = `
    SELECT
      reporting_version_id,
      CAST(period_month AS STRING) AS period_month,
      version_name,
      status
    FROM \`chiesi-committee.chiesi_committee_admin.reporting_versions\`
    ${statuses.length > 0 ? 'WHERE status IN UNNEST(@statuses)' : ''}
    ORDER BY period_month DESC, version_number DESC, created_at DESC
  `;

  const [rows] = await client.query({
    query,
    params: statuses.length > 0 ? { statuses } : undefined,
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    reportingVersionId: String(row.reporting_version_id ?? ''),
    periodMonth: String(row.period_month ?? ''),
    versionName: String(row.version_name ?? ''),
    status: normalizeStatus(row.status),
  }));
}
