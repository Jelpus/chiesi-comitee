import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';

export type VersionRow = {
  reportingVersionId: string;
  periodMonth: string;
  versionName: string;
  versionNumber: number;
  status: string;
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

  return rows.map((row: any) => ({
    reportingVersionId: row.reporting_version_id,
    periodMonth: row.period_month,
    versionName: row.version_name,
    versionNumber: Number(row.version_number ?? 0),
    status: row.status ?? 'draft',
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '-',
    notes: row.notes ?? null,
  }));
}