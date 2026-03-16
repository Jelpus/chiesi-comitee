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
  if (!row) throw new Error(`Upload not found for publish: ${uploadId}.`);

  return {
    uploadId: String(row.upload_id ?? ''),
    moduleCode: String(row.module_code ?? ''),
    periodMonth: String(row.period_month ?? ''),
    reportingVersionId: String(row.reporting_version_id ?? ''),
  };
}

async function publishSalesInternalUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();

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
        period_month, reporting_version_id, module_code, module_name,
        kpi_code, kpi_name, actual_value, target_value, budget_value, ly_value,
        variance_vs_target, variance_vs_budget, growth_vs_ly, coverage_value,
        status_color, alert_flag, last_update_at, owner_name
      )
      SELECT
        DATE(@periodMonth),
        @reportingVersionId,
        @moduleCode,
        COALESCE(dm.module_name, @moduleCode),
        COALESCE(si.fpna_code, CONCAT('unknown_', CAST(FARM_FINGERPRINT(si.fpna_description) AS STRING))),
        COALESCE(si.fpna_description, si.fpna_code, 'Unmapped KPI'),
        SUM(CAST(si.amount_value AS NUMERIC)),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        NULL
      FROM \`chiesi-committee.chiesi_committee_stg.stg_sales_internal\` AS si
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` AS dm
        ON dm.module_code = @moduleCode
      WHERE si.upload_id = @uploadId
        AND si.period_month = DATE(@periodMonth)
      GROUP BY dm.module_name, si.fpna_code, si.fpna_description
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

  await refreshSalesInternalServingArtifacts(client);
  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

async function publishBusinessExcellenceCloseupUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();
  const closeupEnrichedView =
    'chiesi-committee.chiesi_committee_stg.vw_business_excellence_closeup_enriched';

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
        period_month, reporting_version_id, module_code, module_name,
        kpi_code, kpi_name, actual_value, target_value, budget_value, ly_value,
        variance_vs_target, variance_vs_budget, growth_vs_ly, coverage_value,
        status_color, alert_flag, last_update_at, owner_name
      )
      SELECT
        DATE(@periodMonth),
        @reportingVersionId,
        @moduleCode,
        COALESCE(dm.module_name, @moduleCode),
        COALESCE(NULLIF(c.resolved_product_id, ''), CONCAT('market_', LOWER(REPLACE(COALESCE(c.market_group, 'unassigned'), ' ', '_')))),
        CASE
          WHEN c.resolved_product_id = 'COMPETITOR' OR c.resolved_product_id IS NULL OR TRIM(c.resolved_product_id) = ''
            THEN CONCAT('Competitive - ', COALESCE(c.market_group, 'Unassigned'))
          ELSE COALESCE(NULLIF(c.canonical_product_name, ''), c.resolved_product_id)
        END,
        SUM(CAST(c.recetas_value AS NUMERIC)),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        NULL
      FROM \`${closeupEnrichedView}\` AS c
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` AS dm
        ON dm.module_code = @moduleCode
      WHERE c.reporting_version_id = @reportingVersionId
      GROUP BY dm.module_name, c.resolved_product_id, c.canonical_product_name, c.market_group
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
      FROM \`${closeupEnrichedView}\`
      WHERE reporting_version_id = @reportingVersionId
    `,
    params: { reportingVersionId: context.reportingVersionId },
  });

  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

async function publishBusinessExcellenceDddUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();
  const summaryModuleCode = 'business_excellence_ddd';
  const pmmEnrichedView =
    'chiesi-committee.chiesi_committee_stg.vw_business_excellence_pmm_enriched';

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      WHERE reporting_version_id = @reportingVersionId
        AND module_code = @moduleCode
        AND period_month = DATE(@periodMonth)
    `,
    params: {
      reportingVersionId: context.reportingVersionId,
      moduleCode: summaryModuleCode,
      periodMonth: context.periodMonth,
    },
  });

  await client.query({
    query: `
      INSERT INTO \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      (
        period_month, reporting_version_id, module_code, module_name,
        kpi_code, kpi_name, actual_value, target_value, budget_value, ly_value,
        variance_vs_target, variance_vs_budget, growth_vs_ly, coverage_value,
        status_color, alert_flag, last_update_at, owner_name
      )
      SELECT
        DATE(@periodMonth),
        @reportingVersionId,
        @moduleCode,
        COALESCE(dm.module_name, @moduleCode),
        CONCAT(
          COALESCE(NULLIF(p.resolved_product_id, ''), CONCAT('market_', LOWER(REPLACE(COALESCE(p.market_group, 'unassigned'), ' ', '_')))),
          '_',
          COALESCE(NULLIF(p.sales_group, ''), 'unknown')
        ),
        CONCAT(
          CASE
            WHEN p.resolved_product_id = 'COMPETITOR' OR p.resolved_product_id IS NULL OR TRIM(p.resolved_product_id) = ''
              THEN CONCAT('Competitive - ', COALESCE(p.market_group, 'Unassigned'))
            ELSE COALESCE(NULLIF(p.canonical_product_name, ''), p.resolved_product_id)
          END,
          ' - ',
          COALESCE(NULLIF(p.sales_group, ''), 'Unknown')
        ),
        SUM(CAST(p.amount_value AS NUMERIC)),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        NULL
      FROM \`${pmmEnrichedView}\` p
      JOIN (
        WITH candidate_uploads AS (
          SELECT
            u.upload_id,
            COALESCE(
              NULLIF(TRIM(u.ddd_source), ''),
              CASE
                WHEN LOWER(u.source_file_name) LIKE '%innovair%' THEN 'innovair'
                WHEN LOWER(u.source_file_name) LIKE '%ribuspir%' THEN 'ribuspir'
                WHEN LOWER(u.source_file_name) LIKE '%rinoclenil%' THEN 'rinoclenil'
                ELSE 'unknown'
              END
            ) AS source_key,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(
                NULLIF(TRIM(u.ddd_source), ''),
                CASE
                  WHEN LOWER(u.source_file_name) LIKE '%innovair%' THEN 'innovair'
                  WHEN LOWER(u.source_file_name) LIKE '%ribuspir%' THEN 'ribuspir'
                  WHEN LOWER(u.source_file_name) LIKE '%rinoclenil%' THEN 'rinoclenil'
                  ELSE 'unknown'
                END
              )
              ORDER BY u.uploaded_at DESC
            ) AS rn
          FROM \`chiesi-committee.chiesi_committee_raw.uploads\` u
          WHERE u.reporting_version_id = @reportingVersionId
            AND u.period_month = DATE(@periodMonth)
            AND LOWER(TRIM(u.module_code)) IN ('business_excellence_ddd', 'business_excellence_pmm', 'pmm', 'ddd')
            AND u.status IN ('normalized', 'published')
        )
        SELECT upload_id
        FROM candidate_uploads
        WHERE rn = 1
      ) latest
        ON latest.upload_id = p.upload_id
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` AS dm
        ON dm.module_code = @moduleCode
      GROUP BY dm.module_name, p.resolved_product_id, p.canonical_product_name, p.market_group, p.sales_group
    `,
    params: {
      moduleCode: summaryModuleCode,
      periodMonth: context.periodMonth,
      reportingVersionId: context.reportingVersionId,
    },
  });

  const [countRows] = await client.query({
    query: `
      WITH candidate_uploads AS (
        SELECT
          u.upload_id,
          COALESCE(
            NULLIF(TRIM(u.ddd_source), ''),
            CASE
              WHEN LOWER(u.source_file_name) LIKE '%innovair%' THEN 'innovair'
              WHEN LOWER(u.source_file_name) LIKE '%ribuspir%' THEN 'ribuspir'
              WHEN LOWER(u.source_file_name) LIKE '%rinoclenil%' THEN 'rinoclenil'
              ELSE 'unknown'
            END
          ) AS source_key,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(
              NULLIF(TRIM(u.ddd_source), ''),
              CASE
                WHEN LOWER(u.source_file_name) LIKE '%innovair%' THEN 'innovair'
                WHEN LOWER(u.source_file_name) LIKE '%ribuspir%' THEN 'ribuspir'
                WHEN LOWER(u.source_file_name) LIKE '%rinoclenil%' THEN 'rinoclenil'
                ELSE 'unknown'
              END
            )
            ORDER BY u.uploaded_at DESC
          ) AS rn
        FROM \`chiesi-committee.chiesi_committee_raw.uploads\` u
        WHERE u.reporting_version_id = @reportingVersionId
          AND u.period_month = DATE(@periodMonth)
          AND LOWER(TRIM(u.module_code)) IN ('business_excellence_ddd', 'business_excellence_pmm', 'pmm', 'ddd')
          AND u.status IN ('normalized', 'published')
      )
      SELECT COUNT(1) AS total
      FROM \`${pmmEnrichedView}\` p
      JOIN (
        SELECT upload_id
        FROM candidate_uploads
        WHERE rn = 1
      ) latest
        ON latest.upload_id = p.upload_id
    `,
    params: {
      periodMonth: context.periodMonth,
      reportingVersionId: context.reportingVersionId,
    },
  });

  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

async function publishBusinessExcellenceSellOutUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();
  const summaryModuleCode = 'business_excellence_budget_sell_out';
  const sellOutEnrichedView =
    'chiesi-committee.chiesi_committee_stg.vw_business_excellence_budget_sell_out_enriched';

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      WHERE reporting_version_id = @reportingVersionId
        AND module_code = @moduleCode
        AND period_month = DATE(@periodMonth)
    `,
    params: {
      reportingVersionId: context.reportingVersionId,
      moduleCode: summaryModuleCode,
      periodMonth: context.periodMonth,
    },
  });

  await client.query({
    query: `
      INSERT INTO \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      (
        period_month, reporting_version_id, module_code, module_name,
        kpi_code, kpi_name, actual_value, target_value, budget_value, ly_value,
        variance_vs_target, variance_vs_budget, growth_vs_ly, coverage_value,
        status_color, alert_flag, last_update_at, owner_name
      )
      SELECT
        DATE(@periodMonth),
        @reportingVersionId,
        @moduleCode,
        COALESCE(dm.module_name, @moduleCode),
        CONCAT(
          COALESCE(NULLIF(s.resolved_product_id, ''), CONCAT('market_', LOWER(REPLACE(COALESCE(s.market_group, 'unassigned'), ' ', '_')))),
          '_',
          COALESCE(NULLIF(s.channel, ''), 'unknown')
        ),
        CONCAT(
          CASE
            WHEN s.resolved_product_id = 'COMPETITOR' OR s.resolved_product_id IS NULL OR TRIM(s.resolved_product_id) = ''
              THEN CONCAT('Competitive - ', COALESCE(s.market_group, 'Unassigned'))
            ELSE COALESCE(NULLIF(s.canonical_product_name, ''), s.resolved_product_id)
          END,
          ' - ',
          COALESCE(NULLIF(s.channel, ''), 'Unknown')
        ),
        SUM(CAST(s.amount_value AS NUMERIC)),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        NULL
      FROM \`${sellOutEnrichedView}\` s
      JOIN (
        WITH candidate_uploads AS (
          SELECT
            u.upload_id,
            COALESCE(
              NULLIF(TRIM(u.ddd_source), ''),
              CASE
                WHEN LOWER(u.source_file_name) LIKE '%privado%' THEN 'privado'
                WHEN LOWER(u.source_file_name) LIKE '%gobierno%' THEN 'gobierno'
                ELSE 'unknown'
              END
            ) AS source_key,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(
                NULLIF(TRIM(u.ddd_source), ''),
                CASE
                  WHEN LOWER(u.source_file_name) LIKE '%privado%' THEN 'privado'
                  WHEN LOWER(u.source_file_name) LIKE '%gobierno%' THEN 'gobierno'
                  ELSE 'unknown'
                END
              )
              ORDER BY u.uploaded_at DESC
            ) AS rn
          FROM \`chiesi-committee.chiesi_committee_raw.uploads\` u
          WHERE u.reporting_version_id = @reportingVersionId
            AND u.period_month = DATE(@periodMonth)
            AND LOWER(TRIM(u.module_code)) IN ('business_excellence_budget_sell_out', 'business_excellence_sell_out', 'sell_out')
            AND u.status IN ('normalized', 'published')
        )
        SELECT upload_id
        FROM candidate_uploads
        WHERE rn = 1
      ) latest
        ON latest.upload_id = s.upload_id
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` AS dm
        ON dm.module_code = @moduleCode
      GROUP BY dm.module_name, s.resolved_product_id, s.canonical_product_name, s.market_group, s.channel
    `,
    params: {
      moduleCode: summaryModuleCode,
      periodMonth: context.periodMonth,
      reportingVersionId: context.reportingVersionId,
    },
  });

  const [countRows] = await client.query({
    query: `
      WITH candidate_uploads AS (
        SELECT
          u.upload_id,
          COALESCE(
            NULLIF(TRIM(u.ddd_source), ''),
            CASE
              WHEN LOWER(u.source_file_name) LIKE '%privado%' THEN 'privado'
              WHEN LOWER(u.source_file_name) LIKE '%gobierno%' THEN 'gobierno'
              ELSE 'unknown'
            END
          ) AS source_key,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(
              NULLIF(TRIM(u.ddd_source), ''),
              CASE
                WHEN LOWER(u.source_file_name) LIKE '%privado%' THEN 'privado'
                WHEN LOWER(u.source_file_name) LIKE '%gobierno%' THEN 'gobierno'
                ELSE 'unknown'
              END
            )
            ORDER BY u.uploaded_at DESC
          ) AS rn
        FROM \`chiesi-committee.chiesi_committee_raw.uploads\` u
        WHERE u.reporting_version_id = @reportingVersionId
          AND u.period_month = DATE(@periodMonth)
          AND LOWER(TRIM(u.module_code)) IN ('business_excellence_budget_sell_out', 'business_excellence_sell_out', 'sell_out')
          AND u.status IN ('normalized', 'published')
      )
      SELECT COUNT(1) AS total
      FROM \`${sellOutEnrichedView}\` s
      JOIN (
        SELECT upload_id
        FROM candidate_uploads
        WHERE rn = 1
      ) latest
        ON latest.upload_id = s.upload_id
    `,
    params: {
      periodMonth: context.periodMonth,
      reportingVersionId: context.reportingVersionId,
    },
  });

  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

async function publishBusinessExcellenceBrickAssignmentUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();

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
        period_month, reporting_version_id, module_code, module_name,
        kpi_code, kpi_name, actual_value, target_value, budget_value, ly_value,
        variance_vs_target, variance_vs_budget, growth_vs_ly, coverage_value,
        status_color, alert_flag, last_update_at, owner_name
      )
      SELECT
        DATE(@periodMonth),
        @reportingVersionId,
        @moduleCode,
        COALESCE(dm.module_name, @moduleCode),
        kpi.kpi_code,
        kpi.kpi_name,
        kpi.actual_value,
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        NULL
      FROM (
        SELECT 'visited_bricks' AS kpi_code, 'Visited Bricks' AS kpi_name, CAST(COUNTIF(visited) AS NUMERIC) AS actual_value
        FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_brick_assignment\`
        WHERE upload_id = @uploadId
        UNION ALL
        SELECT 'total_bricks' AS kpi_code, 'Total Bricks' AS kpi_name, CAST(COUNT(1) AS NUMERIC) AS actual_value
        FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_brick_assignment\`
        WHERE upload_id = @uploadId
      ) AS kpi
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` AS dm
        ON dm.module_code = @moduleCode
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
      FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_brick_assignment\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId: context.uploadId },
  });

  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

async function publishBusinessExcellenceWeeklyTrackingUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();

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
        period_month, reporting_version_id, module_code, module_name,
        kpi_code, kpi_name, actual_value, target_value, budget_value, ly_value,
        variance_vs_target, variance_vs_budget, growth_vs_ly, coverage_value,
        status_color, alert_flag, last_update_at, owner_name
      )
      SELECT
        DATE(@periodMonth),
        @reportingVersionId,
        @moduleCode,
        COALESCE(dm.module_name, @moduleCode),
        kpi.kpi_code,
        kpi.kpi_name,
        kpi.actual_value,
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        NULL
      FROM (
        SELECT 'weekly_rows' AS kpi_code, 'Weekly Tracking Rows' AS kpi_name, CAST(COUNT(1) AS NUMERIC) AS actual_value
        FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_weekly_tracking\`
        WHERE upload_id = @uploadId
        UNION ALL
        SELECT 'weekly_units_total' AS kpi_code, 'Weekly Units Total' AS kpi_name, CAST(COALESCE(SUM(amount_value), 0) AS NUMERIC) AS actual_value
        FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_weekly_tracking\`
        WHERE upload_id = @uploadId
          AND LOWER(TRIM(sales_group)) = 'units'
        UNION ALL
        SELECT 'weekly_net_sales_total' AS kpi_code, 'Weekly Net Sales Total' AS kpi_name, CAST(COALESCE(SUM(amount_value), 0) AS NUMERIC) AS actual_value
        FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_weekly_tracking\`
        WHERE upload_id = @uploadId
          AND LOWER(TRIM(sales_group)) = 'net sales'
      ) AS kpi
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` AS dm
        ON dm.module_code = @moduleCode
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
      FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_weekly_tracking\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId: context.uploadId },
  });

  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

async function publishHumanResourcesMetricUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();
  const metricType =
    context.moduleCode === 'human_resources_turnover'
      ? 'turnover'
      : 'training';

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
        period_month, reporting_version_id, module_code, module_name,
        kpi_code, kpi_name, actual_value, target_value, budget_value, ly_value,
        variance_vs_target, variance_vs_budget, growth_vs_ly, coverage_value,
        status_color, alert_flag, last_update_at, owner_name
      )
      SELECT
        DATE(@periodMonth),
        @reportingVersionId,
        @moduleCode,
        COALESCE(dm.module_name, @moduleCode),
        CONCAT(@metricType, '_', LOWER(REPLACE(COALESCE(NULLIF(area, ''), 'unassigned'), ' ', '_'))),
        CONCAT(
          CASE WHEN @metricType = 'turnover' THEN 'Turnover' ELSE 'Training' END,
          ' - ',
          COALESCE(NULLIF(area, ''), 'Unassigned')
        ),
        CAST(COALESCE(SUM(metric_value), 0) AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        NULL
      FROM \`chiesi-committee.chiesi_committee_stg.stg_human_resources_metrics\` hr
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` dm
        ON dm.module_code = @moduleCode
      WHERE hr.upload_id = @uploadId
        AND LOWER(TRIM(hr.metric_type)) = @metricType
      GROUP BY dm.module_name, area
    `,
    params: {
      uploadId: context.uploadId,
      moduleCode: context.moduleCode,
      periodMonth: context.periodMonth,
      reportingVersionId: context.reportingVersionId,
      metricType,
    },
  });

  const [countRows] = await client.query({
    query: `
      SELECT COUNT(1) AS total
      FROM \`chiesi-committee.chiesi_committee_stg.stg_human_resources_metrics\`
      WHERE upload_id = @uploadId
        AND LOWER(TRIM(metric_type)) = @metricType
    `,
    params: { uploadId: context.uploadId, metricType },
  });

  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

async function publishHumanResourcesTurnoverUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();

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
        period_month, reporting_version_id, module_code, module_name,
        kpi_code, kpi_name, actual_value, target_value, budget_value, ly_value,
        variance_vs_target, variance_vs_budget, growth_vs_ly, coverage_value,
        status_color, alert_flag, last_update_at, owner_name
      )
      SELECT
        DATE(@periodMonth),
        @reportingVersionId,
        @moduleCode,
        COALESCE(dm.module_name, @moduleCode),
        CONCAT(
          'turnover_',
          LOWER(REPLACE(COALESCE(NULLIF(department, ''), 'unassigned'), ' ', '_')),
          '_',
          LOWER(REPLACE(COALESCE(NULLIF(vol_non_vol, ''), 'unknown'), ' ', '_'))
        ),
        CONCAT(
          'Turnover - ',
          COALESCE(NULLIF(department, ''), 'Unassigned'),
          ' - ',
          COALESCE(NULLIF(vol_non_vol, ''), 'Unknown')
        ),
        CAST(COUNT(1) AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        NULL
      FROM \`chiesi-committee.chiesi_committee_stg.stg_human_resources_turnover\` hr
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` dm
        ON dm.module_code = @moduleCode
      WHERE hr.upload_id = @uploadId
      GROUP BY dm.module_name, department, vol_non_vol
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
      FROM \`chiesi-committee.chiesi_committee_stg.stg_human_resources_turnover\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId: context.uploadId },
  });

  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

async function publishHumanResourcesTrainingUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();

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
        period_month, reporting_version_id, module_code, module_name,
        kpi_code, kpi_name, actual_value, target_value, budget_value, ly_value,
        variance_vs_target, variance_vs_budget, growth_vs_ly, coverage_value,
        status_color, alert_flag, last_update_at, owner_name
      )
      SELECT
        DATE(@periodMonth),
        @reportingVersionId,
        @moduleCode,
        COALESCE(dm.module_name, @moduleCode),
        CONCAT('training_', LOWER(REPLACE(COALESCE(NULLIF(completion_status, ''), 'unknown'), ' ', '_'))),
        CONCAT('Training - ', COALESCE(NULLIF(completion_status, ''), 'Unknown')),
        CAST(COALESCE(SUM(total_hours), 0) AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        NULL
      FROM \`chiesi-committee.chiesi_committee_stg.stg_human_resources_training\` hr
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` dm
        ON dm.module_code = @moduleCode
      WHERE hr.upload_id = @uploadId
      GROUP BY dm.module_name, completion_status
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
      FROM \`chiesi-committee.chiesi_committee_stg.stg_human_resources_training\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId: context.uploadId },
  });

  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

async function publishCommercialOperationsDsoUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();
  const summaryModuleCode = 'commercial_operations_dso';

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      WHERE reporting_version_id = @reportingVersionId
        AND module_code = @moduleCode
        AND period_month = DATE(@periodMonth)
    `,
    params: {
      reportingVersionId: context.reportingVersionId,
      moduleCode: summaryModuleCode,
      periodMonth: context.periodMonth,
    },
  });

  await client.query({
    query: `
      INSERT INTO \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      (
        period_month, reporting_version_id, module_code, module_name,
        kpi_code, kpi_name, actual_value, target_value, budget_value, ly_value,
        variance_vs_target, variance_vs_budget, growth_vs_ly, coverage_value,
        status_color, alert_flag, last_update_at, owner_name
      )
      WITH latest_period AS (
        SELECT MAX(period_month) AS period_month
        FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_dso\`
        WHERE upload_id = @uploadId
      )
      SELECT
        DATE(@periodMonth),
        @reportingVersionId,
        @moduleCode,
        COALESCE(dm.module_name, @moduleCode),
        CONCAT('dso_', LOWER(REPLACE(COALESCE(NULLIF(group_name, ''), 'unassigned'), ' ', '_'))),
        CONCAT('DSO - ', COALESCE(NULLIF(group_name, ''), 'Unassigned')),
        CAST(AVG(dso_value) AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        CAST(NULL AS STRING)
      FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_dso\` dso
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` dm
        ON dm.module_code = @moduleCode
      WHERE dso.upload_id = @uploadId
        AND dso.period_month = (SELECT period_month FROM latest_period)
      GROUP BY dm.module_name, group_name
    `,
    params: {
      uploadId: context.uploadId,
      moduleCode: summaryModuleCode,
      periodMonth: context.periodMonth,
      reportingVersionId: context.reportingVersionId,
    },
  });

  const [countRows] = await client.query({
    query: `
      SELECT COUNT(1) AS total
      FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_dso\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId: context.uploadId },
  });

  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

async function publishCommercialOperationsStocksUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();
  const summaryModuleCode = 'commercial_operations_stocks';

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      WHERE reporting_version_id = @reportingVersionId
        AND module_code = @moduleCode
        AND period_month = DATE(@periodMonth)
    `,
    params: {
      reportingVersionId: context.reportingVersionId,
      moduleCode: summaryModuleCode,
      periodMonth: context.periodMonth,
    },
  });

  await client.query({
    query: `
      INSERT INTO \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      (
        period_month, reporting_version_id, module_code, module_name,
        kpi_code, kpi_name, actual_value, target_value, budget_value, ly_value,
        variance_vs_target, variance_vs_budget, growth_vs_ly, coverage_value,
        status_color, alert_flag, last_update_at, owner_name
      )
      WITH latest_period AS (
        SELECT MAX(period_month) AS period_month
        FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_stocks\`
        WHERE upload_id = @uploadId
      )
      SELECT
        DATE(@periodMonth),
        @reportingVersionId,
        @moduleCode,
        COALESCE(dm.module_name, @moduleCode),
        'stocks_total_rows',
        'Stocks - Loaded Rows',
        CAST(COUNT(1) AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        CAST(NULL AS STRING)
      FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_stocks\` s
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` dm
        ON dm.module_code = @moduleCode
      WHERE s.upload_id = @uploadId
        AND s.period_month = (SELECT period_month FROM latest_period)
      GROUP BY dm.module_name
    `,
    params: {
      uploadId: context.uploadId,
      moduleCode: summaryModuleCode,
      periodMonth: context.periodMonth,
      reportingVersionId: context.reportingVersionId,
    },
  });

  const [countRows] = await client.query({
    query: `
      SELECT COUNT(1) AS total
      FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_stocks\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId: context.uploadId },
  });

  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

async function publishCommercialOperationsGovernmentContractProgressUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();
  const summaryModuleCode = 'commercial_operations_government_contract_progress';

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      WHERE reporting_version_id = @reportingVersionId
        AND module_code = @moduleCode
        AND period_month = DATE(@periodMonth)
    `,
    params: {
      reportingVersionId: context.reportingVersionId,
      moduleCode: summaryModuleCode,
      periodMonth: context.periodMonth,
    },
  });

  await client.query({
    query: `
      INSERT INTO \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      (
        period_month, reporting_version_id, module_code, module_name,
        kpi_code, kpi_name, actual_value, target_value, budget_value, ly_value,
        variance_vs_target, variance_vs_budget, growth_vs_ly, coverage_value,
        status_color, alert_flag, last_update_at, owner_name
      )
      WITH latest_period AS (
        SELECT MAX(period_month) AS period_month
        FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_government_contract_progress\`
        WHERE upload_id = @uploadId
      )
      SELECT
        DATE(@periodMonth),
        @reportingVersionId,
        @moduleCode,
        COALESCE(dm.module_name, @moduleCode),
        'contracts_progress_rows',
        'Government Contract Progress - Loaded Rows',
        CAST(COUNT(1) AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        CAST(NULL AS STRING)
      FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_government_contract_progress\` s
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` dm
        ON dm.module_code = @moduleCode
      WHERE s.upload_id = @uploadId
        AND s.period_month = (SELECT period_month FROM latest_period)
      GROUP BY dm.module_name
    `,
    params: {
      uploadId: context.uploadId,
      moduleCode: summaryModuleCode,
      periodMonth: context.periodMonth,
      reportingVersionId: context.reportingVersionId,
    },
  });

  const [countRows] = await client.query({
    query: `
      SELECT COUNT(1) AS total
      FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_government_contract_progress\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId: context.uploadId },
  });

  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

async function publishCommercialOperationsDeliveryOrdersUpload(
  context: UploadPublishContext,
  orderScope: 'government' | 'private',
) {
  const client = getBigQueryClient();
  const summaryModuleCode =
    orderScope === 'private'
      ? 'commercial_operations_private_orders'
      : 'commercial_operations_government_orders';
  const kpiCode = orderScope === 'private' ? 'private_orders_total_rows' : 'government_orders_total_rows';
  const kpiName = orderScope === 'private' ? 'Private Orders - Loaded Rows' : 'Government Orders - Loaded Rows';

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      WHERE reporting_version_id = @reportingVersionId
        AND module_code = @moduleCode
        AND period_month = DATE(@periodMonth)
    `,
    params: {
      reportingVersionId: context.reportingVersionId,
      moduleCode: summaryModuleCode,
      periodMonth: context.periodMonth,
    },
  });

  await client.query({
    query: `
      INSERT INTO \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      (
        period_month, reporting_version_id, module_code, module_name,
        kpi_code, kpi_name, actual_value, target_value, budget_value, ly_value,
        variance_vs_target, variance_vs_budget, growth_vs_ly, coverage_value,
        status_color, alert_flag, last_update_at, owner_name
      )
      SELECT
        DATE(@periodMonth),
        @reportingVersionId,
        @moduleCode,
        COALESCE(dm.module_name, @moduleCode),
        @kpiCode,
        @kpiName,
        CAST(COUNT(1) AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        CAST(NULL AS STRING)
      FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_delivery_orders\` s
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` dm
        ON dm.module_code = @moduleCode
      WHERE s.upload_id = @uploadId
      GROUP BY dm.module_name
    `,
    params: {
      uploadId: context.uploadId,
      moduleCode: summaryModuleCode,
      periodMonth: context.periodMonth,
      reportingVersionId: context.reportingVersionId,
      kpiCode,
      kpiName,
    },
  });

  const [countRows] = await client.query({
    query: `
      SELECT COUNT(1) AS total
      FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_delivery_orders\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId: context.uploadId },
  });

  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

async function publishOpexMasterCatalogUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();
  const summaryModuleCode = 'opex_by_cc';

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      WHERE reporting_version_id = @reportingVersionId
        AND module_code = @moduleCode
        AND period_month = DATE(@periodMonth)
    `,
    params: {
      reportingVersionId: context.reportingVersionId,
      moduleCode: summaryModuleCode,
      periodMonth: context.periodMonth,
    },
  });

  await client.query({
    query: `
      INSERT INTO \`chiesi-committee.chiesi_committee_mart.mart_executive_module_summary\`
      (
        period_month, reporting_version_id, module_code, module_name,
        kpi_code, kpi_name, actual_value, target_value, budget_value, ly_value,
        variance_vs_target, variance_vs_budget, growth_vs_ly, coverage_value,
        status_color, alert_flag, last_update_at, owner_name
      )
      SELECT
        DATE(@periodMonth),
        @reportingVersionId,
        @moduleCode,
        COALESCE(dm.module_name, @moduleCode),
        'opex_master_rows',
        'OPEX Master Catalog - Loaded Rows',
        CAST(COUNT(1) AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        CAST(NULL AS STRING)
      FROM \`chiesi-committee.chiesi_committee_stg.stg_opex_master_catalog\` s
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` dm
        ON dm.module_code = @moduleCode
      WHERE s.upload_id = @uploadId
      GROUP BY dm.module_name
    `,
    params: {
      uploadId: context.uploadId,
      moduleCode: summaryModuleCode,
      periodMonth: context.periodMonth,
      reportingVersionId: context.reportingVersionId,
    },
  });

  const [countRows] = await client.query({
    query: `
      SELECT COUNT(1) AS total
      FROM \`chiesi-committee.chiesi_committee_stg.stg_opex_master_catalog\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId: context.uploadId },
  });

  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

export async function publishUploadToMart(uploadId: string) {
  const context = await getPublishContext(uploadId);

  if (context.moduleCode === 'sales_internal') return publishSalesInternalUpload(context);
  if (context.moduleCode === 'business_excellence_closeup' || context.moduleCode === 'closeup') {
    return publishBusinessExcellenceCloseupUpload(context);
  }
  if (
    context.moduleCode === 'business_excellence_ddd' ||
    context.moduleCode === 'ddd' ||
    context.moduleCode === 'business_excellence_pmm' ||
    context.moduleCode === 'pmm'
  ) {
    return publishBusinessExcellenceDddUpload(context);
  }
  if (
    context.moduleCode === 'business_excellence_budget_sell_out' ||
    context.moduleCode === 'business_excellence_sell_out' ||
    context.moduleCode === 'sell_out'
  ) {
    return publishBusinessExcellenceSellOutUpload(context);
  }
  if (
    context.moduleCode === 'business_excellence_brick_assignment' ||
    context.moduleCode === 'business_excellence_bricks_visited' ||
    context.moduleCode === 'bricks_visited'
  ) {
    return publishBusinessExcellenceBrickAssignmentUpload(context);
  }
  if (
    context.moduleCode === 'business_excellence_iqvia_weekly' ||
    context.moduleCode === 'business_excellence_weekly_tracking' ||
    context.moduleCode === 'iqvia_weekly' ||
    context.moduleCode === 'weekly_tracking'
  ) {
    return publishBusinessExcellenceWeeklyTrackingUpload(context);
  }
  if (context.moduleCode === 'human_resources_turnover') {
    return publishHumanResourcesTurnoverUpload(context);
  }
  if (
    context.moduleCode === 'human_resources_training' ||
    context.moduleCode === 'human_resources_entrenamiento'
  ) {
    return publishHumanResourcesTrainingUpload(context);
  }
  if (
    context.moduleCode === 'commercial_operations_dso' ||
    context.moduleCode === 'commercial_operations_days_sales_outstanding' ||
    context.moduleCode === 'dso'
  ) {
    return publishCommercialOperationsDsoUpload(context);
  }
  if (
    context.moduleCode === 'commercial_operations_government_orders' ||
    context.moduleCode === 'government_orders'
  ) {
    return publishCommercialOperationsDeliveryOrdersUpload(context, 'government');
  }
  if (
    context.moduleCode === 'commercial_operations_private_orders' ||
    context.moduleCode === 'private_orders'
  ) {
    return publishCommercialOperationsDeliveryOrdersUpload(context, 'private');
  }
  if (context.moduleCode === 'commercial_operations_stocks' || context.moduleCode === 'stocks') {
    return publishCommercialOperationsStocksUpload(context);
  }
  if (
    context.moduleCode === 'commercial_operations_government_contract_progress' ||
    context.moduleCode === 'government_contract_progress' ||
    context.moduleCode === 'contract_progress' ||
    context.moduleCode === 'pcfp'
  ) {
    return publishCommercialOperationsGovernmentContractProgressUpload(context);
  }
  if (context.moduleCode === 'opex_by_cc' || context.moduleCode === 'opex_master_catalog') {
    return publishOpexMasterCatalogUpload(context);
  }

  throw new Error(`No publisher configured for module "${context.moduleCode}".`);
}
