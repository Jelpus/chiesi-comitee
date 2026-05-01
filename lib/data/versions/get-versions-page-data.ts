import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import type { ReportingVersionStatus } from './get-reporting-versions';

export type VersionRow = {
  reportingVersionId: string;
  periodMonth: string;
  versionName: string;
  versionNumber: number;
  status: ReportingVersionStatus;
  createdAt: string;
  createdBy: string;
  notes: string | null;
};

export async function getVersionsPageData(): Promise<VersionRow[]> {
  const client = getBigQueryClient();

  const query = `
    SELECT
      reporting_version_id,
      CAST(period_month AS STRING) AS period_month,
      version_name,
      version_number,
      status,
      CAST(created_at AS STRING) AS created_at,
      created_by,
      notes
    FROM \`chiesi-committee.chiesi_committee_admin.reporting_versions\`
    ORDER BY period_month DESC, version_number DESC, created_at DESC
  `;

  const [rows] = await client.query({ query });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    reportingVersionId: String(row.reporting_version_id ?? ''),
    periodMonth: String(row.period_month ?? ''),
    versionName: String(row.version_name ?? ''),
    versionNumber: Number(row.version_number ?? 0),
    status: row.status === 'ready_to_show' || row.status === 'closed' ? row.status : 'draft',
    createdAt: String(row.created_at ?? ''),
    createdBy: String(row.created_by ?? '-'),
    notes: row.notes == null ? null : String(row.notes),
  }));
}
