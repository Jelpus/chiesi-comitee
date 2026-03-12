import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';

export type ReportingVersionOption = {
  reportingVersionId: string;
  periodMonth: string;
  versionName: string;
};

export async function getReportingVersions(): Promise<ReportingVersionOption[]> {
  const client = getBigQueryClient();

  const query = `
    SELECT
      reporting_version_id,
      CAST(period_month AS STRING) AS period_month,
      version_name
    FROM \`chiesi-committee.chiesi_committee_admin.reporting_versions\`
    ORDER BY period_month DESC, version_number DESC, created_at DESC
  `;

  const [rows] = await client.query({ query });

  return rows.map((row: any) => ({
    reportingVersionId: row.reporting_version_id,
    periodMonth: row.period_month,
    versionName: row.version_name,
  }));
}