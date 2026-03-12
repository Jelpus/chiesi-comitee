import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { refreshSalesInternalServingArtifacts } from '@/lib/serving/refresh-sales-internal-serving';

type UploadPublishContext = {
  uploadId: string;
  moduleCode: string;
  periodMonth: string;
  reportingVersionId: string;
};

async function getPublishContext(uploadId: string): Promise<UploadPublishContext> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        upload_id,
        module_code,
        CAST(period_month AS STRING) AS period_month,
        reporting_version_id
      FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
      WHERE upload_id = @uploadId
      LIMIT 1
    `,
    params: { uploadId },
  });

  const row = (rows as Record<string, unknown>[])[0];
  if (!row) {
    throw new Error(`Upload not found for publish: ${uploadId}.`);
  }

  return {
    uploadId: String(row.upload_id ?? ''),
    moduleCode: String(row.module_code ?? ''),
    periodMonth: String(row.period_month ?? ''),
    reportingVersionId: String(row.reporting_version_id ?? ''),
  };
}

async function publishSalesInternalUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();

  // Idempotency: for the same version/period/module, replace mart snapshot.
  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      WHERE reporting_version_id = @reportingVersionId
        AND module_code = @moduleCode
        AND period_month = DATE(@periodMonth)
    `,
    params: {
      reportingVersionId: context.reportingVersionId,
      moduleCode: context.moduleCode,
      periodMonth: context.periodMonth,
    },
  });

  await client.query({
    query: `
      INSERT INTO \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      (
        period_month,
        reporting_version_id,
        module_code,
        module_name,
        kpi_code,
        kpi_name,
        actual_value,
        target_value,
        budget_value,
        ly_value,
        variance_vs_target,
        variance_vs_budget,
        growth_vs_ly,
        coverage_value,
        status_color,
        alert_flag,
        last_update_at,
        owner_name
      )
      SELECT
        DATE(@periodMonth) AS period_month,
        @reportingVersionId AS reporting_version_id,
        @moduleCode AS module_code,
        COALESCE(dm.module_name, @moduleCode) AS module_name,
        COALESCE(si.fpna_code, CONCAT('unknown_', CAST(FARM_FINGERPRINT(si.fpna_description) AS STRING))) AS kpi_code,
        COALESCE(si.fpna_description, si.fpna_code, 'Unmapped KPI') AS kpi_name,
        SUM(CAST(si.amount_value AS NUMERIC)) AS actual_value,
        CAST(NULL AS NUMERIC) AS target_value,
        CAST(NULL AS NUMERIC) AS budget_value,
        CAST(NULL AS NUMERIC) AS ly_value,
        CAST(NULL AS NUMERIC) AS variance_vs_target,
        CAST(NULL AS NUMERIC) AS variance_vs_budget,
        CAST(NULL AS NUMERIC) AS growth_vs_ly,
        CAST(NULL AS NUMERIC) AS coverage_value,
        'neutral' AS status_color,
        FALSE AS alert_flag,
        CURRENT_TIMESTAMP() AS last_update_at,
        NULL AS owner_name
      FROM \`chiesi-committee.chiesi_committee_stg.stg_sales_internal\` AS si
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` AS dm
        ON dm.module_code = @moduleCode
      WHERE si.upload_id = @uploadId
        AND si.period_month = DATE(@periodMonth)
      GROUP BY
        dm.module_name,
        si.fpna_code,
        si.fpna_description
    `,
    params: {
      uploadId: context.uploadId,
      moduleCode: context.moduleCode,
      periodMonth: context.periodMonth,
      reportingVersionId: context.reportingVersionId,
    },
  });

  const [countRows] = await client.query({
    query: `
      SELECT COUNT(1) AS total
      FROM \`chiesi-committee.chiesi_committee_stg.stg_sales_internal\`
      WHERE upload_id = @uploadId
        AND period_month = DATE(@periodMonth)
    `,
    params: { uploadId: context.uploadId, periodMonth: context.periodMonth },
  });

  const total = Number((countRows as Record<string, unknown>[])[0]?.total ?? 0);

  // Refresh serving artifacts once publish finishes so dashboards read pre-aggregated data.
  await refreshSalesInternalServingArtifacts(client);

  return { ok: true as const, publishedRows: total };
}

export async function publishUploadToMart(uploadId: string) {
  const context = await getPublishContext(uploadId);

  if (context.moduleCode === 'sales_internal') {
    return publishSalesInternalUpload(context);
  }

  throw new Error(`No publisher configured for module "${context.moduleCode}".`);
}


