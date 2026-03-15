import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';

export type UploadFormOptions = {
  modules: { value: string; label: string }[];
  versions: { value: string; label: string; periodMonth: string }[];
};

const businessExcellenceSourceModules = [
  { value: 'business_excellence_ddd', label: 'Business Excellence - DDD' },
  { value: 'business_excellence_budget_sell_out', label: 'Business Excellence - Budget Sell Out' },
  { value: 'business_excellence_brick_assignment', label: 'Business Excellence - Brick Assignment' },
  { value: 'business_excellence_iqvia_weekly', label: 'Business Excellence - Weekly Tracking' },
  { value: 'business_excellence_closeup', label: 'Business Excellence - Closeup' },
  { value: 'business_excellence_cuotas', label: 'Business Excellence - Cuotas' },
  { value: 'human_resources_turnover', label: 'Human Resources - Turnover' },
  { value: 'human_resources_training', label: 'Human Resources - Training' },
];

export async function getUploadFormOptions(): Promise<UploadFormOptions> {
  const client = getBigQueryClient();

  const modulesQuery = `
    SELECT
      module_code,
      module_name
    FROM \`chiesi-committee.chiesi_committee_core.dim_module\`
    WHERE is_active = TRUE
    ORDER BY module_name
  `;

  const versionsQuery = `
    SELECT
      reporting_version_id,
      CAST(period_month AS STRING) AS period_month,
      version_name
    FROM \`chiesi-committee.chiesi_committee_admin.reporting_versions\`
    ORDER BY period_month DESC, version_number DESC, created_at DESC
  `;

  const [[moduleRows], [versionRows]] = await Promise.all([
    client.query({ query: modulesQuery }),
    client.query({ query: versionsQuery }),
  ]);

  const typedModuleRows = moduleRows as Array<{ module_code: string; module_name: string }>;
  const typedVersionRows = versionRows as Array<{
    reporting_version_id: string;
    period_month: string;
    version_name: string;
  }>;

  const modulesFromCore = typedModuleRows.map((row) => ({
    value: row.module_code,
    label: row.module_name,
  }));

  const moduleMap = new Map<string, { value: string; label: string }>();
  for (const moduleItem of [...modulesFromCore, ...businessExcellenceSourceModules]) {
    moduleMap.set(moduleItem.value, moduleItem);
  }

  return {
    modules: [...moduleMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
    versions: typedVersionRows.map((row) => ({
      value: row.reporting_version_id,
      label: `${row.period_month} - ${row.version_name}`,
      periodMonth: String(row.period_month),
    })),
  };
}
