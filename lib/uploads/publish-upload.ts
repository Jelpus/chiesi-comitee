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
        COALESCE(NULLIF(c.product_id, ''), CONCAT('market_', LOWER(REPLACE(COALESCE(c.market_group, 'unassigned'), ' ', '_')))),
        CASE
          WHEN c.product_id = 'COMPETITOR' OR c.product_id IS NULL OR TRIM(c.product_id) = ''
            THEN CONCAT('Competitive - ', COALESCE(c.market_group, 'Unassigned'))
          ELSE COALESCE(NULLIF(c.canonical_product_name, ''), c.product_id)
        END,
        SUM(CAST(c.recetas_value AS NUMERIC)),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC), CAST(NULL AS NUMERIC),
        'neutral',
        FALSE,
        CURRENT_TIMESTAMP(),
        NULL
      FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_closeup\` AS c
      LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_module\` AS dm
        ON dm.module_code = @moduleCode
      WHERE c.upload_id = @uploadId
      GROUP BY dm.module_name, c.product_id, c.canonical_product_name, c.market_group
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
      FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_closeup\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId: context.uploadId },
  });

  return { ok: true as const, publishedRows: Number((countRows as Record<string, unknown>[])[0]?.total ?? 0) };
}

async function publishBusinessExcellenceDddUpload(context: UploadPublishContext) {
  const client = getBigQueryClient();
  const summaryModuleCode = 'business_excellence_ddd';

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
          COALESCE(NULLIF(p.product_id, ''), CONCAT('market_', LOWER(REPLACE(COALESCE(p.market_group, 'unassigned'), ' ', '_')))),
          '_',
          COALESCE(NULLIF(p.sales_group, ''), 'unknown')
        ),
        CONCAT(
          CASE
            WHEN p.product_id = 'COMPETITOR' OR p.product_id IS NULL OR TRIM(p.product_id) = ''
              THEN CONCAT('Competitive - ', COALESCE(p.market_group, 'Unassigned'))
            ELSE COALESCE(NULLIF(p.canonical_product_name, ''), p.product_id)
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
      FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_pmm\` p
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
      GROUP BY dm.module_name, p.product_id, p.canonical_product_name, p.market_group, p.sales_group
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
      FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_pmm\` p
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
          COALESCE(NULLIF(s.product_id, ''), CONCAT('market_', LOWER(REPLACE(COALESCE(s.market_group, 'unassigned'), ' ', '_')))),
          '_',
          COALESCE(NULLIF(s.channel, ''), 'unknown')
        ),
        CONCAT(
          CASE
            WHEN s.product_id = 'COMPETITOR' OR s.product_id IS NULL OR TRIM(s.product_id) = ''
              THEN CONCAT('Competitive - ', COALESCE(s.market_group, 'Unassigned'))
            ELSE COALESCE(NULLIF(s.canonical_product_name, ''), s.product_id)
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
      FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_budget_sell_out\` s
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
      GROUP BY dm.module_name, s.product_id, s.canonical_product_name, s.market_group, s.channel
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
      FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_budget_sell_out\` s
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

  throw new Error(`No publisher configured for module "${context.moduleCode}".`);
}
