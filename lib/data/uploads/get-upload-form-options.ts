import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { getActiveModuleOptions } from '@/lib/data/modules';
import type { ModuleAreaCode } from '@/lib/data/modules';

export type UploadFormOptions = {
  modules: { value: string; label: string; areaCode: ModuleAreaCode }[];
  versions: { value: string; label: string; periodMonth: string }[];
};

export async function getUploadFormOptions(): Promise<UploadFormOptions> {
  const client = getBigQueryClient();

  const versionsQuery = `
    SELECT
      reporting_version_id,
      CAST(period_month AS STRING) AS period_month,
      version_name
    FROM \`chiesi-committee.chiesi_committee_admin.reporting_versions\`
    ORDER BY period_month DESC, version_number DESC, created_at DESC
  `;

  const [modules, [versionRows]] = await Promise.all([
    getActiveModuleOptions(),
    client.query({ query: versionsQuery }),
  ]);

  const typedVersionRows = versionRows as Array<{
    reporting_version_id: string;
    period_month: string;
    version_name: string;
  }>;

  return {
    modules,
    versions: typedVersionRows.map((row) => ({
      value: row.reporting_version_id,
      label: `${row.period_month} - ${row.version_name}`,
      periodMonth: String(row.period_month),
    })),
  };
}
