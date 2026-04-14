import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { getGob360BigQueryClient, getGob360TableRefs } from '@/lib/bigquery/gob360-client';
import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';
import type {
  BusinessExcellenceAuditSource,
  BusinessExcellenceChannelRow,
  BusinessExcellenceFilterOptions,
  BusinessExcellenceFilters,
  BusinessExcellenceKpis,
  BusinessExcellencePrivateChannelRow,
  BusinessExcellencePrivateDddDimensionRankingRow,
  BusinessExcellencePrivatePrescriptionDimensionRankingRow,
  BusinessExcellencePrivateSellOutFilterOptions,
  BusinessExcellencePrivateSellOutFilters,
  BusinessExcellencePrivateManagerRow,
  BusinessExcellencePrivateMarketChartPoint,
  BusinessExcellencePrivateBrandSpecialtySignal,
  BusinessExcellencePrivateChannelPerformance,
  BusinessExcellencePrivatePrescriptionsOverview,
  BusinessExcellencePrivateSellOutMartRow,
  BusinessExcellencePrivateSellOutMartSummary,
  BusinessExcellencePrivateProductRow,
  BusinessExcellencePrivateScorecard,
  BusinessExcellencePrivateScorecardRow,
  BusinessExcellencePrivateWeeklyZoom,
  BusinessExcellencePrivateSellOutOverview,
  BusinessExcellencePrivateTerritoryRow,
  BusinessExcellencePrivateWeeklySeriesRow,
  BusinessExcellencePrivateWeeklyTopPackRow,
  BusinessExcellencePrivateWeeklyBenchmark,
  BusinessExcellencePrivateWeeklyBenchmarkRow,
  BusinessExcellencePrivateWeeklyBenchmarkTotal,
  BusinessExcellencePrivateUploadContext,
  BusinessExcellenceBusinessUnitChannelRow,
  BusinessExcellencePublicMarketOverview,
  BusinessExcellencePublicMarketChartPoint,
  BusinessExcellencePublicDimensionRankingRow,
  BusinessExcellencePublicMarketTopProductRow,
  BusinessExcellenceManagerRow,
  BusinessExcellenceMarketRow,
  BusinessExcellenceProductRow,
  BusinessExcellenceResolvedFilters,
  BusinessExcellenceFieldForceExcellenceData,
  BusinessExcellenceFieldForceExcellenceRow,
  BusinessExcellenceFieldForceTopCardKpis,
  BusinessExcellenceFieldForceSummaryRow,
  BusinessExcellenceFieldForceDoctorDetailRow,
  BusinessExcellenceFieldForceInteractionMixRow,
  BusinessExcellenceSourceOverview,
  BusinessExcellenceSpecialtyRow,
} from '@/types/business-excellence';

const RAW_UPLOADS = 'chiesi-committee.chiesi_committee_raw.uploads';
const PMM_ENRICHED_TABLE =
  'chiesi-committee.chiesi_committee_stg.vw_business_excellence_pmm_enriched';
const WEEKLY_ENRICHED_VIEW =
  'chiesi-committee.chiesi_committee_stg.vw_business_excellence_weekly_enriched';
const CLOSEUP_ENRICHED_VIEW =
  'chiesi-committee.chiesi_committee_stg.vw_business_excellence_closeup_enriched';
const SELL_OUT_TABLE =
  'chiesi-committee.chiesi_committee_stg.stg_business_excellence_budget_sell_out';
const SELL_OUT_ENRICHED_VIEW =
  'chiesi-committee.chiesi_committee_stg.vw_business_excellence_budget_sell_out_enriched';
const BRICK_TABLE =
  'chiesi-committee.chiesi_committee_stg.stg_business_excellence_brick_assignment';
const FIELD_FORCE_MEDICAL_SUMMARY_VIEW =
  'chiesi-committee.chiesi_committee_mart.vw_medical_coverage_summary';
const FIELD_FORCE_MEDICAL_DETAIL_VIEW =
  'chiesi-committee.chiesi_committee_mart.vw_medical_coverage_doctor_detail';
const FIELD_FORCE_MEDICAL_DETAIL_BY_BU_VIEW =
  'chiesi-committee.chiesi_committee_mart.vw_medical_coverage_detail_by_bu';
const FIELD_FORCE_MEDICAL_DOCTOR_ANALYSIS_VIEW =
  'chiesi-committee.chiesi_committee_mart.vw_medical_coverage_doctor_analysis';
const PRIVATE_SELLOUT_MART_VIEW =
  'chiesi-committee.chiesi_committee_mart.vw_private_sellout';
const GOB360_PRODUCT_MAPPING_TABLE =
  'chiesi-committee.chiesi_committee_admin.gob360_product_mapping';
const PRODUCT_METADATA_TABLE =
  'chiesi-committee.chiesi_committee_admin.product_metadata';
const REPORTING_VERSIONS_TABLE =
  'chiesi-committee.chiesi_committee_admin.reporting_versions';
const CUROSURF_STANDARD_PRODUCT_ID = 'PRD_000007';
const CUROSURF_3ML_PRODUCT_ID = 'PRD_000012';

function normalizeBusinessExcellenceProductId(productId: string | null | undefined) {
  const id = (productId ?? '').trim();
  if (!id) return null;
  return id === CUROSURF_3ML_PRODUCT_ID ? CUROSURF_STANDARD_PRODUCT_ID : id;
}

function getBusinessExcellenceUnitsFactor(productId: string | null | undefined) {
  const id = (productId ?? '').trim();
  return id === CUROSURF_3ML_PRODUCT_ID ? 2 : 1;
}

function latestUploadsCtes() {
  return `
    latest_pmm_uploads AS (
      SELECT upload_id, period_month AS upload_period_month
      FROM (
        SELECT
          u.upload_id,
          u.period_month,
          ROW_NUMBER() OVER (
            PARTITION BY
              u.period_month,
              COALESCE(
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
        FROM \`${RAW_UPLOADS}\` u
        WHERE LOWER(TRIM(u.module_code)) IN ('business_excellence_ddd', 'business_excellence_pmm', 'ddd', 'pmm')
          AND u.status IN ('normalized', 'published')
      )
      WHERE rn = 1
    ),
    latest_closeup_uploads AS (
      SELECT upload_id, period_month AS upload_period_month
      FROM (
        SELECT
          u.upload_id,
          u.period_month,
          ROW_NUMBER() OVER (
            PARTITION BY u.period_month
            ORDER BY u.uploaded_at DESC
          ) AS rn
        FROM \`${RAW_UPLOADS}\` u
        WHERE LOWER(TRIM(u.module_code)) IN ('business_excellence_closeup', 'closeup')
          AND u.status IN ('normalized', 'published')
      )
      WHERE rn = 1
    ),
    latest_sell_out_uploads AS (
      SELECT upload_id, period_month AS upload_period_month
      FROM (
        SELECT
          u.upload_id,
          u.period_month,
          ROW_NUMBER() OVER (
            PARTITION BY
              u.period_month,
              COALESCE(
                NULLIF(TRIM(u.ddd_source), ''),
                CASE
                  WHEN LOWER(u.source_file_name) LIKE '%privado%' THEN 'privado'
                  WHEN LOWER(u.source_file_name) LIKE '%private%' THEN 'privado'
                  WHEN LOWER(u.source_file_name) LIKE '%gobierno%' THEN 'gobierno'
                  WHEN LOWER(u.source_file_name) LIKE '%government%' THEN 'gobierno'
                  ELSE 'unknown'
                END
              )
            ORDER BY u.uploaded_at DESC
          ) AS rn
        FROM \`${RAW_UPLOADS}\` u
        WHERE LOWER(TRIM(u.module_code)) IN (
          'business_excellence_budget_sell_out',
          'business_excellence_sell_out',
          'sell_out'
        )
          AND u.status IN ('normalized', 'published')
      )
      WHERE rn = 1
    ),
    latest_brick_uploads AS (
      SELECT upload_id, period_month AS upload_period_month
      FROM (
        SELECT
          u.upload_id,
          u.period_month,
          ROW_NUMBER() OVER (
            PARTITION BY u.period_month
            ORDER BY u.uploaded_at DESC
          ) AS rn
        FROM \`${RAW_UPLOADS}\` u
        WHERE LOWER(TRIM(u.module_code)) IN (
          'business_excellence_brick_assignment',
          'business_excellence_bricks_visited',
          'bricks_visited'
        )
          AND u.status IN ('normalized', 'published')
      )
      WHERE rn = 1
    )
  `;
}

function sanitizeFilter(value: string | undefined) {
  const normalized = (value ?? '').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function buildPmmConditions(
  filters: BusinessExcellenceResolvedFilters,
  alias: string,
  params: Record<string, string>,
) {
  const conditions = [
    `${alias}.reporting_version_id = @reportingVersionId`,
    `${alias}.period_month = DATE(@periodMonth)`,
  ];
  params.reportingVersionId = filters.reportingVersionId;
  params.periodMonth = filters.periodMonth;

  if (filters.marketGroup) {
    conditions.push(`${alias}.market_group = @marketGroup`);
    params.marketGroup = filters.marketGroup;
  }
  if (filters.salesGroup) {
    conditions.push(`${alias}.sales_group = @salesGroup`);
    params.salesGroup = filters.salesGroup;
  }

  return conditions.join(' AND ');
}

function buildCloseupConditions(
  filters: BusinessExcellenceResolvedFilters,
  alias: string,
  params: Record<string, string>,
) {
  const conditions = [
    `${alias}.reporting_version_id = @reportingVersionId`,
    `${alias}.period_month = DATE(@periodMonth)`,
  ];
  params.reportingVersionId = filters.reportingVersionId;
  params.periodMonth = filters.periodMonth;

  if (filters.marketGroup) {
    conditions.push(`${alias}.market_group = @marketGroup`);
    params.marketGroup = filters.marketGroup;
  }
  if (filters.specialty) {
    conditions.push(`${alias}.specialty = @specialty`);
    params.specialty = filters.specialty;
  }

  return conditions.join(' AND ');
}

function buildSellOutConditions(
  filters: BusinessExcellenceResolvedFilters,
  alias: string,
  params: Record<string, string>,
) {
  const effectivePeriodExpr = `
    COALESCE(
      (
        SELECT MAX(src.period_month)
        FROM \`${SELL_OUT_TABLE}\` src
        JOIN latest_sell_out_uploads src_lu
          ON src_lu.upload_id = src.upload_id
        WHERE src.period_month <= DATE(@periodMonth)
      ),
      DATE(@periodMonth)
    )
  `;
  const conditions = [`${alias}.period_month = ${effectivePeriodExpr}`];
  params.periodMonth = filters.periodMonth;

  if (filters.marketGroup) {
    conditions.push(`${alias}.market_group = @marketGroup`);
    params.marketGroup = filters.marketGroup;
  }
  if (filters.salesGroup) {
    conditions.push(`${alias}.sales_group = @salesGroup`);
    params.salesGroup = filters.salesGroup;
  }
  if (filters.channel) {
    conditions.push(`${alias}.channel = @channel`);
    params.channel = filters.channel;
  }

  return conditions.join(' AND ');
}

function buildBrickConditions(
  filters: BusinessExcellenceResolvedFilters,
  alias: string,
  params: Record<string, string>,
) {
  params.periodMonth = filters.periodMonth;
  return `${alias}.period_month = COALESCE(
    (
      SELECT MAX(src.period_month)
      FROM \`${BRICK_TABLE}\` src
      JOIN latest_brick_uploads src_lu
        ON src_lu.upload_id = src.upload_id
      WHERE src.period_month <= DATE(@periodMonth)
    ),
    DATE(@periodMonth)
  )`;
}

async function resolveReportingVersionId(reportingVersionId?: string) {
  const versions = await getReportingVersions();
  if (versions.length === 0) return null;
  return versions.find((item) => item.reportingVersionId === reportingVersionId)?.reportingVersionId
    ?? versions[0].reportingVersionId;
}

export async function getBusinessExcellenceLatestPeriod(reportingVersionId?: string): Promise<string | null> {
  const client = getBigQueryClient();
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;
  const query = `
    WITH ${latestUploadsCtes()},
    available_periods AS (
      SELECT p.period_month
      FROM \`${PMM_ENRICHED_TABLE}\` p
      WHERE p.reporting_version_id = @reportingVersionId
      UNION DISTINCT
      SELECT c.period_month
      FROM \`${CLOSEUP_ENRICHED_VIEW}\` c
      WHERE c.reporting_version_id = @reportingVersionId
      UNION DISTINCT
      SELECT s.period_month
      FROM \`${SELL_OUT_TABLE}\` s
      JOIN latest_sell_out_uploads lu
        ON lu.upload_id = s.upload_id
      UNION DISTINCT
      SELECT b.period_month
      FROM \`${BRICK_TABLE}\` b
      JOIN latest_brick_uploads lu
        ON lu.upload_id = b.upload_id
    )
    SELECT CAST(MAX(period_month) AS STRING) AS period_month
    FROM available_periods
  `;

  const [rows] = await client.query({ query, params: { reportingVersionId: resolvedReportingVersionId } });
  const value = (rows as Array<{ period_month?: string | null }>)[0]?.period_month ?? null;
  return value ? String(value) : null;
}

function toYearStart(periodMonth: string) {
  const [year] = periodMonth.split('-');
  return `${year}-01-01`;
}

async function getLatestPeriodForTable(
  tableId: string,
  uploadCteName: 'latest_pmm_uploads' | 'latest_closeup_uploads' | 'latest_sell_out_uploads',
) {
  const client = getBigQueryClient();
  const query = `
    WITH ${latestUploadsCtes()}
    SELECT CAST(MAX(t.period_month) AS STRING) AS latest_period
    FROM \`${tableId}\` t
    JOIN ${uploadCteName} lu
      ON lu.upload_id = t.upload_id
  `;
  const [rows] = await client.query({ query });
  const value = (rows as Array<{ latest_period?: string | null }>)[0]?.latest_period ?? null;
  return value ? String(value) : null;
}

async function getLatestPeriodDirect(tableId: string, reportingVersionId?: string) {
  const client = getBigQueryClient();
  const hasReportingVersion = Boolean(reportingVersionId);
  const query = `
    SELECT CAST(MAX(period_month) AS STRING) AS latest_period
    FROM \`${tableId}\`
    ${hasReportingVersion ? 'WHERE reporting_version_id = @reportingVersionId' : ''}
  `;
  const [rows] = await client.query({
    query,
    params: hasReportingVersion ? { reportingVersionId } : undefined,
  });
  const value = (rows as Array<{ latest_period?: string | null }>)[0]?.latest_period ?? null;
  return value ? String(value) : null;
}

export async function resolveBusinessExcellenceFilters(
  filters: BusinessExcellenceFilters = {},
): Promise<BusinessExcellenceResolvedFilters | null> {
  const reportingVersionId = await resolveReportingVersionId(sanitizeFilter(filters.reportingVersionId));
  if (!reportingVersionId) return null;

  const periodMonth =
    sanitizeFilter(filters.periodMonth) ?? (await getBusinessExcellenceLatestPeriod(reportingVersionId));
  if (!periodMonth) return null;

  return {
    reportingVersionId,
    periodMonth,
    marketGroup: sanitizeFilter(filters.marketGroup),
    salesGroup: sanitizeFilter(filters.salesGroup),
    channel: sanitizeFilter(filters.channel),
    specialty: sanitizeFilter(filters.specialty),
  };
}

export async function getBusinessExcellenceFilterOptions(
  periodMonth?: string,
  reportingVersionId?: string,
): Promise<BusinessExcellenceFilterOptions> {
  const client = getBigQueryClient();
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) {
    return {
      reportingVersionId: '',
      periods: [],
      marketGroups: [],
      salesGroups: [],
      channels: [],
      specialties: [],
    };
  }
  const params: Record<string, string> = {};
  const scopedWhere = periodMonth ? 'WHERE period_month = DATE(@periodMonth)' : 'WHERE 1 = 1';
  if (periodMonth) params.periodMonth = periodMonth;
  params.reportingVersionId = resolvedReportingVersionId;

  const query = `
    WITH ${latestUploadsCtes()},
    periods AS (
      SELECT p.period_month
      FROM \`${PMM_ENRICHED_TABLE}\` p
      WHERE p.reporting_version_id = @reportingVersionId
      UNION DISTINCT
      SELECT c.period_month
      FROM \`${CLOSEUP_ENRICHED_VIEW}\` c
      WHERE c.reporting_version_id = @reportingVersionId
      UNION DISTINCT
      SELECT s.period_month
      FROM \`${SELL_OUT_TABLE}\` s
      JOIN latest_sell_out_uploads lu
        ON lu.upload_id = s.upload_id
      UNION DISTINCT
      SELECT b.period_month
      FROM \`${BRICK_TABLE}\` b
      JOIN latest_brick_uploads lu
        ON lu.upload_id = b.upload_id
    ),
    pmm_base AS (
      SELECT p.period_month, p.market_group, p.sales_group
      FROM \`${PMM_ENRICHED_TABLE}\` p
      WHERE p.reporting_version_id = @reportingVersionId
    ),
    closeup_base AS (
      SELECT c.period_month, c.market_group, c.specialty
      FROM \`${CLOSEUP_ENRICHED_VIEW}\` c
      WHERE c.reporting_version_id = @reportingVersionId
    ),
    sell_out_base AS (
      SELECT s.period_month, s.market_group, s.sales_group, s.channel
      FROM \`${SELL_OUT_TABLE}\` s
      JOIN latest_sell_out_uploads lu
        ON lu.upload_id = s.upload_id
    )
    SELECT
      ARRAY(
        SELECT CAST(period_month AS STRING)
        FROM periods
        ORDER BY period_month DESC
      ) AS periods,
      ARRAY(
        SELECT DISTINCT market_group
        FROM (
          SELECT period_month, market_group FROM pmm_base
          UNION ALL
          SELECT period_month, market_group FROM closeup_base
          UNION ALL
          SELECT period_month, market_group FROM sell_out_base
        )
        ${scopedWhere}
        AND market_group IS NOT NULL
        AND TRIM(market_group) != ''
        ORDER BY market_group
      ) AS market_groups,
      ARRAY(
        SELECT DISTINCT sales_group
        FROM (
          SELECT period_month, sales_group FROM pmm_base
          UNION ALL
          SELECT period_month, sales_group FROM sell_out_base
        )
        ${scopedWhere}
        AND sales_group IS NOT NULL
        AND TRIM(sales_group) != ''
        ORDER BY sales_group
      ) AS sales_groups,
      ARRAY(
        SELECT DISTINCT channel
        FROM sell_out_base
        ${scopedWhere}
        AND channel IS NOT NULL
        AND TRIM(channel) != ''
        ORDER BY channel
      ) AS channels,
      ARRAY(
        SELECT DISTINCT specialty
        FROM closeup_base
        ${scopedWhere}
        AND specialty IS NOT NULL
        AND TRIM(specialty) != ''
        ORDER BY specialty
      ) AS specialties
  `;

  const [rows] = await client.query({ query, params });
  const row = (rows as Array<Record<string, unknown>>)[0] ?? {};

  return {
    reportingVersionId: resolvedReportingVersionId,
    periods: ((row.periods as unknown[]) ?? []).map((item) => String(item)),
    marketGroups: ((row.market_groups as unknown[]) ?? []).map((item) => String(item)),
    salesGroups: ((row.sales_groups as unknown[]) ?? []).map((item) => String(item)),
    channels: ((row.channels as unknown[]) ?? []).map((item) => String(item)),
    specialties: ((row.specialties as unknown[]) ?? []).map((item) => String(item)),
  };
}

export async function getBusinessExcellenceAuditSources(
  reportingVersionId?: string,
): Promise<BusinessExcellenceAuditSource[]> {
  const client = getBigQueryClient();
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];

  const query = `
    WITH pmm AS (
      SELECT
        'pmm' AS source_key,
        'Sell Out Privado' AS source_label,
        @reportingVersionId AS reporting_version_id,
        CAST(MAX(report_period_month) AS STRING) AS report_period_month,
        CAST(MAX(source_as_of_month) AS STRING) AS source_as_of_month
      FROM \`${PMM_ENRICHED_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
    ),
    closeup AS (
      SELECT
        'closeup' AS source_key,
        'Private Prescriptions' AS source_label,
        @reportingVersionId AS reporting_version_id,
        CAST(MAX(report_period_month) AS STRING) AS report_period_month,
        CAST(MAX(source_as_of_month) AS STRING) AS source_as_of_month
      FROM \`${CLOSEUP_ENRICHED_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
    )
    SELECT * FROM pmm
    UNION ALL
    SELECT * FROM closeup
  `;

  const [rows] = await client.query({ query, params: { reportingVersionId: resolvedReportingVersionId } });
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    sourceKey: (row.source_key as 'pmm' | 'closeup') ?? 'pmm',
    sourceLabel: String(row.source_label ?? ''),
    reportingVersionId: String(row.reporting_version_id ?? resolvedReportingVersionId),
    reportPeriodMonth: row.report_period_month ? String(row.report_period_month) : null,
    sourceAsOfMonth: row.source_as_of_month ? String(row.source_as_of_month) : null,
  }));
}

export async function getBusinessExcellenceKpis(
  filters: BusinessExcellenceResolvedFilters,
): Promise<BusinessExcellenceKpis> {
  const client = getBigQueryClient();
  const params: Record<string, string> = {};
  const pmmWhere = buildPmmConditions(filters, 'p', params);
  const closeupWhere = buildCloseupConditions(filters, 'c', params);
  const sellOutWhere = buildSellOutConditions(filters, 's', params);
  const brickWhere = buildBrickConditions(filters, 'b', params);

  const query = `
    WITH ${latestUploadsCtes()},
    pmm_base AS (
      SELECT p.*
      FROM \`${PMM_ENRICHED_TABLE}\` p
      WHERE ${pmmWhere}
    ),
    closeup_base AS (
      SELECT c.*
      FROM \`${CLOSEUP_ENRICHED_VIEW}\` c
      WHERE ${closeupWhere}
    ),
    sell_out_base AS (
      SELECT s.*
      FROM \`${SELL_OUT_TABLE}\` s
      JOIN latest_sell_out_uploads lu
        ON lu.upload_id = s.upload_id
      WHERE ${sellOutWhere}
    ),
    brick_base AS (
      SELECT b.*
      FROM \`${BRICK_TABLE}\` b
      JOIN latest_brick_uploads lu
        ON lu.upload_id = b.upload_id
      WHERE ${brickWhere}
    )
    SELECT
      @periodMonth AS period_month,
      COALESCE(SUM(IF(LOWER(TRIM(p.sales_group)) = 'net sales', p.amount_value, 0)), 0) AS pmm_net_sales,
      COALESCE(SUM(IF(LOWER(TRIM(p.sales_group)) = 'units', p.amount_value, 0)), 0) AS pmm_units,
      (SELECT COALESCE(SUM(c.recetas_value), 0) FROM closeup_base c) AS closeup_recetas,
      (SELECT COALESCE(SUM(s.amount_value), 0) FROM sell_out_base s) AS sell_out_units,
      (SELECT COUNTIF(b.visited) FROM brick_base b) AS visited_bricks,
      (SELECT COUNT(1) FROM brick_base b) AS total_bricks
    FROM pmm_base p
  `;

  const [rows] = await client.query({ query, params });
  const row = (rows as Array<Record<string, unknown>>)[0] ?? {};
  const totalBricks = Number(row.total_bricks ?? 0);
  const visitedBricks = Number(row.visited_bricks ?? 0);

  return {
    periodMonth: String(row.period_month ?? filters.periodMonth),
    pmmNetSales: Number(row.pmm_net_sales ?? 0),
    pmmUnits: Number(row.pmm_units ?? 0),
    closeupRecetas: Number(row.closeup_recetas ?? 0),
    sellOutUnits: Number(row.sell_out_units ?? 0),
    visitedBricks,
    totalBricks,
    brickVisitRate: totalBricks === 0 ? null : visitedBricks / totalBricks,
  };
}

export async function getBusinessExcellenceMarketPerformance(
  filters: BusinessExcellenceResolvedFilters,
  limit = 10,
): Promise<BusinessExcellenceMarketRow[]> {
  const client = getBigQueryClient();
  const params: Record<string, string | number> = { limit };
  const pmmWhere = buildPmmConditions(filters, 'p', params as Record<string, string>);
  const closeupWhere = buildCloseupConditions(filters, 'c', params as Record<string, string>);
  const sellOutWhere = buildSellOutConditions(filters, 's', params as Record<string, string>);

  const query = `
    WITH ${latestUploadsCtes()},
    pmm_market AS (
      SELECT
        COALESCE(NULLIF(p.market_group, ''), 'Unassigned') AS label,
        SUM(IF(LOWER(TRIM(p.sales_group)) = 'net sales', p.amount_value, 0)) AS pmm_net_sales,
        SUM(IF(LOWER(TRIM(p.sales_group)) = 'units', p.amount_value, 0)) AS pmm_units
      FROM \`${PMM_ENRICHED_TABLE}\` p
      WHERE ${pmmWhere}
      GROUP BY label
    ),
    closeup_market AS (
      SELECT
        COALESCE(NULLIF(c.market_group, ''), 'Unassigned') AS label,
        SUM(c.recetas_value) AS closeup_recetas
      FROM \`${CLOSEUP_ENRICHED_VIEW}\` c
      WHERE ${closeupWhere}
      GROUP BY label
    ),
    sell_out_market AS (
      SELECT
        COALESCE(NULLIF(s.market_group, ''), 'Unassigned') AS label,
        SUM(s.amount_value) AS sell_out_units
      FROM \`${SELL_OUT_TABLE}\` s
      JOIN latest_sell_out_uploads lu
        ON lu.upload_id = s.upload_id
      WHERE ${sellOutWhere}
      GROUP BY label
    )
    SELECT
      COALESCE(p.label, c.label, s.label) AS label,
      COALESCE(p.pmm_net_sales, 0) AS pmm_net_sales,
      COALESCE(p.pmm_units, 0) AS pmm_units,
      COALESCE(c.closeup_recetas, 0) AS closeup_recetas,
      COALESCE(s.sell_out_units, 0) AS sell_out_units
    FROM pmm_market p
    FULL OUTER JOIN closeup_market c
      ON c.label = p.label
    FULL OUTER JOIN sell_out_market s
      ON s.label = COALESCE(p.label, c.label)
    ORDER BY ABS(pmm_net_sales) + ABS(closeup_recetas) + ABS(sell_out_units) DESC
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params });
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    label: String(row.label ?? 'Unassigned'),
    pmmNetSales: Number(row.pmm_net_sales ?? 0),
    pmmUnits: Number(row.pmm_units ?? 0),
    closeupRecetas: Number(row.closeup_recetas ?? 0),
    sellOutUnits: Number(row.sell_out_units ?? 0),
  }));
}

export async function getBusinessExcellenceChannelPerformance(
  filters: BusinessExcellenceResolvedFilters,
  limit = 10,
): Promise<BusinessExcellenceChannelRow[]> {
  const client = getBigQueryClient();
  const params: Record<string, string | number> = { limit };
  const whereClause = buildSellOutConditions(filters, 's', params as Record<string, string>);

  const query = `
    WITH ${latestUploadsCtes()}
    SELECT
      COALESCE(NULLIF(s.channel, ''), 'Unassigned') AS label,
      SUM(s.amount_value) AS sell_out_units
    FROM \`${SELL_OUT_TABLE}\` s
    JOIN latest_sell_out_uploads lu
      ON lu.upload_id = s.upload_id
    WHERE ${whereClause}
    GROUP BY label
    ORDER BY sell_out_units DESC
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params });
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    label: String(row.label ?? 'Unassigned'),
    sellOutUnits: Number(row.sell_out_units ?? 0),
  }));
}

export async function getBusinessExcellenceSpecialtyPerformance(
  filters: BusinessExcellenceResolvedFilters,
  limit = 10,
): Promise<BusinessExcellenceSpecialtyRow[]> {
  const client = getBigQueryClient();
  const params: Record<string, string | number> = { limit };
  const whereClause = buildCloseupConditions(filters, 'c', params as Record<string, string>);

  const query = `
    WITH ${latestUploadsCtes()}
    SELECT
      COALESCE(NULLIF(c.specialty, ''), 'Unassigned') AS label,
      SUM(c.recetas_value) AS closeup_recetas
    FROM \`${CLOSEUP_ENRICHED_VIEW}\` c
    WHERE ${whereClause}
    GROUP BY label
    ORDER BY closeup_recetas DESC
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params });
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    label: String(row.label ?? 'Unassigned'),
    closeupRecetas: Number(row.closeup_recetas ?? 0),
  }));
}

export async function getBusinessExcellenceManagerPerformance(
  filters: BusinessExcellenceResolvedFilters,
  limit = 10,
): Promise<BusinessExcellenceManagerRow[]> {
  const client = getBigQueryClient();
  const params: Record<string, string | number> = { limit };
  const pmmWhere = buildPmmConditions(filters, 'p', params as Record<string, string>);
  const brickWhere = buildBrickConditions(filters, 'b', params as Record<string, string>);

  const query = `
    WITH ${latestUploadsCtes()},
    brick_base AS (
      SELECT b.*
      FROM \`${BRICK_TABLE}\` b
      JOIN latest_brick_uploads lu
        ON lu.upload_id = b.upload_id
      WHERE ${brickWhere}
    )
    SELECT
      COALESCE(NULLIF(b.manager, ''), 'Unassigned') AS label,
      SUM(IF(LOWER(TRIM(p.sales_group)) = 'net sales', p.amount_value, 0)) AS pmm_net_sales,
      SUM(IF(LOWER(TRIM(p.sales_group)) = 'units', p.amount_value, 0)) AS pmm_units
    FROM \`${PMM_ENRICHED_TABLE}\` p
    LEFT JOIN brick_base b
      ON b.brick_code = p.brick
    WHERE ${pmmWhere}
    GROUP BY label
    ORDER BY ABS(pmm_net_sales) + ABS(pmm_units) DESC
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params });
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    label: String(row.label ?? 'Unassigned'),
    pmmNetSales: Number(row.pmm_net_sales ?? 0),
    pmmUnits: Number(row.pmm_units ?? 0),
  }));
}

export async function getBusinessExcellenceProductPerformance(
  filters: BusinessExcellenceResolvedFilters,
  limit = 15,
): Promise<BusinessExcellenceProductRow[]> {
  const client = getBigQueryClient();
  const params: Record<string, string | number> = { limit };
  const pmmWhere = buildPmmConditions(filters, 'p', params as Record<string, string>);
  const closeupWhere = buildCloseupConditions(filters, 'c', params as Record<string, string>);
  const sellOutWhere = buildSellOutConditions(filters, 's', params as Record<string, string>);

  const query = `
    WITH ${latestUploadsCtes()},
    pmm_products AS (
      SELECT
        COALESCE(NULLIF(p.resolved_product_id, ''), CONCAT('market:', COALESCE(NULLIF(p.market_group, ''), 'unassigned'), '|', COALESCE(NULLIF(p.canonical_product_name, ''), 'unknown'))) AS product_key,
        NULLIF(p.resolved_product_id, '') AS product_id,
        COALESCE(NULLIF(p.canonical_product_name, ''), 'Unmapped Product') AS canonical_product_name,
        NULLIF(p.market_group, '') AS market_group,
        SUM(IF(LOWER(TRIM(p.sales_group)) = 'net sales', p.amount_value, 0)) AS pmm_net_sales,
        SUM(IF(LOWER(TRIM(p.sales_group)) = 'units', p.amount_value, 0)) AS pmm_units
      FROM \`${PMM_ENRICHED_TABLE}\` p
      WHERE ${pmmWhere}
      GROUP BY product_key, product_id, canonical_product_name, market_group
    ),
    closeup_products AS (
      SELECT
        COALESCE(NULLIF(c.resolved_product_id, ''), CONCAT('market:', COALESCE(NULLIF(c.market_group, ''), 'unassigned'), '|', COALESCE(NULLIF(c.canonical_product_name, ''), 'unknown'))) AS product_key,
        NULLIF(c.resolved_product_id, '') AS product_id,
        COALESCE(NULLIF(c.canonical_product_name, ''), 'Unmapped Product') AS canonical_product_name,
        NULLIF(c.market_group, '') AS market_group,
        SUM(c.recetas_value) AS closeup_recetas
      FROM \`${CLOSEUP_ENRICHED_VIEW}\` c
      WHERE ${closeupWhere}
      GROUP BY product_key, product_id, canonical_product_name, market_group
    ),
    sell_out_products AS (
      SELECT
        COALESCE(NULLIF(s.product_id, ''), CONCAT('market:', COALESCE(NULLIF(s.market_group, ''), 'unassigned'), '|', COALESCE(NULLIF(s.canonical_product_name, ''), 'unknown'))) AS product_key,
        NULLIF(s.product_id, '') AS product_id,
        COALESCE(NULLIF(s.canonical_product_name, ''), 'Unmapped Product') AS canonical_product_name,
        NULLIF(s.market_group, '') AS market_group,
        SUM(s.amount_value) AS sell_out_units
      FROM \`${SELL_OUT_TABLE}\` s
      JOIN latest_sell_out_uploads lu
        ON lu.upload_id = s.upload_id
      WHERE ${sellOutWhere}
      GROUP BY product_key, product_id, canonical_product_name, market_group
    )
    SELECT
      COALESCE(p.product_key, c.product_key, s.product_key) AS product_key,
      COALESCE(p.product_id, c.product_id, s.product_id) AS product_id,
      COALESCE(p.canonical_product_name, c.canonical_product_name, s.canonical_product_name) AS canonical_product_name,
      COALESCE(p.market_group, c.market_group, s.market_group) AS market_group,
      COALESCE(p.pmm_net_sales, 0) AS pmm_net_sales,
      COALESCE(p.pmm_units, 0) AS pmm_units,
      COALESCE(c.closeup_recetas, 0) AS closeup_recetas,
      COALESCE(s.sell_out_units, 0) AS sell_out_units,
      ABS(COALESCE(p.pmm_net_sales, 0)) + ABS(COALESCE(p.pmm_units, 0)) + ABS(COALESCE(c.closeup_recetas, 0)) + ABS(COALESCE(s.sell_out_units, 0)) AS total_signal
    FROM pmm_products p
    FULL OUTER JOIN closeup_products c
      ON c.product_key = p.product_key
    FULL OUTER JOIN sell_out_products s
      ON s.product_key = COALESCE(p.product_key, c.product_key)
    ORDER BY total_signal DESC, canonical_product_name
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params });
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    productKey: String(row.product_key ?? ''),
    productId: row.product_id ? String(row.product_id) : null,
    canonicalProductName: String(row.canonical_product_name ?? 'Unmapped Product'),
    marketGroup: row.market_group ? String(row.market_group) : null,
    pmmNetSales: Number(row.pmm_net_sales ?? 0),
    pmmUnits: Number(row.pmm_units ?? 0),
    closeupRecetas: Number(row.closeup_recetas ?? 0),
    sellOutUnits: Number(row.sell_out_units ?? 0),
    totalSignal: Number(row.total_signal ?? 0),
  }));
}

function normalizePrivateSellOutFilters(
  filters: BusinessExcellencePrivateSellOutFilters = {},
): BusinessExcellencePrivateSellOutFilters {
  return {
    periodMonth: sanitizeFilter(filters.periodMonth),
    marketGroup: sanitizeFilter(filters.marketGroup),
    manager: sanitizeFilter(filters.manager),
    territory: sanitizeFilter(filters.territory),
  };
}

function buildPrivateSellOutScope(
  filters: BusinessExcellencePrivateSellOutFilters,
  params: Record<string, string | number>,
) {
  const conditions = [
    'reporting_version_id = @reportingVersionId',
    "resolved_product_id IS NOT NULL",
    "TRIM(resolved_product_id) != ''",
  ];

  if (filters.marketGroup) {
    conditions.push('market_group = @marketGroup');
    params.marketGroup = filters.marketGroup;
  }
  if (filters.manager) {
    conditions.push('manager = @manager');
    params.manager = filters.manager;
  }
  if (filters.territory) {
    conditions.push('territory = @territory');
    params.territory = filters.territory;
  }

  return conditions.join(' AND ');
}

function buildPrivateSellOutYtdWindow(rowAlias: string, latestPeriodAlias: string) {
  return `${rowAlias}.period_month BETWEEN DATE(CONCAT(SUBSTR(${latestPeriodAlias}.latest_period, 1, 4), '-01-01')) AND DATE(${latestPeriodAlias}.latest_period)`;
}

export async function getBusinessExcellencePrivateSellOutFilterOptions(
  reportingVersionId?: string,
): Promise<BusinessExcellencePrivateSellOutFilterOptions> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) {
    return { periods: [], marketGroups: [], managers: [], territories: [] };
  }

  const client = getBigQueryClient();
  const query = `
    WITH scoped_pmm AS (
      SELECT *
      FROM \`${PMM_ENRICHED_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
        AND resolved_product_id IS NOT NULL
        AND TRIM(resolved_product_id) != ''
    )
    SELECT
      ARRAY(
        SELECT CAST(period_month AS STRING)
        FROM (
          SELECT DISTINCT period_month
          FROM scoped_pmm
        )
        ORDER BY period_month DESC
      ) AS periods,
      ARRAY(
        SELECT market_group
        FROM (
          SELECT DISTINCT market_group
          FROM scoped_pmm
          WHERE market_group IS NOT NULL
            AND TRIM(market_group) != ''
        )
        ORDER BY market_group
      ) AS market_groups,
      ARRAY(
        SELECT manager
        FROM (
          SELECT DISTINCT manager
          FROM scoped_pmm
          WHERE manager IS NOT NULL
            AND TRIM(manager) != ''
        )
        ORDER BY manager
      ) AS managers,
      ARRAY(
        SELECT territory
        FROM (
          SELECT DISTINCT territory
          FROM scoped_pmm
          WHERE territory IS NOT NULL
            AND TRIM(territory) != ''
        )
        ORDER BY territory
      ) AS territories
  `;

  const [rows] = await client.query({
    query,
    params: { reportingVersionId: resolvedReportingVersionId },
  });
  const row = (rows as Array<Record<string, unknown>>)[0] ?? {};

  return {
    periods: ((row.periods as unknown[]) ?? []).map((value) => String(value)),
    marketGroups: ((row.market_groups as unknown[]) ?? []).map((value) => String(value)),
    managers: ((row.managers as unknown[]) ?? []).map((value) => String(value)),
    territories: ((row.territories as unknown[]) ?? []).map((value) => String(value)),
  };
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function getBusinessExcellencePrivateSellOutMartSummary(
  reportingVersionId?: string,
  marketGroup?: string,
): Promise<BusinessExcellencePrivateSellOutMartSummary | null> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;

  const client = getBigQueryClient();
  const normalizedMarketGroup = sanitizeFilter(marketGroup);
  const params: Record<string, string> = {
    reportingVersionId: resolvedReportingVersionId,
  };
  const marketWhere = normalizedMarketGroup ? 'AND market_group = @marketGroup' : '';
  if (normalizedMarketGroup) params.marketGroup = normalizedMarketGroup;

  const query = `
    SELECT
      @reportingVersionId AS reporting_version_id,
      ${normalizedMarketGroup ? '@marketGroup' : 'CAST(NULL AS STRING)'} AS market_group,
      CAST(MAX(last_available_month) AS STRING) AS last_available_month,
      COALESCE(SUM(ytd_units), 0) AS ytd_units,
      COALESCE(SUM(ytd_net_sales), 0) AS ytd_net_sales,
      COALESCE(SUM(ytd_rx), 0) AS ytd_rx,
      COALESCE(SUM(mth_units), 0) AS mth_units,
      COALESCE(SUM(mth_net_sales), 0) AS mth_net_sales,
      COALESCE(SUM(mth_rx), 0) AS mth_rx
    FROM \`${PRIVATE_SELLOUT_MART_VIEW}\`
    WHERE reporting_version_id = @reportingVersionId
      ${marketWhere}
  `;

  const [rows] = await client.query({ query, params });
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;

  return {
    reportingVersionId: String(row.reporting_version_id ?? resolvedReportingVersionId),
    marketGroup: row.market_group ? String(row.market_group) : normalizedMarketGroup ?? null,
    lastAvailableMonth: row.last_available_month ? String(row.last_available_month) : null,
    ytdUnits: Number(row.ytd_units ?? 0),
    ytdNetSales: Number(row.ytd_net_sales ?? 0),
    ytdRx: Number(row.ytd_rx ?? 0),
    mthUnits: Number(row.mth_units ?? 0),
    mthNetSales: Number(row.mth_net_sales ?? 0),
    mthRx: Number(row.mth_rx ?? 0),
  };
}

export async function getBusinessExcellencePrivateChannelPerformance(
  reportingVersionId?: string,
): Promise<BusinessExcellencePrivateChannelPerformance | null> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;

  const client = getBigQueryClient();
  const query = `
    SELECT
      @reportingVersionId AS reporting_version_id,
      CAST(MAX(last_available_month) AS STRING) AS last_available_month,
      COALESCE(SUM(ytd_units), 0) AS ytd_units,
      COALESCE(SUM(ytd_units_py), 0) AS ytd_units_py,
      COALESCE(SUM(ytd_net_sales), 0) AS ytd_net_sales,
      COALESCE(SUM(ytd_net_sales_py), 0) AS ytd_net_sales_py,
      COALESCE(SUM(ytd_rx), 0) AS ytd_rx,
      COALESCE(SUM(ytd_rx_py), 0) AS ytd_rx_py,
      COALESCE(SUM(mth_units), 0) AS mth_units,
      COALESCE(SUM(mth_units_py), 0) AS mth_units_py,
      COALESCE(SUM(mth_net_sales), 0) AS mth_net_sales,
      COALESCE(SUM(mth_net_sales_py), 0) AS mth_net_sales_py,
      COALESCE(SUM(mth_rx), 0) AS mth_rx,
      COALESCE(SUM(mth_rx_py), 0) AS mth_rx_py,
      COALESCE(SUM(budget_ytd_units), 0) AS budget_ytd_units,
      COALESCE(SUM(budget_mth_units), 0) AS budget_mth_units,
      COALESCE(SUM(ytd_units_visited), 0) AS ytd_units_visited,
      COALESCE(SUM(ytd_rx_visited), 0) AS ytd_rx_visited
    FROM \`${PRIVATE_SELLOUT_MART_VIEW}\`
    WHERE reporting_version_id = @reportingVersionId
  `;

  const [rows] = await client.query({
    query,
    params: { reportingVersionId: resolvedReportingVersionId },
  });
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;

  const ytdUnits = Number(row.ytd_units ?? 0);
  const ytdUnitsPy = Number(row.ytd_units_py ?? 0);
  const ytdNetSales = Number(row.ytd_net_sales ?? 0);
  const ytdNetSalesPy = Number(row.ytd_net_sales_py ?? 0);
  const ytdRx = Number(row.ytd_rx ?? 0);
  const ytdRxPy = Number(row.ytd_rx_py ?? 0);
  const mthUnits = Number(row.mth_units ?? 0);
  const mthUnitsPy = Number(row.mth_units_py ?? 0);
  const mthNetSales = Number(row.mth_net_sales ?? 0);
  const mthNetSalesPy = Number(row.mth_net_sales_py ?? 0);
  const mthRx = Number(row.mth_rx ?? 0);
  const mthRxPy = Number(row.mth_rx_py ?? 0);
  const budgetYtdUnits = Number(row.budget_ytd_units ?? 0);
  const budgetMthUnits = Number(row.budget_mth_units ?? 0);
  const ytdUnitsVisited = Number(row.ytd_units_visited ?? 0);
  const ytdRxVisited = Number(row.ytd_rx_visited ?? 0);

  const pct = (value: number, base: number) => (base === 0 ? null : ((value - base) / base) * 100);

  return {
    reportingVersionId: String(row.reporting_version_id ?? resolvedReportingVersionId),
    lastAvailableMonth: row.last_available_month ? String(row.last_available_month) : null,
    ytdUnits,
    ytdUnitsPy,
    ytdUnitsGrowthPct: pct(ytdUnits, ytdUnitsPy),
    ytdNetSales,
    ytdNetSalesPy,
    ytdNetSalesGrowthPct: pct(ytdNetSales, ytdNetSalesPy),
    ytdRx,
    ytdRxPy,
    ytdRxGrowthPct: pct(ytdRx, ytdRxPy),
    mthUnits,
    mthUnitsPy,
    mthUnitsGrowthPct: pct(mthUnits, mthUnitsPy),
    mthNetSales,
    mthNetSalesPy,
    mthNetSalesGrowthPct: pct(mthNetSales, mthNetSalesPy),
    mthRx,
    mthRxPy,
    mthRxGrowthPct: pct(mthRx, mthRxPy),
    ytdCoverageVsBudgetPct: budgetYtdUnits === 0 ? null : (ytdUnits / budgetYtdUnits) * 100,
    mthCoverageVsBudgetPct: budgetMthUnits === 0 ? null : (mthUnits / budgetMthUnits) * 100,
    ytdVisitedUnitsRatio: ytdUnits === 0 ? null : ytdUnitsVisited / ytdUnits,
    ytdVisitedRxRatio: ytdRx === 0 ? null : ytdRxVisited / ytdRx,
  };
}

async function getGob360MappedClaves() {
  const client = getBigQueryClient();
  const query = `
    SELECT
      source_clave_normalized,
      product_id,
      market_group
    FROM (
      SELECT
        m.*,
        ROW_NUMBER() OVER (
          PARTITION BY m.source_clave_normalized
          ORDER BY m.updated_at DESC, m.created_at DESC
        ) AS rn
      FROM \`${GOB360_PRODUCT_MAPPING_TABLE}\` m
      WHERE m.is_active = TRUE
        AND m.source_clave_normalized IS NOT NULL
        AND TRIM(m.source_clave_normalized) != ''
        AND (
          (m.product_id IS NOT NULL AND TRIM(m.product_id) != '')
          OR (m.market_group IS NOT NULL AND TRIM(m.market_group) != '')
        )
    )
    WHERE rn = 1
  `;
  const [rows] = await client.query({ query });
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    _rawProductId: row.product_id ? String(row.product_id) : null,
    sourceClaveNormalized: String(row.source_clave_normalized ?? ''),
    productId: normalizeBusinessExcellenceProductId(row.product_id ? String(row.product_id) : null),
    unitsFactor: getBusinessExcellenceUnitsFactor(row.product_id ? String(row.product_id) : null),
    marketGroup: row.market_group ? String(row.market_group) : null,
  }));
}

async function getProductMetadataBrandMap() {
  const client = getBigQueryClient();
  const query = `
    SELECT product_id, brand_name
    FROM (
      SELECT
        pm.*,
        ROW_NUMBER() OVER (
          PARTITION BY pm.product_id
          ORDER BY pm.updated_at DESC, pm.created_at DESC
        ) AS rn
      FROM \`${PRODUCT_METADATA_TABLE}\` pm
    )
    WHERE rn = 1
  `;
  const [rows] = await client.query({ query });
  return new Map(
    (rows as Array<Record<string, unknown>>).map((row) => [
      String(row.product_id ?? ''),
      row.brand_name ? String(row.brand_name) : 'Unmapped Brand',
    ]),
  );
}

async function getProductMetadataBusinessUnitMap() {
  const client = getBigQueryClient();
  const query = `
    SELECT product_id, business_unit_name
    FROM (
      SELECT
        pm.*,
        ROW_NUMBER() OVER (
          PARTITION BY pm.product_id
          ORDER BY pm.updated_at DESC, pm.created_at DESC
        ) AS rn
      FROM \`${PRODUCT_METADATA_TABLE}\` pm
    )
    WHERE rn = 1
  `;
  const [rows] = await client.query({ query });
  return new Map(
    (rows as Array<Record<string, unknown>>).map((row) => [
      String(row.product_id ?? ''),
      row.business_unit_name ? String(row.business_unit_name) : 'Unclassified BU',
    ]),
  );
}

type Gob360OverviewRow = {
  latest_date: string | null;
  sc_selected_month: string | null;
  sc_is_fallback: boolean;
  ytd_pieces: number;
  ytd_pieces_py: number;
  mth_pieces: number;
  mth_pieces_py: number;
  clues_active: number;
  clues_total_ytd: number;
  chiesi_clues_active_ytd: number;
};

type Gob360AggRow = {
  latest_date: string | null;
  source_clave_normalized: string;
  event_date: string;
  pieces: number;
};

type Gob360RankingRawRow = {
  latest_date: string | null;
  source_clave_normalized: string;
  source_clave_raw: string;
  clue: string;
  ruta: string;
  event_date: string;
  pieces: number;
};

type GovernmentBudgetAggRow = {
  marketGroup: string | null;
  ytdBudgetUnits: number;
  ytdBudgetUnitsPy: number;
  mthBudgetUnits: number;
  mthBudgetUnitsPy: number;
};

async function getGob360ClueDescriptionCatalog() {
  const gobClient = getGob360BigQueryClient(true);
  const { pcStructureTableId, scStructureTableId } = getGob360TableRefs();
  const query = `
    WITH clue_catalog AS (
      SELECT
        LOWER(REGEXP_REPLACE(TRIM(CAST(CLUE AS STRING)), r'[^a-zA-Z0-9]+', '')) AS clue_key,
        NULLIF(TRIM(CAST(UNIDAD_O_ALMACEN AS STRING)), '') AS clue_description
      FROM \`${pcStructureTableId}\`
      WHERE CLUE IS NOT NULL
        AND TRIM(CAST(CLUE AS STRING)) != ''
      UNION ALL
      SELECT
        LOWER(REGEXP_REPLACE(TRIM(CAST(CLUE AS STRING)), r'[^a-zA-Z0-9]+', '')) AS clue_key,
        NULLIF(TRIM(CAST(UNIDAD_O_ALMACEN AS STRING)), '') AS clue_description
      FROM \`${scStructureTableId}\`
      WHERE CLUE IS NOT NULL
        AND TRIM(CAST(CLUE AS STRING)) != ''
    ),
    ranked AS (
      SELECT
        clue_key,
        clue_description,
        ROW_NUMBER() OVER (
          PARTITION BY clue_key
          ORDER BY
            IF(clue_description IS NULL, 1, 0),
            LENGTH(COALESCE(clue_description, '')) DESC,
            clue_description
        ) AS rn
      FROM clue_catalog
      WHERE clue_key IS NOT NULL
        AND clue_key != ''
    )
    SELECT clue_key, clue_description
    FROM ranked
    WHERE rn = 1
  `;
  const [rows] = await gobClient.query({ query, location: 'US' });
  return new Map(
    (rows as Array<Record<string, unknown>>).map((row) => [
      String(row.clue_key ?? ''),
      row.clue_description ? String(row.clue_description) : '',
    ]),
  );
}

function parseYearMonthFromDateText(value: string | null | undefined) {
  if (!value) return { year: null as number | null, month: null as number | null };
  const [yearText, monthText] = String(value).split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return { year: null as number | null, month: null as number | null };
  }
  return { year, month };
}

async function getGob360OverviewFromMappedClaves(
  mappedClaves: string[],
  cutoffDate: string | null,
) {
  if (mappedClaves.length === 0) return null;
  const gobClient = getGob360BigQueryClient(true);
  const { pcSalesTableId, scSalesTableId } = getGob360TableRefs();
  const query = `
    WITH source_raw AS (
      SELECT 'pc' AS source_db, DB, CLUE, CLAVE, FECHA, FECHA_MOVIL, PIEZAS FROM \`${pcSalesTableId}\`
      UNION ALL
      SELECT 'sc' AS source_db, DB, CLUE, CLAVE, FECHA, FECHA_MOVIL, PIEZAS FROM \`${scSalesTableId}\`
    ),
    source_clean AS (
      SELECT
        source_db,
        CAST(CLUE AS STRING) AS clue,
        LOWER(REGEXP_REPLACE(TRIM(CAST(CLAVE AS STRING)), r'[^a-zA-Z0-9]+', '')) AS source_clave_normalized,
        COALESCE(
          SAFE_CAST(FECHA AS DATE),
          SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA), '$.value') AS DATE),
          SAFE_CAST(FECHA_MOVIL AS DATE),
          SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA_MOVIL), '$.value') AS DATE)
        ) AS event_date,
        SAFE_CAST(PIEZAS AS NUMERIC) AS pieces
      FROM source_raw
      WHERE UPPER(TRIM(CAST(DB AS STRING))) = 'DESPLAZAMIENTOS'
        AND CLAVE IS NOT NULL
        AND TRIM(CAST(CLAVE AS STRING)) != ''
    ),
    sc_month_candidates AS (
      SELECT DISTINCT DATE_TRUNC(event_date, MONTH) AS sc_month
      FROM source_clean
      WHERE source_db = 'sc'
        AND source_clave_normalized IN UNNEST(@mappedClaves)
        AND event_date IS NOT NULL
        AND (@cutoffDate IS NULL OR event_date <= DATE(@cutoffDate))
    ),
    sc_selected AS (
      SELECT
        CASE
          WHEN @cutoffDate IS NULL THEN MAX(sc_month)
          ELSE COALESCE(
            MAX(IF(sc_month = DATE_TRUNC(DATE(@cutoffDate), MONTH), sc_month, NULL)),
            MAX(sc_month)
          )
        END AS sc_selected_month
      FROM sc_month_candidates
    ),
    mapped AS (
      SELECT
        s.source_db,
        s.clue,
        s.source_clave_normalized,
        DATE_ADD(
          s.event_date,
          INTERVAL IF(
            s.source_db = 'sc'
            AND @cutoffDate IS NOT NULL
            AND sc.sc_selected_month IS NOT NULL
            AND sc.sc_selected_month < DATE_TRUNC(DATE(@cutoffDate), MONTH),
            DATE_DIFF(DATE_TRUNC(DATE(@cutoffDate), MONTH), sc.sc_selected_month, MONTH),
            0
          ) MONTH
        ) AS event_date,
        s.pieces,
        sc.sc_selected_month
      FROM source_clean s
      CROSS JOIN sc_selected sc
      WHERE s.source_clave_normalized IN UNNEST(@mappedClaves)
        AND s.event_date IS NOT NULL
        AND (@cutoffDate IS NULL OR s.event_date <= DATE(@cutoffDate))
        AND (
          s.source_db = 'pc'
          OR (
            s.source_db = 'sc'
            AND sc.sc_selected_month IS NOT NULL
            AND DATE_TRUNC(s.event_date, MONTH) IN (
              sc.sc_selected_month,
              DATE_SUB(sc.sc_selected_month, INTERVAL 1 YEAR)
            )
          )
        )
    ),
    latest_ctx AS (
      SELECT MAX(event_date) AS latest_date
      FROM mapped
    ),
    base AS (
      SELECT m.*, c.latest_date
      FROM mapped m
      CROSS JOIN latest_ctx c
      WHERE c.latest_date IS NOT NULL
    )
    SELECT
      CAST(MAX(latest_date) AS STRING) AS latest_date,
      CAST(MAX(sc_selected_month) AS STRING) AS sc_selected_month,
      IF(
        @cutoffDate IS NULL OR MAX(sc_selected_month) IS NULL,
        FALSE,
        MAX(sc_selected_month) < DATE_TRUNC(DATE(@cutoffDate), MONTH)
      ) AS sc_is_fallback,
      COALESCE(SUM(IF(EXTRACT(YEAR FROM event_date) = EXTRACT(YEAR FROM latest_date), pieces, 0)), 0) AS ytd_pieces,
      COALESCE(SUM(IF(EXTRACT(YEAR FROM event_date) = EXTRACT(YEAR FROM DATE_SUB(latest_date, INTERVAL 1 YEAR))
                      AND EXTRACT(MONTH FROM event_date) <= EXTRACT(MONTH FROM latest_date), pieces, 0)), 0) AS ytd_pieces_py,
      COALESCE(SUM(IF(event_date = DATE_TRUNC(latest_date, MONTH), pieces, 0)), 0) AS mth_pieces,
      COALESCE(SUM(IF(event_date = DATE_TRUNC(DATE_SUB(latest_date, INTERVAL 1 YEAR), MONTH), pieces, 0)), 0) AS mth_pieces_py,
      COUNT(DISTINCT IF(EXTRACT(YEAR FROM event_date) = EXTRACT(YEAR FROM latest_date), clue, NULL)) AS clues_active,
      (
        SELECT COUNT(DISTINCT s.clue)
        FROM source_clean s
        CROSS JOIN latest_ctx c
        WHERE c.latest_date IS NOT NULL
          AND EXTRACT(YEAR FROM s.event_date) = EXTRACT(YEAR FROM c.latest_date)
          AND EXTRACT(MONTH FROM s.event_date) <= EXTRACT(MONTH FROM c.latest_date)
      ) AS clues_total_ytd,
      (
        SELECT COUNT(DISTINCT cm.clue)
        FROM mapped cm
        CROSS JOIN latest_ctx c
        WHERE c.latest_date IS NOT NULL
          AND EXTRACT(YEAR FROM cm.event_date) = EXTRACT(YEAR FROM c.latest_date)
          AND EXTRACT(MONTH FROM cm.event_date) <= EXTRACT(MONTH FROM c.latest_date)
          AND cm.pieces > 0
      ) AS chiesi_clues_active_ytd
    FROM base
  `;
  const [rows] = await gobClient.query({
    query,
    params: { mappedClaves, cutoffDate },
    location: 'US',
  });
  return ((rows as Array<Record<string, unknown>>)[0] ?? null) as Gob360OverviewRow | null;
}

async function getGob360AggRowsByClave(mappedClaves: string[], cutoffDate: string | null) {
  if (mappedClaves.length === 0) return [];
  const gobClient = getGob360BigQueryClient(true);
  const { pcSalesTableId, scSalesTableId } = getGob360TableRefs();
  const query = `
    WITH source_raw AS (
      SELECT 'pc' AS source_db, DB, CLAVE, FECHA, FECHA_MOVIL, PIEZAS FROM \`${pcSalesTableId}\`
      UNION ALL
      SELECT 'sc' AS source_db, DB, CLAVE, FECHA, FECHA_MOVIL, PIEZAS FROM \`${scSalesTableId}\`
    ),
    source_clean AS (
      SELECT
        source_db,
        LOWER(REGEXP_REPLACE(TRIM(CAST(CLAVE AS STRING)), r'[^a-zA-Z0-9]+', '')) AS source_clave_normalized,
        COALESCE(
          SAFE_CAST(FECHA AS DATE),
          SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA), '$.value') AS DATE),
          SAFE_CAST(FECHA_MOVIL AS DATE),
          SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA_MOVIL), '$.value') AS DATE)
        ) AS event_date,
        SAFE_CAST(PIEZAS AS NUMERIC) AS pieces
      FROM source_raw
      WHERE UPPER(TRIM(CAST(DB AS STRING))) = 'DESPLAZAMIENTOS'
        AND CLAVE IS NOT NULL
        AND TRIM(CAST(CLAVE AS STRING)) != ''
    ),
    sc_month_candidates AS (
      SELECT DISTINCT DATE_TRUNC(event_date, MONTH) AS sc_month
      FROM source_clean
      WHERE source_db = 'sc'
        AND source_clave_normalized IN UNNEST(@mappedClaves)
        AND event_date IS NOT NULL
        AND (@cutoffDate IS NULL OR event_date <= DATE(@cutoffDate))
    ),
    sc_selected AS (
      SELECT
        CASE
          WHEN @cutoffDate IS NULL THEN MAX(sc_month)
          ELSE COALESCE(
            MAX(IF(sc_month = DATE_TRUNC(DATE(@cutoffDate), MONTH), sc_month, NULL)),
            MAX(sc_month)
          )
        END AS sc_selected_month
      FROM sc_month_candidates
    ),
    mapped AS (
      SELECT
        s.source_db,
        s.source_clave_normalized,
        DATE_ADD(
          s.event_date,
          INTERVAL IF(
            s.source_db = 'sc'
            AND @cutoffDate IS NOT NULL
            AND sc.sc_selected_month IS NOT NULL
            AND sc.sc_selected_month < DATE_TRUNC(DATE(@cutoffDate), MONTH),
            DATE_DIFF(DATE_TRUNC(DATE(@cutoffDate), MONTH), sc.sc_selected_month, MONTH),
            0
          ) MONTH
        ) AS event_date,
        s.pieces
      FROM source_clean s
      CROSS JOIN sc_selected sc
      WHERE s.source_clave_normalized IN UNNEST(@mappedClaves)
        AND s.event_date IS NOT NULL
        AND (@cutoffDate IS NULL OR s.event_date <= DATE(@cutoffDate))
        AND (
          s.source_db = 'pc'
          OR (
            s.source_db = 'sc'
            AND sc.sc_selected_month IS NOT NULL
            AND DATE_TRUNC(s.event_date, MONTH) IN (
              sc.sc_selected_month,
              DATE_SUB(sc.sc_selected_month, INTERVAL 1 YEAR)
            )
          )
        )
    ),
    ctx AS (
      SELECT MAX(event_date) AS latest_date FROM mapped
    ),
    filtered AS (
      SELECT m.*, c.latest_date
      FROM mapped m
      CROSS JOIN ctx c
      WHERE c.latest_date IS NOT NULL
        AND m.event_date BETWEEN DATE(EXTRACT(YEAR FROM DATE_SUB(c.latest_date, INTERVAL 1 YEAR)), 1, 1) AND c.latest_date
    )
    SELECT
      CAST(latest_date AS STRING) AS latest_date,
      source_clave_normalized,
      CAST(event_date AS STRING) AS event_date,
      COALESCE(SUM(pieces), 0) AS pieces
    FROM filtered
    GROUP BY 1, 2, 3
  `;
  const [rows] = await gobClient.query({
    query,
    params: { mappedClaves, cutoffDate },
    location: 'US',
  });
  return rows as unknown as Gob360AggRow[];
}

async function getGob360RankingRowsByClave(mappedClaves: string[], cutoffDate: string | null) {
  if (mappedClaves.length === 0) return [];
  const gobClient = getGob360BigQueryClient(true);
  const { pcSalesTableId, scSalesTableId } = getGob360TableRefs();
  const query = `
    WITH source_raw AS (
      SELECT 'pc' AS source_db, DB, CLUE, CLAVE, RUTA, FECHA, FECHA_MOVIL, PIEZAS FROM \`${pcSalesTableId}\`
      UNION ALL
      SELECT 'sc' AS source_db, DB, CLUE, CLAVE, RUTA, FECHA, FECHA_MOVIL, PIEZAS FROM \`${scSalesTableId}\`
    ),
    source_clean AS (
      SELECT
        source_db,
        CAST(CLUE AS STRING) AS clue,
        COALESCE(NULLIF(TRIM(CAST(CLAVE AS STRING)), ''), 'NO CLAVE') AS source_clave_raw,
        LOWER(REGEXP_REPLACE(TRIM(CAST(CLAVE AS STRING)), r'[^a-zA-Z0-9]+', '')) AS source_clave_normalized,
        CAST(RUTA AS STRING) AS ruta,
        COALESCE(
          SAFE_CAST(FECHA AS DATE),
          SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA), '$.value') AS DATE),
          SAFE_CAST(FECHA_MOVIL AS DATE),
          SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA_MOVIL), '$.value') AS DATE)
        ) AS event_date,
        SAFE_CAST(PIEZAS AS NUMERIC) AS pieces
      FROM source_raw
      WHERE UPPER(TRIM(CAST(DB AS STRING))) = 'DESPLAZAMIENTOS'
        AND CLAVE IS NOT NULL
        AND TRIM(CAST(CLAVE AS STRING)) != ''
    ),
    sc_month_candidates AS (
      SELECT DISTINCT DATE_TRUNC(event_date, MONTH) AS sc_month
      FROM source_clean
      WHERE source_db = 'sc'
        AND source_clave_normalized IN UNNEST(@mappedClaves)
        AND event_date IS NOT NULL
        AND (@cutoffDate IS NULL OR event_date <= DATE(@cutoffDate))
    ),
    sc_selected AS (
      SELECT
        CASE
          WHEN @cutoffDate IS NULL THEN MAX(sc_month)
          ELSE COALESCE(
            MAX(IF(sc_month = DATE_TRUNC(DATE(@cutoffDate), MONTH), sc_month, NULL)),
            MAX(sc_month)
          )
        END AS sc_selected_month
      FROM sc_month_candidates
    ),
    mapped AS (
      SELECT
        s.source_db,
        s.clue,
        s.source_clave_raw,
        s.source_clave_normalized,
        s.ruta,
        DATE_ADD(
          s.event_date,
          INTERVAL IF(
            s.source_db = 'sc'
            AND @cutoffDate IS NOT NULL
            AND sc.sc_selected_month IS NOT NULL
            AND sc.sc_selected_month < DATE_TRUNC(DATE(@cutoffDate), MONTH),
            DATE_DIFF(DATE_TRUNC(DATE(@cutoffDate), MONTH), sc.sc_selected_month, MONTH),
            0
          ) MONTH
        ) AS event_date,
        s.pieces
      FROM source_clean s
      CROSS JOIN sc_selected sc
      WHERE s.source_clave_normalized IN UNNEST(@mappedClaves)
        AND s.event_date IS NOT NULL
        AND (@cutoffDate IS NULL OR s.event_date <= DATE(@cutoffDate))
        AND (
          s.source_db = 'pc'
          OR (
            s.source_db = 'sc'
            AND sc.sc_selected_month IS NOT NULL
            AND DATE_TRUNC(s.event_date, MONTH) IN (
              sc.sc_selected_month,
              DATE_SUB(sc.sc_selected_month, INTERVAL 1 YEAR)
            )
          )
        )
    ),
    ctx AS (
      SELECT MAX(event_date) AS latest_date FROM mapped
    ),
    filtered AS (
      SELECT m.*, c.latest_date
      FROM mapped m
      CROSS JOIN ctx c
      WHERE c.latest_date IS NOT NULL
        AND m.event_date BETWEEN DATE(EXTRACT(YEAR FROM DATE_SUB(c.latest_date, INTERVAL 1 YEAR)), 1, 1) AND c.latest_date
    )
    SELECT
      CAST(latest_date AS STRING) AS latest_date,
      source_clave_normalized,
      source_clave_raw,
      COALESCE(NULLIF(TRIM(clue), ''), 'NO CLUE') AS clue,
      COALESCE(NULLIF(TRIM(ruta), ''), 'NO RUTA') AS ruta,
      CAST(event_date AS STRING) AS event_date,
      COALESCE(SUM(pieces), 0) AS pieces
    FROM filtered
    GROUP BY 1, 2, 3, 4, 5, 6
  `;
  const [rows] = await gobClient.query({
    query,
    params: { mappedClaves, cutoffDate },
    location: 'US',
  });
  return rows as unknown as Gob360RankingRawRow[];
}

async function getPublicMarketContext(reportingVersionId?: string) {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) {
    return {
      reportingVersionId: null as string | null,
      cutoffDate: null as string | null,
    };
  }

  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        CAST(MAX(source_as_of_month) AS STRING) AS cutoff_date
      FROM \`${RAW_UPLOADS}\`
      WHERE reporting_version_id = @reportingVersionId
        AND LOWER(TRIM(module_code)) IN ('business_excellence_ddd', 'business_excellence_pmm', 'ddd', 'pmm')
        AND status IN ('normalized', 'published')
        AND source_as_of_month IS NOT NULL
    `,
    params: { reportingVersionId: resolvedReportingVersionId },
  });

  const cutoffFromUploads = (rows as Array<Record<string, unknown>>)[0]?.cutoff_date;
  if (cutoffFromUploads) {
    return {
      reportingVersionId: resolvedReportingVersionId,
      cutoffDate: String(cutoffFromUploads),
    };
  }

  const [pmmRows] = await client.query({
    query: `
      SELECT CAST(MAX(source_as_of_month) AS STRING) AS cutoff_date
      FROM \`${PMM_ENRICHED_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
        AND source_as_of_month IS NOT NULL
    `,
    params: { reportingVersionId: resolvedReportingVersionId },
  });
  const cutoffFromPmm = (pmmRows as Array<Record<string, unknown>>)[0]?.cutoff_date;
  if (cutoffFromPmm) {
    return {
      reportingVersionId: resolvedReportingVersionId,
      cutoffDate: String(cutoffFromPmm),
    };
  }

  const [versionRows] = await client.query({
    query: `
      SELECT CAST(period_month AS STRING) AS period_month
      FROM \`${REPORTING_VERSIONS_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
      LIMIT 1
    `,
    params: { reportingVersionId: resolvedReportingVersionId },
  });
  const periodMonth = (versionRows as Array<Record<string, unknown>>)[0]?.period_month;

  return {
    reportingVersionId: resolvedReportingVersionId,
    cutoffDate: periodMonth ? String(periodMonth) : null,
  };
}

async function getGovernmentBudgetAgg(
  latestYear: number,
  latestMonth: number,
  reportingVersionId?: string,
): Promise<GovernmentBudgetAggRow[]> {
  const client = getBigQueryClient();
  const versionFilter = reportingVersionId
    ? 'AND reporting_version_id = @reportingVersionId'
    : `
      AND reporting_version_id = (
        SELECT reporting_version_id
        FROM \`${SELL_OUT_ENRICHED_VIEW}\`
        WHERE LOWER(TRIM(source_scope)) = 'gobierno'
          AND LOWER(TRIM(channel)) = 'gobierno'
        ORDER BY report_period_month DESC, source_as_of_month DESC
        LIMIT 1
      )
    `;
  const query = `
    SELECT
      COALESCE(NULLIF(TRIM(market_group), ''), 'No Market') AS market_group,
      COALESCE(SUM(IF(EXTRACT(YEAR FROM period_month) = @latestYear AND EXTRACT(MONTH FROM period_month) <= @latestMonth, amount_value, 0)), 0) AS ytd_budget_units,
      COALESCE(SUM(IF(EXTRACT(YEAR FROM period_month) = @latestYear - 1 AND EXTRACT(MONTH FROM period_month) <= @latestMonth, amount_value, 0)), 0) AS ytd_budget_units_py,
      COALESCE(SUM(IF(EXTRACT(YEAR FROM period_month) = @latestYear AND EXTRACT(MONTH FROM period_month) = @latestMonth, amount_value, 0)), 0) AS mth_budget_units,
      COALESCE(SUM(IF(EXTRACT(YEAR FROM period_month) = @latestYear - 1 AND EXTRACT(MONTH FROM period_month) = @latestMonth, amount_value, 0)), 0) AS mth_budget_units_py
    FROM \`${SELL_OUT_ENRICHED_VIEW}\`
    WHERE resolved_product_id IS NOT NULL
      AND TRIM(resolved_product_id) != ''
      AND period_month IS NOT NULL
      AND LOWER(TRIM(source_scope)) = 'gobierno'
      AND LOWER(TRIM(channel)) = 'gobierno'
      AND LOWER(TRIM(sales_group)) = 'units'
      ${versionFilter}
    GROUP BY 1
  `;
  const [rows] = await client.query({
    query,
    params: reportingVersionId
      ? { latestYear, latestMonth, reportingVersionId }
      : { latestYear, latestMonth },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    marketGroup: row.market_group ? String(row.market_group) : null,
    ytdBudgetUnits: Number(row.ytd_budget_units ?? 0),
    ytdBudgetUnitsPy: Number(row.ytd_budget_units_py ?? 0),
    mthBudgetUnits: Number(row.mth_budget_units ?? 0),
    mthBudgetUnitsPy: Number(row.mth_budget_units_py ?? 0),
  }));
}

export async function getBusinessExcellencePublicMarketOverview(
  reportingVersionId?: string,
): Promise<BusinessExcellencePublicMarketOverview | null> {
  const context = await getPublicMarketContext(reportingVersionId);
  const mappingRows = await getGob360MappedClaves();
  if (mappingRows.length === 0) return null;

  const mappedClaves = mappingRows
    .filter((row) => row.productId && row.productId.trim() !== '')
    .map((row) => row.sourceClaveNormalized);
  if (mappedClaves.length === 0) return null;
  const mappingByClave = new Map(
    mappingRows.map((row) => [
      row.sourceClaveNormalized,
      { unitsFactor: Number((row as { unitsFactor?: number }).unitsFactor ?? 1) },
    ]),
  );
  const row = await getGob360OverviewFromMappedClaves(mappedClaves, context.cutoffDate);
  if (!row) return null;
  const sourceRows = await getGob360AggRowsByClave(mappedClaves, context.cutoffDate);
  if (sourceRows.length === 0) return null;

  const latestRef = parseYearMonthFromDateText(row.latest_date ? String(row.latest_date) : null);
  if (latestRef.year === null || latestRef.month === null) return null;
  const latestYear = latestRef.year;
  const latestMonth = latestRef.month;
  const pyYear = latestYear - 1;

  let ytdPieces = 0;
  let ytdPiecesPy = 0;
  let mthPieces = 0;
  let mthPiecesPy = 0;
  for (const sourceRow of sourceRows) {
    const mapping = mappingByClave.get(String(sourceRow.source_clave_normalized ?? ''));
    const factor = mapping?.unitsFactor ?? 1;
    const eventRef = parseYearMonthFromDateText(String(sourceRow.event_date ?? ''));
    if (eventRef.year === null || eventRef.month === null) continue;
    const year = eventRef.year;
    const month = eventRef.month;
    const pieces = Number(sourceRow.pieces ?? 0) * factor;
    if (year === latestYear && month <= latestMonth) ytdPieces += pieces;
    if (year === pyYear && month <= latestMonth) ytdPiecesPy += pieces;
    if (year === latestYear && month === latestMonth) mthPieces += pieces;
    if (year === pyYear && month === latestMonth) mthPiecesPy += pieces;
  }

  const cluesTotalYtd = Number(row.clues_total_ytd ?? 0);
  const chiesiCluesActiveYtd = Number(row.chiesi_clues_active_ytd ?? 0);
  const scIsFallbackRaw = row.sc_is_fallback as unknown;
  const scIsFallbackText = String(scIsFallbackRaw ?? '').toLowerCase();
  const scSourceIsFallback =
    scIsFallbackRaw === true ||
    scIsFallbackText === '1' ||
    scIsFallbackText === 'true';

  return {
    latestDate: row.latest_date ? String(row.latest_date) : null,
    scSourceMonth: row.sc_selected_month ? String(row.sc_selected_month) : null,
    scSourceIsFallback,
    ytdPieces,
    ytdPiecesPy,
    ytdGrowthPct: ytdPiecesPy === 0 ? null : ((ytdPieces - ytdPiecesPy) / ytdPiecesPy) * 100,
    mthPieces,
    mthPiecesPy,
    mthGrowthPct: mthPiecesPy === 0 ? null : ((mthPieces - mthPiecesPy) / mthPiecesPy) * 100,
    cluesActive: Number(row.clues_active ?? 0),
    cluesTotalYtd,
    chiesiCluesActiveYtd,
    chiesiClueCoveragePct:
      cluesTotalYtd === 0 ? null : (chiesiCluesActiveYtd / cluesTotalYtd) * 100,
  };
}

export async function getBusinessExcellencePublicMarketTopProducts(
  limit = 15,
  reportingVersionId?: string,
): Promise<BusinessExcellencePublicMarketTopProductRow[]> {
  const context = await getPublicMarketContext(reportingVersionId);
  const [mappingRows, brandMap] = await Promise.all([
    getGob360MappedClaves(),
    getProductMetadataBrandMap(),
  ]);
  if (mappingRows.length === 0) return [];

  const mappingByClave = new Map(
    mappingRows.map((row) => [
      row.sourceClaveNormalized,
      {
        productId: row.productId,
        marketGroup: row.marketGroup,
        unitsFactor: Number((row as { unitsFactor?: number }).unitsFactor ?? 1),
      },
    ]),
  );
  const mappedClaves = mappingRows.map((row) => row.sourceClaveNormalized);
  const sourceRows = await getGob360AggRowsByClave(mappedClaves, context.cutoffDate);
  if (sourceRows.length === 0) return [];

  const latestRef = parseYearMonthFromDateText(sourceRows[0]?.latest_date ?? null);
  if (latestRef.year === null || latestRef.month === null) return [];
  const latestYear = latestRef.year;
  const latestMonth = latestRef.month;
  const pyYear = latestYear - 1;
  const budgetRows = await getGovernmentBudgetAgg(
    latestYear,
    latestMonth,
    context.reportingVersionId ?? reportingVersionId,
  );
  const budgetByMarket = new Map(
    budgetRows.map((row) => [
      row.marketGroup ?? 'No Market',
      {
        ytd: row.ytdBudgetUnits,
        ytdPy: row.ytdBudgetUnitsPy,
        mth: row.mthBudgetUnits,
        mthPy: row.mthBudgetUnitsPy,
      },
    ]),
  );

  const marketAgg = new Map<
    string,
    {
      marketGroup: string | null;
      chiesiProductIds: Set<string>;
      chiesiBrandNames: Set<string>;
      chiesiYtdUnits: number;
      chiesiYtdUnitsPy: number;
      chiesiMthUnits: number;
      chiesiMthUnitsPy: number;
      marketYtdUnits: number;
      marketYtdUnitsPy: number;
      marketMthUnits: number;
      marketMthUnitsPy: number;
    }
  >();

  for (const row of sourceRows) {
    const mapping = mappingByClave.get(String(row.source_clave_normalized ?? ''));
    if (!mapping) continue;

    const eventRef = parseYearMonthFromDateText(String(row.event_date ?? ''));
    if (eventRef.year === null || eventRef.month === null) continue;
    const year = eventRef.year;
    const month = eventRef.month;
    const pieces = Number(row.pieces ?? 0) * (mapping.unitsFactor ?? 1);
    const productId = mapping.productId;
    const isChiesi = Boolean(productId && productId.trim() !== '');
    const marketKey = mapping.marketGroup ?? 'No Market';
    const current = marketAgg.get(marketKey) ?? {
      marketGroup: mapping.marketGroup ?? null,
      chiesiProductIds: new Set<string>(),
      chiesiBrandNames: new Set<string>(),
      chiesiYtdUnits: 0,
      chiesiYtdUnitsPy: 0,
      chiesiMthUnits: 0,
      chiesiMthUnitsPy: 0,
      marketYtdUnits: 0,
      marketYtdUnitsPy: 0,
      marketMthUnits: 0,
      marketMthUnitsPy: 0,
    };

    if (year === latestYear) {
      current.marketYtdUnits += pieces;
      if (month === latestMonth) current.marketMthUnits += pieces;
    }
    if (year === pyYear && month <= latestMonth) {
      current.marketYtdUnitsPy += pieces;
      if (month === latestMonth) current.marketMthUnitsPy += pieces;
    }
    if (isChiesi) {
      const brandName = brandMap.get(productId as string) ?? 'Unmapped Brand';
      current.chiesiProductIds.add(productId as string);
      current.chiesiBrandNames.add(brandName);
      if (year === latestYear) {
        current.chiesiYtdUnits += pieces;
        if (month === latestMonth) current.chiesiMthUnits += pieces;
      }
      if (year === pyYear && month <= latestMonth) {
        current.chiesiYtdUnitsPy += pieces;
        if (month === latestMonth) current.chiesiMthUnitsPy += pieces;
      }
    }
    marketAgg.set(marketKey, current);
  }

  return [...marketAgg.values()]
    .filter((row) => row.chiesiProductIds.size > 0)
    .sort((a, b) => b.chiesiYtdUnits - a.chiesiYtdUnits)
    .slice(0, Math.max(1, limit))
    .map((row) => {
      const marketKey = row.marketGroup ?? 'No Market';
      const ytdMsPct = row.marketYtdUnits === 0 ? null : (row.chiesiYtdUnits / row.marketYtdUnits) * 100;
      const ytdMsPctPy = row.marketYtdUnitsPy === 0 ? null : (row.chiesiYtdUnitsPy / row.marketYtdUnitsPy) * 100;
      const mthMsPct = row.marketMthUnits === 0 ? null : (row.chiesiMthUnits / row.marketMthUnits) * 100;
      const mthMsPctPy = row.marketMthUnitsPy === 0 ? null : (row.chiesiMthUnitsPy / row.marketMthUnitsPy) * 100;
      const budget = budgetByMarket.get(marketKey) ?? { ytd: 0, ytdPy: 0, mth: 0, mthPy: 0 };
      const brandName = row.chiesiBrandNames.size === 1
        ? [...row.chiesiBrandNames][0]
        : 'Chiesi Portfolio';
      return {
        marketGroup: row.marketGroup,
        brandName,
        productId: row.chiesiProductIds.size === 1 ? [...row.chiesiProductIds][0] : null,
        ytdPieces: row.chiesiYtdUnits,
        ytdPiecesPy: row.chiesiYtdUnitsPy,
        ytdGrowthPct:
          row.chiesiYtdUnitsPy === 0 ? null : ((row.chiesiYtdUnits - row.chiesiYtdUnitsPy) / row.chiesiYtdUnitsPy) * 100,
        ytdMsPct,
        ytdMsPctPy,
        ytdEvolutionIndex:
          ytdMsPct === null || ytdMsPctPy === null || ytdMsPctPy === 0
            ? null
            : Math.round((ytdMsPct / ytdMsPctPy) * 100),
        mthPieces: row.chiesiMthUnits,
        mthPiecesPy: row.chiesiMthUnitsPy,
        mthGrowthPct:
          row.chiesiMthUnitsPy === 0 ? null : ((row.chiesiMthUnits - row.chiesiMthUnitsPy) / row.chiesiMthUnitsPy) * 100,
        mthMsPct,
        mthMsPctPy,
        mthEvolutionIndex:
          mthMsPct === null || mthMsPctPy === null || mthMsPctPy === 0
            ? null
            : Math.round((mthMsPct / mthMsPctPy) * 100),
        ytdBudgetUnits: budget.ytd,
        mthBudgetUnits: budget.mth,
        ytdCoverageVsBudgetPct: budget.ytd === 0 ? null : (row.chiesiYtdUnits / budget.ytd) * 100,
        mthCoverageVsBudgetPct: budget.mth === 0 ? null : (row.chiesiMthUnits / budget.mth) * 100,
        ytdVarianceVsBudgetPct:
          budget.ytd === 0 ? null : ((row.chiesiYtdUnits - budget.ytd) / budget.ytd) * 100,
        mthVarianceVsBudgetPct:
          budget.mth === 0 ? null : ((row.chiesiMthUnits - budget.mth) / budget.mth) * 100,
      };
    });
}

export async function getBusinessExcellencePublicMarketChartPoints(
  reportingVersionId?: string,
): Promise<BusinessExcellencePublicMarketChartPoint[]> {
  const context = await getPublicMarketContext(reportingVersionId);
  const mappingRows = await getGob360MappedClaves();
  if (mappingRows.length === 0) return [];

  const mappingByClave = new Map(
    mappingRows.map((row) => [
      row.sourceClaveNormalized,
      {
        productId: row.productId,
        marketGroup: row.marketGroup,
        unitsFactor: Number((row as { unitsFactor?: number }).unitsFactor ?? 1),
      },
    ]),
  );
  const mappedClaves = mappingRows.map((row) => row.sourceClaveNormalized);
  const sourceRows = await getGob360AggRowsByClave(mappedClaves, context.cutoffDate);
  if (sourceRows.length === 0) return [];

  const agg = new Map<string, number>();
  for (const row of sourceRows) {
    const mapping = mappingByClave.get(String(row.source_clave_normalized ?? ''));
    if (!mapping) continue;

    const marketGroup = mapping.marketGroup?.trim() || 'No Market';
    const eventRef = parseYearMonthFromDateText(String(row.event_date ?? ''));
    if (eventRef.year === null || eventRef.month === null) continue;
    const periodMonth = `${eventRef.year}-${String(eventRef.month).padStart(2, '0')}-01`;
    const units = Number(row.pieces ?? 0) * (mapping.unitsFactor ?? 1);

    const keyAll = `${marketGroup}|||all|||${periodMonth}`;
    agg.set(keyAll, (agg.get(keyAll) ?? 0) + units);

    const isChiesi = Boolean(mapping.productId && mapping.productId.trim() !== '');
    if (isChiesi) {
      const keyChiesi = `${marketGroup}|||chiesi|||${periodMonth}`;
      agg.set(keyChiesi, (agg.get(keyChiesi) ?? 0) + units);
    }
  }

  return [...agg.entries()]
    .map(([key, units]) => {
      const [marketGroup, scopeRaw, periodMonth] = key.split('|||');
      return {
        marketGroup,
        scope: (scopeRaw === 'chiesi' ? 'chiesi' : 'all') as 'all' | 'chiesi',
        periodMonth,
        units,
      };
    })
    .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth));
}

export async function getBusinessExcellencePublicDimensionRankingRows(
  reportingVersionId?: string,
): Promise<BusinessExcellencePublicDimensionRankingRow[]> {
  const context = await getPublicMarketContext(reportingVersionId);
  const [mappingRows, clueDescriptionCatalog] = await Promise.all([
    getGob360MappedClaves(),
    getGob360ClueDescriptionCatalog().catch(() => new Map<string, string>()),
  ]);
  if (mappingRows.length === 0) return [];

  const mappingByClave = new Map(
    mappingRows.map((row) => [
      row.sourceClaveNormalized,
      {
        productId: row.productId,
        marketGroup: row.marketGroup,
        unitsFactor: Number((row as { unitsFactor?: number }).unitsFactor ?? 1),
      },
    ]),
  );
  const mappedClaves = mappingRows.map((row) => row.sourceClaveNormalized);
  const sourceRows = await getGob360RankingRowsByClave(mappedClaves, context.cutoffDate);
  if (sourceRows.length === 0) return [];

  const latestRef = parseYearMonthFromDateText(sourceRows[0]?.latest_date ?? null);
  if (latestRef.year === null || latestRef.month === null) return [];
  const latestYear = latestRef.year;
  const latestMonth = latestRef.month;
  const pyYear = latestYear - 1;

  const aggregate = new Map<string, { ytdUnits: number; ytdPyUnits: number }>();

  for (const row of sourceRows) {
    const mapping = mappingByClave.get(String(row.source_clave_normalized ?? ''));
    if (!mapping) continue;
    const marketGroup = mapping.marketGroup?.trim() || 'No Market';
    const isChiesi = Boolean(mapping.productId && mapping.productId.trim() !== '');
    const eventRef = parseYearMonthFromDateText(String(row.event_date ?? ''));
    if (eventRef.year === null || eventRef.month === null) continue;
    const year = eventRef.year;
    const month = eventRef.month;
    const pieces = Number(row.pieces ?? 0) * (mapping.unitsFactor ?? 1);

    const clueCode = row.clue || 'NO CLUE';
    const clueKey = clueCode
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
    const clueDescription = clueDescriptionCatalog.get(clueKey);

    const labels: Array<{ dimension: 'clue' | 'clave' | 'ruta'; label: string }> = [
      { dimension: 'clue', label: clueDescription && clueDescription.trim() ? clueDescription : clueCode },
      { dimension: 'clave', label: row.source_clave_raw || 'NO CLAVE' },
      { dimension: 'ruta', label: row.ruta || 'NO RUTA' },
    ];

    const scopes: Array<'all' | 'chiesi'> = isChiesi ? ['all', 'chiesi'] : ['all'];

    for (const scope of scopes) {
      for (const item of labels) {
        const key = `${marketGroup}|||${scope}|||${item.dimension}|||${item.label}`;
        const current = aggregate.get(key) ?? { ytdUnits: 0, ytdPyUnits: 0 };
        if (year === latestYear && month <= latestMonth) current.ytdUnits += pieces;
        if (year === pyYear && month <= latestMonth) current.ytdPyUnits += pieces;
        aggregate.set(key, current);
      }
    }
  }

  return [...aggregate.entries()].map(([key, values]) => {
    const [marketGroup, scopeRaw, dimensionRaw, label] = key.split('|||');
    const growthVsPyPct =
      values.ytdPyUnits > 0 ? ((values.ytdUnits - values.ytdPyUnits) / values.ytdPyUnits) * 100 : null;
    return {
      marketGroup,
      scope: (scopeRaw === 'chiesi' ? 'chiesi' : 'all') as 'all' | 'chiesi',
      dimension: (dimensionRaw as 'clue' | 'clave' | 'ruta'),
      label,
      ytdUnits: values.ytdUnits,
      ytdPyUnits: values.ytdPyUnits,
      growthVsPyPct,
    };
  });
}

async function getPrivateBusinessUnitUnits(reportingVersionId?: string) {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];
  const client = getBigQueryClient();
  const query = `
    WITH product_meta AS (
      SELECT product_id, business_unit_name
      FROM (
        SELECT
          pm.*,
          ROW_NUMBER() OVER (
            PARTITION BY pm.product_id
            ORDER BY pm.updated_at DESC, pm.created_at DESC
          ) AS rn
        FROM \`${PRODUCT_METADATA_TABLE}\` pm
      )
      WHERE rn = 1
    ),
    ctx AS (
      SELECT MAX(source_date) AS latest_date
      FROM \`${PMM_ENRICHED_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
        AND LOWER(TRIM(sales_group)) = 'units'
        AND resolved_product_id IS NOT NULL
        AND TRIM(resolved_product_id) != ''
        AND source_date IS NOT NULL
    ),
    private_units AS (
      SELECT
        COALESCE(NULLIF(TRIM(pm.business_unit_name), ''), 'Unclassified BU') AS business_unit_name,
        p.source_date,
        p.amount_value,
        c.latest_date
      FROM \`${PMM_ENRICHED_TABLE}\` p
      JOIN ctx c ON c.latest_date IS NOT NULL
      LEFT JOIN product_meta pm
        ON p.resolved_product_id = pm.product_id
      WHERE p.reporting_version_id = @reportingVersionId
        AND LOWER(TRIM(p.sales_group)) = 'units'
        AND p.resolved_product_id IS NOT NULL
        AND TRIM(p.resolved_product_id) != ''
        AND p.source_date IS NOT NULL
    ),
    private_budget AS (
      SELECT
        COALESCE(NULLIF(TRIM(b.business_unit_name), ''), 'Unclassified BU') AS business_unit_name,
        b.period_month,
        b.amount_value,
        c.latest_date
      FROM \`${SELL_OUT_ENRICHED_VIEW}\` b
      JOIN ctx c ON c.latest_date IS NOT NULL
      WHERE b.reporting_version_id = @reportingVersionId
        AND b.resolved_product_id IS NOT NULL
        AND TRIM(b.resolved_product_id) != ''
        AND b.period_month IS NOT NULL
        AND LOWER(TRIM(b.source_scope)) = 'privado'
        AND LOWER(TRIM(b.channel)) = 'privado'
        AND LOWER(TRIM(b.sales_group)) = 'units'
    ),
    units_agg AS (
      SELECT
        business_unit_name,
        COALESCE(SUM(IF(
          EXTRACT(YEAR FROM source_date) = EXTRACT(YEAR FROM latest_date)
          AND EXTRACT(MONTH FROM source_date) <= EXTRACT(MONTH FROM latest_date),
          amount_value,
          0
        )), 0) AS private_ytd_units,
        COALESCE(SUM(IF(
          EXTRACT(YEAR FROM source_date) = EXTRACT(YEAR FROM DATE_SUB(latest_date, INTERVAL 1 YEAR))
          AND EXTRACT(MONTH FROM source_date) <= EXTRACT(MONTH FROM latest_date),
          amount_value,
          0
        )), 0) AS private_ytd_units_py,
        COALESCE(SUM(IF(
          source_date = DATE_TRUNC(latest_date, MONTH),
          amount_value,
          0
        )), 0) AS private_mth_units,
        COALESCE(SUM(IF(
          source_date = DATE_TRUNC(DATE_SUB(latest_date, INTERVAL 1 YEAR), MONTH),
          amount_value,
          0
        )), 0) AS private_mth_units_py
      FROM private_units
      GROUP BY 1
    ),
    budget_agg AS (
      SELECT
        business_unit_name,
        COALESCE(SUM(IF(
          EXTRACT(YEAR FROM period_month) = EXTRACT(YEAR FROM latest_date)
          AND EXTRACT(MONTH FROM period_month) <= EXTRACT(MONTH FROM latest_date),
          amount_value,
          0
        )), 0) AS private_ytd_budget_units,
        COALESCE(SUM(IF(
          period_month = DATE_TRUNC(latest_date, MONTH),
          amount_value,
          0
        )), 0) AS private_mth_budget_units
      FROM private_budget
      GROUP BY 1
    )
    SELECT
      COALESCE(u.business_unit_name, b.business_unit_name) AS business_unit_name,
      COALESCE(u.private_ytd_units, 0) AS private_ytd_units,
      COALESCE(u.private_ytd_units_py, 0) AS private_ytd_units_py,
      COALESCE(u.private_mth_units, 0) AS private_mth_units,
      COALESCE(u.private_mth_units_py, 0) AS private_mth_units_py,
      COALESCE(b.private_ytd_budget_units, 0) AS private_ytd_budget_units,
      COALESCE(b.private_mth_budget_units, 0) AS private_mth_budget_units
    FROM units_agg u
    FULL OUTER JOIN budget_agg b
      ON u.business_unit_name = b.business_unit_name
  `;
  const [rows] = await client.query({
    query,
    params: { reportingVersionId: resolvedReportingVersionId },
  });
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    businessUnitName: String(row.business_unit_name ?? 'Unclassified BU'),
    privateYtdUnits: Number(row.private_ytd_units ?? 0),
    privateYtdUnitsPy: Number(row.private_ytd_units_py ?? 0),
    privateMthUnits: Number(row.private_mth_units ?? 0),
    privateMthUnitsPy: Number(row.private_mth_units_py ?? 0),
    privateYtdBudgetUnits: Number(row.private_ytd_budget_units ?? 0),
    privateMthBudgetUnits: Number(row.private_mth_budget_units ?? 0),
  }));
}

async function getGovernmentBudgetByBusinessUnit(
  latestYear: number,
  latestMonth: number,
  reportingVersionId?: string,
) {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];
  const client = getBigQueryClient();
  const query = `
    SELECT
      COALESCE(NULLIF(TRIM(business_unit_name), ''), 'Unclassified BU') AS business_unit_name,
      COALESCE(SUM(IF(
        EXTRACT(YEAR FROM period_month) = @latestYear
        AND EXTRACT(MONTH FROM period_month) <= @latestMonth,
        amount_value,
        0
      )), 0) AS public_ytd_budget_units,
      COALESCE(SUM(IF(
        EXTRACT(YEAR FROM period_month) = @latestYear
        AND EXTRACT(MONTH FROM period_month) = @latestMonth,
        amount_value,
        0
      )), 0) AS public_mth_budget_units
    FROM \`${SELL_OUT_ENRICHED_VIEW}\`
    WHERE reporting_version_id = @reportingVersionId
      AND resolved_product_id IS NOT NULL
      AND TRIM(resolved_product_id) != ''
      AND period_month IS NOT NULL
      AND LOWER(TRIM(source_scope)) = 'gobierno'
      AND LOWER(TRIM(channel)) = 'gobierno'
      AND LOWER(TRIM(sales_group)) = 'units'
    GROUP BY 1
  `;
  const [rows] = await client.query({
    query,
    params: {
      reportingVersionId: resolvedReportingVersionId,
      latestYear,
      latestMonth,
    },
  });
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    businessUnitName: String(row.business_unit_name ?? 'Unclassified BU'),
    publicYtdBudgetUnits: Number(row.public_ytd_budget_units ?? 0),
    publicMthBudgetUnits: Number(row.public_mth_budget_units ?? 0),
  }));
}

async function getPublicBusinessUnitUnits(reportingVersionId?: string) {
  const context = await getPublicMarketContext(reportingVersionId);
  const [mappingRows, businessUnitMap] = await Promise.all([
    getGob360MappedClaves(),
    getProductMetadataBusinessUnitMap(),
  ]);
  if (mappingRows.length === 0) return [];

  const mappingByClave = new Map(
    mappingRows.map((row) => [
      row.sourceClaveNormalized,
      {
        productId: row.productId,
        unitsFactor: Number((row as { unitsFactor?: number }).unitsFactor ?? 1),
      },
    ]),
  );
  const mappedClaves = mappingRows
    .filter((row) => row.productId && row.productId.trim() !== '')
    .map((row) => row.sourceClaveNormalized);
  if (mappedClaves.length === 0) return [];

  const sourceRows = await getGob360AggRowsByClave(mappedClaves, context.cutoffDate);
  if (sourceRows.length === 0) return [];

  const latestRef = parseYearMonthFromDateText(sourceRows[0]?.latest_date ?? null);
  if (latestRef.year === null || latestRef.month === null) return [];
  const latestYear = latestRef.year;
  const latestMonth = latestRef.month;
  const publicBudgetRows = await getGovernmentBudgetByBusinessUnit(
    latestYear,
    latestMonth,
    context.reportingVersionId ?? reportingVersionId,
  );
  const publicBudgetByBu = new Map(
    publicBudgetRows.map((row) => [
      row.businessUnitName,
      {
        publicYtdBudgetUnits: row.publicYtdBudgetUnits,
        publicMthBudgetUnits: row.publicMthBudgetUnits,
      },
    ]),
  );

  const pyYear = latestYear - 1;
  const aggregate = new Map<
    string,
    { publicYtdUnits: number; publicYtdUnitsPy: number; publicMthUnits: number; publicMthUnitsPy: number }
  >();
  for (const row of sourceRows) {
    const mapping = mappingByClave.get(String(row.source_clave_normalized ?? ''));
    const productId = mapping?.productId ?? null;
    if (!productId || productId.trim() === '') continue;
    const businessUnitName = businessUnitMap.get(productId) ?? 'Unclassified BU';

    const eventRef = parseYearMonthFromDateText(String(row.event_date ?? ''));
    if (eventRef.year === null || eventRef.month === null) continue;
    const year = eventRef.year;
    const month = eventRef.month;
    const pieces = Number(row.pieces ?? 0) * (mapping?.unitsFactor ?? 1);

    const current = aggregate.get(businessUnitName) ?? {
      publicYtdUnits: 0,
      publicYtdUnitsPy: 0,
      publicMthUnits: 0,
      publicMthUnitsPy: 0,
    };
    if (year === latestYear && month <= latestMonth) current.publicYtdUnits += pieces;
    if (year === pyYear && month <= latestMonth) current.publicYtdUnitsPy += pieces;
    if (year === latestYear && month === latestMonth) current.publicMthUnits += pieces;
    if (year === pyYear && month === latestMonth) current.publicMthUnitsPy += pieces;
    aggregate.set(businessUnitName, current);
  }

  return [...aggregate.entries()].map(([businessUnitName, values]) => {
    const budget = publicBudgetByBu.get(businessUnitName) ?? {
      publicYtdBudgetUnits: 0,
      publicMthBudgetUnits: 0,
    };
    return {
      businessUnitName,
      publicYtdUnits: values.publicYtdUnits,
      publicYtdUnitsPy: values.publicYtdUnitsPy,
      publicMthUnits: values.publicMthUnits,
      publicMthUnitsPy: values.publicMthUnitsPy,
      publicYtdBudgetUnits: budget.publicYtdBudgetUnits,
      publicMthBudgetUnits: budget.publicMthBudgetUnits,
    };
  });
}

export async function getBusinessExcellenceBusinessUnitChannelRows(
  reportingVersionId?: string,
): Promise<BusinessExcellenceBusinessUnitChannelRow[]> {
  const [privateRows, publicRows] = await Promise.all([
    getPrivateBusinessUnitUnits(reportingVersionId),
    getPublicBusinessUnitUnits(reportingVersionId),
  ]);

  const merged = new Map<
    string,
    {
      privateYtdUnits: number;
      privateYtdUnitsPy: number;
      privateYtdBudgetUnits: number;
      publicYtdUnits: number;
      publicYtdUnitsPy: number;
      publicYtdBudgetUnits: number;
      privateMthUnits: number;
      privateMthUnitsPy: number;
      privateMthBudgetUnits: number;
      publicMthUnits: number;
      publicMthUnitsPy: number;
      publicMthBudgetUnits: number;
    }
  >();

  for (const row of privateRows) {
    const current = merged.get(row.businessUnitName) ?? {
      privateYtdUnits: 0,
      privateYtdUnitsPy: 0,
      privateYtdBudgetUnits: 0,
      publicYtdUnits: 0,
      publicYtdUnitsPy: 0,
      publicYtdBudgetUnits: 0,
      privateMthUnits: 0,
      privateMthUnitsPy: 0,
      privateMthBudgetUnits: 0,
      publicMthUnits: 0,
      publicMthUnitsPy: 0,
      publicMthBudgetUnits: 0,
    };
    current.privateYtdUnits += row.privateYtdUnits;
    current.privateYtdUnitsPy += row.privateYtdUnitsPy;
    current.privateYtdBudgetUnits += row.privateYtdBudgetUnits;
    current.privateMthUnits += row.privateMthUnits;
    current.privateMthUnitsPy += row.privateMthUnitsPy;
    current.privateMthBudgetUnits += row.privateMthBudgetUnits;
    merged.set(row.businessUnitName, current);
  }
  for (const row of publicRows) {
    const current = merged.get(row.businessUnitName) ?? {
      privateYtdUnits: 0,
      privateYtdUnitsPy: 0,
      privateYtdBudgetUnits: 0,
      publicYtdUnits: 0,
      publicYtdUnitsPy: 0,
      publicYtdBudgetUnits: 0,
      privateMthUnits: 0,
      privateMthUnitsPy: 0,
      privateMthBudgetUnits: 0,
      publicMthUnits: 0,
      publicMthUnitsPy: 0,
      publicMthBudgetUnits: 0,
    };
    current.publicYtdUnits += row.publicYtdUnits;
    current.publicYtdUnitsPy += row.publicYtdUnitsPy;
    current.publicYtdBudgetUnits += row.publicYtdBudgetUnits;
    current.publicMthUnits += row.publicMthUnits;
    current.publicMthUnitsPy += row.publicMthUnitsPy;
    current.publicMthBudgetUnits += row.publicMthBudgetUnits;
    merged.set(row.businessUnitName, current);
  }

  return [...merged.entries()]
    .map(([businessUnitName, values]) => ({
      businessUnitName,
      privateYtdUnits: values.privateYtdUnits,
      privateYtdUnitsPy: values.privateYtdUnitsPy,
      privateYtdBudgetUnits: values.privateYtdBudgetUnits,
      privateYtdCoveragePct:
        values.privateYtdBudgetUnits > 0
          ? (values.privateYtdUnits / values.privateYtdBudgetUnits) * 100
          : null,
      publicYtdUnits: values.publicYtdUnits,
      publicYtdUnitsPy: values.publicYtdUnitsPy,
      publicYtdBudgetUnits: values.publicYtdBudgetUnits,
      publicYtdCoveragePct:
        values.publicYtdBudgetUnits > 0
          ? (values.publicYtdUnits / values.publicYtdBudgetUnits) * 100
          : null,
      totalYtdUnits: values.privateYtdUnits + values.publicYtdUnits,
      totalYtdUnitsPy: values.privateYtdUnitsPy + values.publicYtdUnitsPy,
      totalYtdBudgetUnits: values.privateYtdBudgetUnits + values.publicYtdBudgetUnits,
      totalYtdCoveragePct:
        values.privateYtdBudgetUnits + values.publicYtdBudgetUnits > 0
          ? ((values.privateYtdUnits + values.publicYtdUnits)
            / (values.privateYtdBudgetUnits + values.publicYtdBudgetUnits)) * 100
          : null,
      privateMthUnits: values.privateMthUnits,
      privateMthUnitsPy: values.privateMthUnitsPy,
      privateMthBudgetUnits: values.privateMthBudgetUnits,
      privateMthCoveragePct:
        values.privateMthBudgetUnits > 0
          ? (values.privateMthUnits / values.privateMthBudgetUnits) * 100
          : null,
      publicMthUnits: values.publicMthUnits,
      publicMthUnitsPy: values.publicMthUnitsPy,
      publicMthBudgetUnits: values.publicMthBudgetUnits,
      publicMthCoveragePct:
        values.publicMthBudgetUnits > 0
          ? (values.publicMthUnits / values.publicMthBudgetUnits) * 100
          : null,
      totalMthUnits: values.privateMthUnits + values.publicMthUnits,
      totalMthUnitsPy: values.privateMthUnitsPy + values.publicMthUnitsPy,
      totalMthBudgetUnits: values.privateMthBudgetUnits + values.publicMthBudgetUnits,
      totalMthCoveragePct:
        values.privateMthBudgetUnits + values.publicMthBudgetUnits > 0
          ? ((values.privateMthUnits + values.publicMthUnits)
            / (values.privateMthBudgetUnits + values.publicMthBudgetUnits)) * 100
          : null,
    }))
    .filter((row) => row.businessUnitName.trim().toLowerCase() !== 'unclassified bu')
    .sort((a, b) => b.totalYtdUnits - a.totalYtdUnits);
}

export async function getBusinessExcellenceFieldForceExcellenceData(
  reportingVersionId?: string,
  reportPeriodMonth?: string,
): Promise<BusinessExcellenceFieldForceExcellenceData | null> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;
  const client = getBigQueryClient();

  const resolvedReportPeriodMonth = reportPeriodMonth
    ?? (await getLatestPeriodDirect(REPORTING_VERSIONS_TABLE, resolvedReportingVersionId));
  if (!resolvedReportPeriodMonth) return null;

  const query = `
    WITH source_meta AS (
      SELECT
        LOWER(TRIM(module_code)) AS module_code,
        MAX(source_as_of_month) AS source_as_of_month
      FROM \`${RAW_UPLOADS}\`
      WHERE reporting_version_id = @reportingVersionId
        AND status IN ('normalized', 'published')
        AND LOWER(TRIM(module_code)) IN (
          'business_excellence_salesforce_fichero_medico',
          'business_excellence_fichero_medico',
          'fichero_medico',
          'business_excellence_salesforce_interacciones',
          'business_excellence_interacciones',
          'interacciones',
          'business_excellence_salesforce_tft',
          'business_excellence_tft',
          'tft'
        )
      GROUP BY 1
    ),
    summary AS (
      SELECT *
      FROM \`${FIELD_FORCE_MEDICAL_SUMMARY_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
        AND report_period_month = DATE(@reportPeriodMonth)
        AND aggregation_level IN ('bu', 'total')
    ),
    pivoted AS (
      SELECT
        LOWER(bu) AS bu,
        MAX(IF(period_scope = 'YTD', total_territorios, NULL)) AS total_territories_ytd,
        MAX(IF(period_scope = 'MTH', total_territorios, NULL)) AS total_territories_mth,
        MAX(IF(period_scope = 'YTD', clientes, NULL)) AS portfolio_accounts_ytd,
        MAX(IF(period_scope = 'MTH', clientes, NULL)) AS portfolio_accounts_mth,
        MAX(IF(period_scope = 'YTD', objetivo, NULL)) AS target_visits_ytd,
        MAX(IF(period_scope = 'MTH', objetivo, NULL)) AS target_visits_mth,
        MAX(IF(period_scope = 'YTD', objetivo_ajustado, NULL)) AS target_visits_adjusted_ytd,
        MAX(IF(period_scope = 'MTH', objetivo_ajustado, NULL)) AS target_visits_adjusted_mth,
        MAX(IF(period_scope = 'YTD', interacciones, NULL)) AS sent_interactions_ytd,
        MAX(IF(period_scope = 'MTH', interacciones, NULL)) AS sent_interactions_mth,
        MAX(IF(period_scope = 'YTD', cobertura, NULL)) AS coverage_ytd_ratio,
        MAX(IF(period_scope = 'MTH', cobertura, NULL)) AS coverage_mth_ratio,
        MAX(IF(period_scope = 'YTD', cobertura_ajustada, NULL)) AS coverage_adjusted_ytd_ratio,
        MAX(IF(period_scope = 'MTH', cobertura_ajustada, NULL)) AS coverage_adjusted_mth_ratio,
        MAX(IF(period_scope = 'YTD', dias_fuera, NULL)) AS tft_days_ytd,
        MAX(IF(period_scope = 'MTH', dias_fuera, NULL)) AS tft_days_mth,
        MAX(IF(period_scope = 'YTD', no_visitados, NULL)) AS no_visitados_ytd,
        MAX(IF(period_scope = 'MTH', no_visitados, NULL)) AS no_visitados_mth,
        MAX(IF(period_scope = 'YTD', subvisitados, NULL)) AS subvisitados_ytd,
        MAX(IF(period_scope = 'MTH', subvisitados, NULL)) AS subvisitados_mth,
        MAX(IF(period_scope = 'YTD', en_objetivo, NULL)) AS en_objetivo_ytd,
        MAX(IF(period_scope = 'MTH', en_objetivo, NULL)) AS en_objetivo_mth,
        MAX(IF(period_scope = 'YTD', sobrevisitados, NULL)) AS sobrevisitados_ytd,
        MAX(IF(period_scope = 'MTH', sobrevisitados, NULL)) AS sobrevisitados_mth,
        MAX(IF(period_scope = 'YTD', indice_evolucion_bu, NULL)) AS indice_evolucion_bu_ytd,
        MAX(IF(period_scope = 'MTH', indice_evolucion_bu, NULL)) AS indice_evolucion_bu_mth
      FROM summary
      GROUP BY 1
    )
    SELECT
      @reportPeriodMonth AS report_period_month,
      CAST((SELECT DATE(EXTRACT(YEAR FROM DATE(@reportPeriodMonth)), 1, 1)) AS STRING) AS ytd_start_month,
      CAST((
        SELECT MAX(source_as_of_month)
        FROM source_meta
        WHERE module_code IN (
          'business_excellence_salesforce_fichero_medico',
          'business_excellence_fichero_medico',
          'fichero_medico'
        )
      ) AS STRING) AS fichero_as_of_month,
      CAST((
        SELECT MAX(source_as_of_month)
        FROM source_meta
        WHERE module_code IN (
          'business_excellence_salesforce_interacciones',
          'business_excellence_interacciones',
          'interacciones'
        )
      ) AS STRING) AS interactions_as_of_month,
      CAST((
        SELECT MAX(source_as_of_month)
        FROM source_meta
        WHERE module_code IN (
          'business_excellence_salesforce_tft',
          'business_excellence_tft',
          'tft'
        )
      ) AS STRING) AS tft_as_of_month,
      CAST(@reportPeriodMonth AS STRING) AS effective_as_of_month,
      CAST((
        SELECT MAX(source_as_of_month)
        FROM source_meta
        WHERE module_code IN (
          'business_excellence_salesforce_fichero_medico',
          'business_excellence_fichero_medico',
          'fichero_medico'
        )
      ) AS STRING) AS territories_snapshot_month,
      MAX(CASE WHEN r.bu = 'total' THEN COALESCE(r.sent_interactions_ytd, 0) ELSE 0 END) AS raw_sent_interactions_ytd_all_bu,
      MAX(CASE WHEN r.bu = 'total' THEN COALESCE(r.sent_interactions_mth, 0) ELSE 0 END) AS raw_sent_interactions_mth_all_bu,
      MAX(CASE WHEN r.bu = 'total' THEN COALESCE(r.sent_interactions_ytd, 0) ELSE 0 END) AS used_sent_interactions_ytd_air_care,
      MAX(CASE WHEN r.bu = 'total' THEN COALESCE(r.sent_interactions_mth, 0) ELSE 0 END) AS used_sent_interactions_mth_air_care,
      r.*
    FROM pivoted r
    WHERE r.bu IN ('air', 'care', 'total')
    GROUP BY
      report_period_month,
      ytd_start_month,
      fichero_as_of_month,
      interactions_as_of_month,
      tft_as_of_month,
      effective_as_of_month,
      territories_snapshot_month,
      r.bu,
      r.total_territories_ytd,
      r.total_territories_mth,
      r.portfolio_accounts_ytd,
      r.portfolio_accounts_mth,
      r.target_visits_ytd,
      r.target_visits_mth,
      r.target_visits_adjusted_ytd,
      r.target_visits_adjusted_mth,
      r.sent_interactions_ytd,
      r.sent_interactions_mth,
      r.coverage_ytd_ratio,
      r.coverage_mth_ratio,
      r.coverage_adjusted_ytd_ratio,
      r.coverage_adjusted_mth_ratio,
      r.tft_days_ytd,
      r.tft_days_mth,
      r.no_visitados_ytd,
      r.no_visitados_mth,
      r.subvisitados_ytd,
      r.subvisitados_mth,
      r.en_objetivo_ytd,
      r.en_objetivo_mth,
      r.sobrevisitados_ytd,
      r.sobrevisitados_mth,
      r.indice_evolucion_bu_ytd,
      r.indice_evolucion_bu_mth
    ORDER BY CASE r.bu WHEN 'total' THEN 0 WHEN 'air' THEN 1 WHEN 'care' THEN 2 ELSE 9 END
  `;

  const summaryRowsQuery = `
    SELECT
      period_scope,
      CASE
        WHEN LOWER(view_mode) = 'territory' THEN 'territory'
        WHEN LOWER(view_mode) = 'district' THEN 'district'
        ELSE 'total'
      END AS aggregation_level,
      LOWER(bu) AS bu,
      CASE WHEN LOWER(view_mode) = 'district' THEN dimension_label ELSE NULL END AS district,
      CASE WHEN LOWER(view_mode) = 'territory' THEN dimension_label ELSE NULL END AS territory_name,
      NULL AS territory_normalized,
      clients AS clientes,
      objetivo_base AS objetivo,
      objetivo_ajustado,
      interacciones,
      cobertura_base AS cobertura,
      cobertura_ajustada,
      0 AS dias_fuera,
      NULL AS indice_evolucion_bu
    FROM \`${FIELD_FORCE_MEDICAL_DETAIL_BY_BU_VIEW}\`
    WHERE reporting_version_id = @reportingVersionId
      AND report_period_month = DATE(@reportPeriodMonth)
      AND LOWER(view_mode) IN ('territory', 'district')
  `;

  const doctorDetailRowsQuery = `
    WITH ranked AS (
      SELECT
        period_scope,
        LOWER(bu) AS bu,
        district,
        territory_name,
        territory_normalized,
        COALESCE(NULLIF(TRIM(potencial), ''), 'N/A') AS potencial,
        client_name,
        doctor_id,
        objetivo_base AS objetivo,
        objetivo_ajustado,
        interacciones,
        cobertura_base AS cobertura,
        cobertura_ajustada,
        status_visita,
        ROW_NUMBER() OVER (
          PARTITION BY period_scope, LOWER(bu), COALESCE(NULLIF(TRIM(potencial), ''), 'N/A'), status_visita
          ORDER BY
            CASE
              WHEN status_visita = 'sobrevisitado' THEN interacciones - objetivo_base
              WHEN status_visita = 'subvisitado' THEN objetivo_base - interacciones
              ELSE interacciones
            END DESC,
            doctor_id
        ) AS rn
      FROM \`${FIELD_FORCE_MEDICAL_DOCTOR_ANALYSIS_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
        AND report_period_month = DATE(@reportPeriodMonth)
        AND LOWER(bu) IN ('total', 'air', 'care')
        AND status_visita IN ('sobrevisitado', 'subvisitado', 'no_visitado')
    )
    SELECT
      period_scope,
      bu,
      district,
      territory_name,
      territory_normalized,
      potencial,
      client_name,
      doctor_id,
      objetivo,
      objetivo_ajustado,
      interacciones,
      cobertura,
      cobertura_ajustada,
      status_visita
    FROM ranked
    WHERE
      (status_visita IN ('sobrevisitado', 'subvisitado') AND rn <= 20)
      OR (status_visita = 'no_visitado' AND rn <= 200)
  `;

  const interactionMixRowsQuery = `
    WITH reporting_context AS (
      SELECT DATE(@reportPeriodMonth) AS report_period_month
    ),
    latest_interactions_upload AS (
      SELECT u.upload_id
      FROM \`${RAW_UPLOADS}\` u
      JOIN reporting_context rc
        ON TRUE
      WHERE u.reporting_version_id = @reportingVersionId
        AND u.status IN ('normalized', 'published')
        AND LOWER(TRIM(u.module_code)) IN (
          'business_excellence_salesforce_interacciones',
          'business_excellence_interacciones',
          'interacciones'
        )
        AND COALESCE(u.source_as_of_month, u.period_month) <= rc.report_period_month
      QUALIFY ROW_NUMBER() OVER (
        ORDER BY COALESCE(u.source_as_of_month, u.period_month) DESC, u.uploaded_at DESC
      ) = 1
    ),
    doctor_map AS (
      SELECT DISTINCT
        reporting_version_id,
        UPPER(COALESCE(NULLIF(TRIM(territory_normalized), ''), REGEXP_REPLACE(TRIM(COALESCE(territory_name, '')), r'[^a-zA-Z0-9]+', ''))) AS territory_normalized,
        UPPER(REGEXP_REPLACE(TRIM(doctor_id), r'[^a-zA-Z0-9]+', '')) AS doctor_id,
        LOWER(bu) AS bu
      FROM \`${FIELD_FORCE_MEDICAL_DETAIL_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
        AND report_period_month = DATE(@reportPeriodMonth)
        AND period_scope = 'MTH'
        AND LOWER(bu) IN ('air', 'care')
    ),
    interactions_base AS (
      SELECT
        i.submit_period_month AS event_month,
        dm.bu,
        COALESCE(NULLIF(TRIM(i.channel), ''), 'Unknown') AS channel,
        COALESCE(NULLIF(TRIM(i.visit_type), ''), 'Unknown') AS visit_type,
        i.interaction_id
      FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_interactions\` i
      JOIN latest_interactions_upload lu
        ON lu.upload_id = i.upload_id
      JOIN doctor_map dm
        ON dm.reporting_version_id = @reportingVersionId
       AND dm.territory_normalized = UPPER(COALESCE(NULLIF(TRIM(i.territory_normalized), ''), REGEXP_REPLACE(TRIM(COALESCE(i.territory, '')), r'[^a-zA-Z0-9]+', '')))
       AND dm.doctor_id = UPPER(REGEXP_REPLACE(TRIM(COALESCE(i.onekey_id, '')), r'[^a-zA-Z0-9]+', ''))
      WHERE i.submit_period_month IS NOT NULL
        AND i.submit_period_month BETWEEN DATE_TRUNC(DATE(@reportPeriodMonth), YEAR) AND DATE(@reportPeriodMonth)
        AND LOWER(TRIM(COALESCE(
          JSON_VALUE(i.source_payload_json, '$.Estado'),
          JSON_VALUE(i.source_payload_json, '$.estado'),
          JSON_VALUE(i.source_payload_json, '$.Status'),
          JSON_VALUE(i.source_payload_json, '$.status'),
          ''
        ))) IN ('enviado', 'sent')
    ),
    grouped AS (
      SELECT
        'YTD' AS period_scope,
        bu,
        channel,
        visit_type,
        COUNT(DISTINCT interaction_id) AS interactions
      FROM interactions_base
      GROUP BY 1, 2, 3, 4
      UNION ALL
      SELECT
        'MTH' AS period_scope,
        bu,
        channel,
        visit_type,
        COUNT(DISTINCT interaction_id) AS interactions
      FROM interactions_base
      WHERE event_month = DATE(@reportPeriodMonth)
      GROUP BY 1, 2, 3, 4
    )
    SELECT period_scope, bu, channel, visit_type, interactions FROM grouped
    UNION ALL
    SELECT period_scope, 'total' AS bu, channel, visit_type, SUM(interactions) AS interactions
    FROM grouped
    GROUP BY 1, 2, 3, 4
  `;

  const params = {
    reportingVersionId: resolvedReportingVersionId,
    reportPeriodMonth: resolvedReportPeriodMonth,
  };

  const [mainResult, summaryResult, interactionMixResult] = await Promise.all([
    client.query({ query, params }),
    client.query({ query: summaryRowsQuery, params }),
    client.query({ query: interactionMixRowsQuery, params }),
  ]);

  const doctorDetailRowsQueryFallback = `
    WITH ranked AS (
      SELECT
        period_scope,
        LOWER(bu) AS bu,
        district,
        territory_name,
        territory_normalized,
        COALESCE(NULLIF(TRIM(potencial), ''), 'N/A') AS potencial,
        CAST(NULL AS STRING) AS client_name,
        doctor_id,
        objetivo_base AS objetivo,
        objetivo_ajustado,
        interacciones,
        cobertura_base AS cobertura,
        cobertura_ajustada,
        status_visita,
        ROW_NUMBER() OVER (
          PARTITION BY period_scope, LOWER(bu), COALESCE(NULLIF(TRIM(potencial), ''), 'N/A'), status_visita
          ORDER BY
            CASE
              WHEN status_visita = 'sobrevisitado' THEN interacciones - objetivo_base
              WHEN status_visita = 'subvisitado' THEN objetivo_base - interacciones
              ELSE interacciones
            END DESC,
            doctor_id
        ) AS rn
      FROM \`${FIELD_FORCE_MEDICAL_DOCTOR_ANALYSIS_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
        AND report_period_month = DATE(@reportPeriodMonth)
        AND LOWER(bu) IN ('total', 'air', 'care')
        AND status_visita IN ('sobrevisitado', 'subvisitado', 'no_visitado')
    )
    SELECT
      period_scope,
      bu,
      district,
      territory_name,
      territory_normalized,
      potencial,
      client_name,
      doctor_id,
      objetivo,
      objetivo_ajustado,
      interacciones,
      cobertura,
      cobertura_ajustada,
      status_visita
    FROM ranked
    WHERE
      (status_visita IN ('sobrevisitado', 'subvisitado') AND rn <= 20)
      OR (status_visita = 'no_visitado' AND rn <= 200)
  `;

  let detailResult;
  try {
    detailResult = await client.query({ query: doctorDetailRowsQuery, params });
  } catch (error) {
    const message = String((error as Error)?.message ?? '').toLowerCase();
    if (!message.includes('client_name')) throw error;
    detailResult = await client.query({ query: doctorDetailRowsQueryFallback, params });
  }

  const [rows] = mainResult;
  const [summaryRawRows] = summaryResult;
  const [interactionMixRawRows] = interactionMixResult;
  const [doctorRawRows] = detailResult;

  const typedRows = rows as Array<Record<string, unknown>>;
  if (typedRows.length === 0) return null;

  const firstRow = typedRows[0];
  const mappedRowsRaw: BusinessExcellenceFieldForceExcellenceRow[] = typedRows.map((row) => ({
    bu:
      String(row.bu ?? 'total').toLowerCase() === 'air'
        ? 'air'
        : String(row.bu ?? 'total').toLowerCase() === 'care'
          ? 'care'
          : 'total',
    totalTerritories: Number(row.total_territories_ytd ?? row.total_territories_mth ?? 0),
    portfolioAccounts: Number(row.portfolio_accounts_ytd ?? row.portfolio_accounts_mth ?? 0),
    targetVisitsYtd: Number(row.target_visits_ytd ?? 0),
    targetVisitsMth: Number(row.target_visits_mth ?? 0),
    targetVisitsAdjustedYtd: Number(row.target_visits_adjusted_ytd ?? 0),
    targetVisitsAdjustedMth: Number(row.target_visits_adjusted_mth ?? 0),
    sentInteractionsYtd: Number(row.sent_interactions_ytd ?? 0),
    sentInteractionsMth: Number(row.sent_interactions_mth ?? 0),
    coverageYtdPct:
      row.coverage_ytd_ratio == null ? null : Number(row.coverage_ytd_ratio) * 100,
    coverageMthPct:
      row.coverage_mth_ratio == null ? null : Number(row.coverage_mth_ratio) * 100,
    coverageAdjustedYtdPct:
      row.coverage_adjusted_ytd_ratio == null ? null : Number(row.coverage_adjusted_ytd_ratio) * 100,
    coverageAdjustedMthPct:
      row.coverage_adjusted_mth_ratio == null ? null : Number(row.coverage_adjusted_mth_ratio) * 100,
    tftDaysYtd: Number(row.tft_days_ytd ?? 0),
    tftDaysMth: Number(row.tft_days_mth ?? 0),
    workingDaysYtd: 20 * Math.max(1, Number(new Date(`${resolvedReportPeriodMonth}T00:00:00`).getMonth() + 1)),
    workingDaysMth: 20,
    effectiveDaysYtd:
      Number(row.total_territories_ytd ?? row.total_territories_mth ?? 0) > 0
        ? Math.max(
          0,
          (20 * Math.max(1, Number(new Date(`${resolvedReportPeriodMonth}T00:00:00`).getMonth() + 1)))
            - (Number(row.tft_days_ytd ?? 0) / Math.max(1, Number(row.total_territories_ytd ?? row.total_territories_mth ?? 0))),
        )
        : 0,
    effectiveDaysMth:
      Number(row.total_territories_mth ?? row.total_territories_ytd ?? 0) > 0
        ? Math.max(
          0,
          20 - (Number(row.tft_days_mth ?? 0) / Math.max(1, Number(row.total_territories_mth ?? row.total_territories_ytd ?? 0))),
        )
        : 0,
    avgDailyVisitsYtd:
      ((20 * Math.max(1, Number(new Date(`${resolvedReportPeriodMonth}T00:00:00`).getMonth() + 1)))
        * Number(row.total_territories_ytd ?? row.total_territories_mth ?? 0)) - Number(row.tft_days_ytd ?? 0) > 0
        ? Number(row.sent_interactions_ytd ?? 0)
          / (((20 * Math.max(1, Number(new Date(`${resolvedReportPeriodMonth}T00:00:00`).getMonth() + 1)))
            * Number(row.total_territories_ytd ?? row.total_territories_mth ?? 0)) - Number(row.tft_days_ytd ?? 0))
        : null,
    avgDailyVisitsMth:
      (20 * Number(row.total_territories_mth ?? row.total_territories_ytd ?? 0)) - Number(row.tft_days_mth ?? 0) > 0
        ? Number(row.sent_interactions_mth ?? 0)
          / ((20 * Number(row.total_territories_mth ?? row.total_territories_ytd ?? 0)) - Number(row.tft_days_mth ?? 0))
        : null,
    noVisitadosYtd: Number(row.no_visitados_ytd ?? 0),
    noVisitadosMth: Number(row.no_visitados_mth ?? 0),
    subvisitadosYtd: Number(row.subvisitados_ytd ?? 0),
    subvisitadosMth: Number(row.subvisitados_mth ?? 0),
    enObjetivoYtd: Number(row.en_objetivo_ytd ?? 0),
    enObjetivoMth: Number(row.en_objetivo_mth ?? 0),
    sobrevisitadosYtd: Number(row.sobrevisitados_ytd ?? 0),
    sobrevisitadosMth: Number(row.sobrevisitados_mth ?? 0),
    indiceEvolucionBuYtd: row.indice_evolucion_bu_ytd == null ? null : Number(row.indice_evolucion_bu_ytd),
    indiceEvolucionBuMth: row.indice_evolucion_bu_mth == null ? null : Number(row.indice_evolucion_bu_mth),
  }));

  const emptyRow = (bu: 'total' | 'air' | 'care'): BusinessExcellenceFieldForceExcellenceRow => ({
    bu,
    totalTerritories: 0,
    portfolioAccounts: 0,
    targetVisitsYtd: 0,
    targetVisitsMth: 0,
    targetVisitsAdjustedYtd: 0,
    targetVisitsAdjustedMth: 0,
    sentInteractionsYtd: 0,
    sentInteractionsMth: 0,
    coverageYtdPct: null,
    coverageMthPct: null,
    coverageAdjustedYtdPct: null,
    coverageAdjustedMthPct: null,
    tftDaysYtd: 0,
    tftDaysMth: 0,
    workingDaysYtd: 0,
    workingDaysMth: 0,
    effectiveDaysYtd: 0,
    effectiveDaysMth: 0,
    avgDailyVisitsYtd: null,
    avgDailyVisitsMth: null,
    noVisitadosYtd: 0,
    noVisitadosMth: 0,
    subvisitadosYtd: 0,
    subvisitadosMth: 0,
    enObjetivoYtd: 0,
    enObjetivoMth: 0,
    sobrevisitadosYtd: 0,
    sobrevisitadosMth: 0,
    indiceEvolucionBuYtd: null,
    indiceEvolucionBuMth: null,
  });

  const byBu = new Map(mappedRowsRaw.map((row) => [row.bu, row]));
  const mappedRows: BusinessExcellenceFieldForceExcellenceRow[] = (['total', 'air', 'care'] as const).map(
    (bu) => byBu.get(bu) ?? emptyRow(bu),
  );

  const summaryRows: BusinessExcellenceFieldForceSummaryRow[] = (
    summaryRawRows as Array<Record<string, unknown>>
  ).map((row) => ({
    periodScope: String(row.period_scope ?? 'YTD').toUpperCase() === 'MTH' ? 'MTH' : 'YTD',
    aggregationLevel:
      String(row.aggregation_level ?? 'total').toLowerCase() === 'territory'
        ? 'territory'
        : String(row.aggregation_level ?? 'total').toLowerCase() === 'district'
          ? 'district'
          : String(row.aggregation_level ?? 'total').toLowerCase() === 'bu'
            ? 'bu'
            : 'total',
    bu:
      String(row.bu ?? 'total').toLowerCase() === 'air'
        ? 'air'
        : String(row.bu ?? 'total').toLowerCase() === 'care'
          ? 'care'
          : 'total',
    district: row.district ? String(row.district) : null,
    territoryName: row.territory_name ? String(row.territory_name) : null,
    territoryNormalized: row.territory_normalized ? String(row.territory_normalized) : null,
    clients: Number(row.clientes ?? 0),
    objetivoBase: Number(row.objetivo ?? 0),
    objetivoAdjusted: Number(row.objetivo_ajustado ?? 0),
    interacciones: Number(row.interacciones ?? 0),
    coberturaBasePct: row.cobertura == null ? null : Number(row.cobertura) * 100,
    coberturaAdjustedPct: row.cobertura_ajustada == null ? null : Number(row.cobertura_ajustada) * 100,
    diasFuera: Number(row.dias_fuera ?? 0),
    indiceEvolucionBuPct: row.indice_evolucion_bu == null ? null : Number(row.indice_evolucion_bu),
  }));

  const doctorDetailRows: BusinessExcellenceFieldForceDoctorDetailRow[] = (
    doctorRawRows as Array<Record<string, unknown>>
  ).map((row) => ({
    periodScope: String(row.period_scope ?? 'YTD').toUpperCase() === 'MTH' ? 'MTH' : 'YTD',
    bu: String(row.bu ?? 'air').toLowerCase() === 'care' ? 'care' : 'air',
    district: row.district ? String(row.district) : null,
    territoryName: row.territory_name ? String(row.territory_name) : null,
    territoryNormalized: row.territory_normalized ? String(row.territory_normalized) : null,
    potencial: row.potencial ? String(row.potencial) : null,
    clientName: row.client_name ? String(row.client_name) : null,
    doctorId: String(row.doctor_id ?? ''),
    objetivoBase: Number(row.objetivo ?? 0),
    objetivoAdjusted: Number(row.objetivo_ajustado ?? 0),
    interacciones: Number(row.interacciones ?? 0),
    coberturaBasePct: row.cobertura == null ? null : Number(row.cobertura) * 100,
    coberturaAdjustedPct: row.cobertura_ajustada == null ? null : Number(row.cobertura_ajustada) * 100,
    statusVisita:
      String(row.status_visita ?? 'sin_clasificacion') === 'no_visitado'
        ? 'no_visitado'
        : String(row.status_visita ?? 'sin_clasificacion') === 'subvisitado'
          ? 'subvisitado'
          : String(row.status_visita ?? 'sin_clasificacion') === 'en_objetivo'
            ? 'en_objetivo'
            : String(row.status_visita ?? 'sin_clasificacion') === 'sobrevisitado'
              ? 'sobrevisitado'
              : 'sin_clasificacion',
  }));

  const interactionMixRows: BusinessExcellenceFieldForceInteractionMixRow[] = (
    interactionMixRawRows as Array<Record<string, unknown>>
  ).map((row) => ({
    periodScope: String(row.period_scope ?? 'YTD').toUpperCase() === 'MTH' ? 'MTH' : 'YTD',
    bu:
      String(row.bu ?? 'total').toLowerCase() === 'air'
        ? 'air'
        : String(row.bu ?? 'total').toLowerCase() === 'care'
          ? 'care'
          : 'total',
    channel: row.channel ? String(row.channel) : 'Unknown',
    visitType: row.visit_type ? String(row.visit_type) : 'Unknown',
    interactions: Number(row.interactions ?? 0),
  }));

  return {
    reportingVersionId: resolvedReportingVersionId,
    reportPeriodMonth: String(firstRow.report_period_month ?? resolvedReportPeriodMonth),
    ficheroAsOfMonth: firstRow.fichero_as_of_month ? String(firstRow.fichero_as_of_month) : null,
    interactionsAsOfMonth: firstRow.interactions_as_of_month ? String(firstRow.interactions_as_of_month) : null,
    tftAsOfMonth: firstRow.tft_as_of_month ? String(firstRow.tft_as_of_month) : null,
    effectiveAsOfMonth: firstRow.effective_as_of_month ? String(firstRow.effective_as_of_month) : null,
    ytdStartMonth: firstRow.ytd_start_month ? String(firstRow.ytd_start_month) : null,
    territoriesSnapshotMonth: firstRow.territories_snapshot_month ? String(firstRow.territories_snapshot_month) : null,
    rawSentInteractionsYtdAllBu: Number(firstRow.raw_sent_interactions_ytd_all_bu ?? 0),
    rawSentInteractionsMthAllBu: Number(firstRow.raw_sent_interactions_mth_all_bu ?? 0),
    usedSentInteractionsYtdAirCare: Number(firstRow.used_sent_interactions_ytd_air_care ?? 0),
    usedSentInteractionsMthAirCare: Number(firstRow.used_sent_interactions_mth_air_care ?? 0),
    rows: mappedRows,
    summaryRows,
    doctorDetailRows,
    interactionMixRows,
  };
}

export async function getBusinessExcellenceFieldForceTopCardKpis(
  reportingVersionId?: string,
  reportPeriodMonth?: string,
): Promise<BusinessExcellenceFieldForceTopCardKpis | null> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;
  const client = getBigQueryClient();

  const resolvedReportPeriodMonth = reportPeriodMonth
    ?? (await getLatestPeriodDirect(REPORTING_VERSIONS_TABLE, resolvedReportingVersionId));
  if (!resolvedReportPeriodMonth) return null;

  const query = `
    SELECT
      cobertura_ajustada,
      porcentaje_tiempo_activo
    FROM \`${FIELD_FORCE_MEDICAL_SUMMARY_VIEW}\`
    WHERE reporting_version_id = @reportingVersionId
      AND report_period_month = DATE(@reportPeriodMonth)
      AND period_scope = 'YTD'
      AND aggregation_level = 'total'
    LIMIT 1
  `;

  const [rows] = await client.query({
    query,
    params: {
      reportingVersionId: resolvedReportingVersionId,
      reportPeriodMonth: resolvedReportPeriodMonth,
    },
  });

  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;

  return {
    coverageYtdTftPct: row.cobertura_ajustada == null ? null : Number(row.cobertura_ajustada) * 100,
    activeTimeYtdPct: row.porcentaje_tiempo_activo == null ? null : Number(row.porcentaje_tiempo_activo) * 100,
  };
}

export async function getBusinessExcellencePrivateSellOutMartRows(
  reportingVersionId?: string,
  marketGroup?: string,
  limit = 12,
): Promise<BusinessExcellencePrivateSellOutMartRow[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];

  const client = getBigQueryClient();
  const normalizedMarketGroup = sanitizeFilter(marketGroup);
  const params: Record<string, string | number> = {
    reportingVersionId: resolvedReportingVersionId,
    limit,
  };
  const marketWhere = normalizedMarketGroup ? 'AND market_group = @marketGroup' : '';
  if (normalizedMarketGroup) params.marketGroup = normalizedMarketGroup;

  const query = `
    SELECT
      reporting_version_id,
      market_group,
      brand_name,
      CAST(last_available_month AS STRING) AS last_available_month,
      ytd_units,
      ytd_units_py,
      growth_vs_py_ytd_units_pct,
      ms_ytd_units_pct,
      ei_ytd_units,
      mth_units,
      mth_units_py,
      growth_vs_py_mth_units_pct,
      ms_mth_units_pct,
      ei_mth_units,
      ytd_net_sales,
      mth_net_sales,
      ytd_rx,
      mth_rx,
      growth_vs_py_ytd_rx_pct,
      growth_vs_py_mth_rx_pct,
      ytd_rx_by_mg,
      mth_rx_by_mg,
      ytd_rx_by_neumo,
      mth_rx_by_neumo,
      budget_ytd_units,
      budget_mth_units,
      ytd_units_visited_ratio,
      mth_units_visited_ratio,
      ytd_rx_visited_ratio,
      mth_rx_visited_ratio,
      ytd_rx_mg_ratio,
      mth_rx_mg_ratio,
      ytd_rx_neumo_ratio,
      mth_rx_neumo_ratio,
      variance_vs_budget_ytd_units_pct,
      variance_vs_budget_ytd_net_sales_pct,
      variance_vs_budget_mth_units_pct,
      variance_vs_budget_mth_net_sales_pct
    FROM \`${PRIVATE_SELLOUT_MART_VIEW}\`
    WHERE reporting_version_id = @reportingVersionId
      ${marketWhere}
    ORDER BY ytd_net_sales DESC, brand_name
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params });
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    reportingVersionId: String(row.reporting_version_id ?? resolvedReportingVersionId),
    marketGroup: row.market_group ? String(row.market_group) : null,
    brandName: String(row.brand_name ?? 'Unmapped Brand'),
    lastAvailableMonth: row.last_available_month ? String(row.last_available_month) : null,
    ytdUnits: Number(row.ytd_units ?? 0),
    ytdUnitsPy: Number(row.ytd_units_py ?? 0),
    growthVsPyYtdUnitsPct: asNullableNumber(row.growth_vs_py_ytd_units_pct),
    msYtdUnitsPct: asNullableNumber(row.ms_ytd_units_pct),
    eiYtdUnits: asNullableNumber(row.ei_ytd_units),
    mthUnits: Number(row.mth_units ?? 0),
    mthUnitsPy: Number(row.mth_units_py ?? 0),
    growthVsPyMthUnitsPct: asNullableNumber(row.growth_vs_py_mth_units_pct),
    msMthUnitsPct: asNullableNumber(row.ms_mth_units_pct),
    eiMthUnits: asNullableNumber(row.ei_mth_units),
    ytdNetSales: Number(row.ytd_net_sales ?? 0),
    mthNetSales: Number(row.mth_net_sales ?? 0),
    ytdRx: Number(row.ytd_rx ?? 0),
    mthRx: Number(row.mth_rx ?? 0),
    growthVsPyYtdRxPct: asNullableNumber(row.growth_vs_py_ytd_rx_pct),
    growthVsPyMthRxPct: asNullableNumber(row.growth_vs_py_mth_rx_pct),
    ytdRxByMg: Number(row.ytd_rx_by_mg ?? 0),
    mthRxByMg: Number(row.mth_rx_by_mg ?? 0),
    ytdRxByNeumo: Number(row.ytd_rx_by_neumo ?? 0),
    mthRxByNeumo: Number(row.mth_rx_by_neumo ?? 0),
    budgetYtdUnits: Number(row.budget_ytd_units ?? 0),
    budgetMthUnits: Number(row.budget_mth_units ?? 0),
    ytdUnitsVisitedRatio: asNullableNumber(row.ytd_units_visited_ratio),
    mthUnitsVisitedRatio: asNullableNumber(row.mth_units_visited_ratio),
    ytdRxVisitedRatio: asNullableNumber(row.ytd_rx_visited_ratio),
    mthRxVisitedRatio: asNullableNumber(row.mth_rx_visited_ratio),
    ytdRxMgRatio: asNullableNumber(row.ytd_rx_mg_ratio),
    mthRxMgRatio: asNullableNumber(row.mth_rx_mg_ratio),
    ytdRxNeumoRatio: asNullableNumber(row.ytd_rx_neumo_ratio),
    mthRxNeumoRatio: asNullableNumber(row.mth_rx_neumo_ratio),
    varianceVsBudgetYtdUnitsPct: asNullableNumber(row.variance_vs_budget_ytd_units_pct),
    varianceVsBudgetYtdNetSalesPct: asNullableNumber(row.variance_vs_budget_ytd_net_sales_pct),
    varianceVsBudgetMthUnitsPct: asNullableNumber(row.variance_vs_budget_mth_units_pct),
    varianceVsBudgetMthNetSalesPct: asNullableNumber(row.variance_vs_budget_mth_net_sales_pct),
  }));
}

export async function getBusinessExcellencePrivateSellOutMartRowsByBrand(
  reportingVersionId?: string,
  brandKeyword = 'rinoclenil',
  marketGroup?: string,
): Promise<BusinessExcellencePrivateSellOutMartRow[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];

  const client = getBigQueryClient();
  const normalizedMarketGroup = sanitizeFilter(marketGroup);
  const params: Record<string, string> = {
    reportingVersionId: resolvedReportingVersionId,
    brandKeyword: `%${brandKeyword.toLowerCase()}%`,
  };
  const marketWhere = normalizedMarketGroup ? 'AND market_group = @marketGroup' : '';
  if (normalizedMarketGroup) params.marketGroup = normalizedMarketGroup;

  const query = `
    SELECT
      reporting_version_id,
      market_group,
      brand_name,
      CAST(last_available_month AS STRING) AS last_available_month,
      ytd_units,
      ytd_units_py,
      growth_vs_py_ytd_units_pct,
      ms_ytd_units_pct,
      ei_ytd_units,
      mth_units,
      mth_units_py,
      growth_vs_py_mth_units_pct,
      ms_mth_units_pct,
      ei_mth_units,
      ytd_net_sales,
      mth_net_sales,
      ytd_rx,
      mth_rx,
      growth_vs_py_ytd_rx_pct,
      growth_vs_py_mth_rx_pct,
      ytd_rx_by_mg,
      mth_rx_by_mg,
      ytd_rx_by_neumo,
      mth_rx_by_neumo,
      budget_ytd_units,
      budget_mth_units,
      ytd_units_visited_ratio,
      mth_units_visited_ratio,
      ytd_rx_visited_ratio,
      mth_rx_visited_ratio,
      ytd_rx_mg_ratio,
      mth_rx_mg_ratio,
      ytd_rx_neumo_ratio,
      mth_rx_neumo_ratio,
      variance_vs_budget_ytd_units_pct,
      variance_vs_budget_ytd_net_sales_pct,
      variance_vs_budget_mth_units_pct,
      variance_vs_budget_mth_net_sales_pct
    FROM \`${PRIVATE_SELLOUT_MART_VIEW}\`
    WHERE reporting_version_id = @reportingVersionId
      AND LOWER(COALESCE(brand_name, '')) LIKE @brandKeyword
      ${marketWhere}
    ORDER BY ytd_net_sales DESC, brand_name
  `;

  const [rows] = await client.query({ query, params });
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    reportingVersionId: String(row.reporting_version_id ?? resolvedReportingVersionId),
    marketGroup: row.market_group ? String(row.market_group) : null,
    brandName: String(row.brand_name ?? 'Unmapped Brand'),
    lastAvailableMonth: row.last_available_month ? String(row.last_available_month) : null,
    ytdUnits: Number(row.ytd_units ?? 0),
    ytdUnitsPy: Number(row.ytd_units_py ?? 0),
    growthVsPyYtdUnitsPct: asNullableNumber(row.growth_vs_py_ytd_units_pct),
    msYtdUnitsPct: asNullableNumber(row.ms_ytd_units_pct),
    eiYtdUnits: asNullableNumber(row.ei_ytd_units),
    mthUnits: Number(row.mth_units ?? 0),
    mthUnitsPy: Number(row.mth_units_py ?? 0),
    growthVsPyMthUnitsPct: asNullableNumber(row.growth_vs_py_mth_units_pct),
    msMthUnitsPct: asNullableNumber(row.ms_mth_units_pct),
    eiMthUnits: asNullableNumber(row.ei_mth_units),
    ytdNetSales: Number(row.ytd_net_sales ?? 0),
    mthNetSales: Number(row.mth_net_sales ?? 0),
    ytdRx: Number(row.ytd_rx ?? 0),
    mthRx: Number(row.mth_rx ?? 0),
    growthVsPyYtdRxPct: asNullableNumber(row.growth_vs_py_ytd_rx_pct),
    growthVsPyMthRxPct: asNullableNumber(row.growth_vs_py_mth_rx_pct),
    ytdRxByMg: Number(row.ytd_rx_by_mg ?? 0),
    mthRxByMg: Number(row.mth_rx_by_mg ?? 0),
    ytdRxByNeumo: Number(row.ytd_rx_by_neumo ?? 0),
    mthRxByNeumo: Number(row.mth_rx_by_neumo ?? 0),
    budgetYtdUnits: Number(row.budget_ytd_units ?? 0),
    budgetMthUnits: Number(row.budget_mth_units ?? 0),
    ytdUnitsVisitedRatio: asNullableNumber(row.ytd_units_visited_ratio),
    mthUnitsVisitedRatio: asNullableNumber(row.mth_units_visited_ratio),
    ytdRxVisitedRatio: asNullableNumber(row.ytd_rx_visited_ratio),
    mthRxVisitedRatio: asNullableNumber(row.mth_rx_visited_ratio),
    ytdRxMgRatio: asNullableNumber(row.ytd_rx_mg_ratio),
    mthRxMgRatio: asNullableNumber(row.mth_rx_mg_ratio),
    ytdRxNeumoRatio: asNullableNumber(row.ytd_rx_neumo_ratio),
    mthRxNeumoRatio: asNullableNumber(row.mth_rx_neumo_ratio),
    varianceVsBudgetYtdUnitsPct: asNullableNumber(row.variance_vs_budget_ytd_units_pct),
    varianceVsBudgetYtdNetSalesPct: asNullableNumber(row.variance_vs_budget_ytd_net_sales_pct),
    varianceVsBudgetMthUnitsPct: asNullableNumber(row.variance_vs_budget_mth_units_pct),
    varianceVsBudgetMthNetSalesPct: asNullableNumber(row.variance_vs_budget_mth_net_sales_pct),
  }));
}

export async function getBusinessExcellencePrivateMarketChartPoints(
  reportingVersionId?: string,
): Promise<BusinessExcellencePrivateMarketChartPoint[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];

  const client = getBigQueryClient();
  const query = `
    WITH pmm_base AS (
      SELECT
        reporting_version_id,
        COALESCE(NULLIF(TRIM(market_group), ''), 'No Market') AS market_group,
        NULLIF(TRIM(resolved_product_id), '') AS resolved_product_id,
        NULLIF(TRIM(business_unit_name), '') AS business_unit_name,
        period_month,
        LOWER(TRIM(sales_group)) AS sales_group,
        amount_value
      FROM \`${PMM_ENRICHED_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
    ),
    pmm AS (
      SELECT
        reporting_version_id,
        market_group,
        period_month,
        'all' AS scope,
        SUM(IF(sales_group = 'units', amount_value, 0)) AS pmm_units,
        SUM(IF(sales_group = 'net sales', amount_value, 0)) AS pmm_net_sales
      FROM pmm_base
      GROUP BY 1, 2, 3, 4
      UNION ALL
      SELECT
        reporting_version_id,
        market_group,
        period_month,
        'chiesi' AS scope,
        SUM(IF(sales_group = 'units', amount_value, 0)) AS pmm_units,
        SUM(IF(sales_group = 'net sales', amount_value, 0)) AS pmm_net_sales
      FROM pmm_base
      WHERE resolved_product_id IS NOT NULL
        AND business_unit_name IS NOT NULL
      GROUP BY 1, 2, 3, 4
    ),
    closeup_base AS (
      SELECT
        reporting_version_id,
        COALESCE(NULLIF(TRIM(market_group), ''), 'No Market') AS market_group,
        NULLIF(TRIM(resolved_product_id), '') AS resolved_product_id,
        period_month,
        recetas_value
      FROM \`${CLOSEUP_ENRICHED_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
    ),
    closeup AS (
      SELECT
        reporting_version_id,
        market_group,
        period_month,
        'all' AS scope,
        SUM(recetas_value) AS closeup_rx
      FROM closeup_base
      GROUP BY 1, 2, 3, 4
      UNION ALL
      SELECT
        reporting_version_id,
        market_group,
        period_month,
        'chiesi' AS scope,
        SUM(recetas_value) AS closeup_rx
      FROM closeup_base
      WHERE resolved_product_id IS NOT NULL
      GROUP BY 1, 2, 3, 4
    ),
    merged AS (
      SELECT
        COALESCE(p.reporting_version_id, c.reporting_version_id) AS reporting_version_id,
        COALESCE(p.market_group, c.market_group) AS market_group,
        COALESCE(p.scope, c.scope) AS scope,
        COALESCE(p.period_month, c.period_month) AS period_month,
        COALESCE(p.pmm_units, 0) AS pmm_units,
        COALESCE(p.pmm_net_sales, 0) AS pmm_net_sales,
        COALESCE(c.closeup_rx, 0) AS closeup_rx
      FROM pmm p
      FULL OUTER JOIN closeup c
        ON p.reporting_version_id = c.reporting_version_id
       AND p.market_group = c.market_group
       AND p.scope = c.scope
       AND p.period_month = c.period_month
    )
    SELECT
      reporting_version_id,
      market_group,
      scope,
      CAST(period_month AS STRING) AS period_month,
      pmm_units,
      pmm_net_sales,
      closeup_rx
    FROM merged
    WHERE period_month IS NOT NULL
    ORDER BY market_group, scope, period_month
  `;

  const [rows] = await client.query({
    query,
    params: { reportingVersionId: resolvedReportingVersionId },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    reportingVersionId: String(row.reporting_version_id ?? resolvedReportingVersionId),
    marketGroup: String(row.market_group ?? 'No Market'),
    scope: String(row.scope ?? 'all') as 'all' | 'chiesi',
    periodMonth: String(row.period_month ?? ''),
    pmmUnits: Number(row.pmm_units ?? 0),
    pmmNetSales: Number(row.pmm_net_sales ?? 0),
    closeupRx: Number(row.closeup_rx ?? 0),
  }));
}

export async function getBusinessExcellencePrivateWeeklyZoom(
  reportingVersionId?: string,
  marketGroup?: string,
): Promise<BusinessExcellencePrivateWeeklyZoom | null> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;

  const client = getBigQueryClient();
  const normalizedMarketGroup = sanitizeFilter(marketGroup);
  const params: Record<string, string | number> = {
    reportingVersionId: resolvedReportingVersionId,
    weekLimit: 12,
    topLimit: 8,
  };
  const marketWhere = normalizedMarketGroup ? 'AND w.market_group = @marketGroup' : '';
  if (normalizedMarketGroup) params.marketGroup = normalizedMarketGroup;

  const query = `
    WITH weekly_base AS (
      SELECT
        w.week_raw,
        COALESCE(NULLIF(TRIM(w.pack_des), ''), 'Unmapped Pack') AS pack_des,
        LOWER(TRIM(w.sales_group)) AS sales_group,
        w.amount_value,
        COALESCE(w.visited, FALSE) AS visited
      FROM \`${WEEKLY_ENRICHED_VIEW}\` w
      WHERE w.reporting_version_id = @reportingVersionId
        ${marketWhere}
    ),
    recent_weeks AS (
      SELECT week_raw
      FROM (
        SELECT DISTINCT week_raw
        FROM weekly_base
      )
      ORDER BY SAFE_CAST(week_raw AS INT64) DESC, week_raw DESC
      LIMIT @weekLimit
    ),
    joined AS (
      SELECT
        wb.week_raw,
        wb.pack_des,
        wb.sales_group,
        wb.amount_value,
        wb.visited
      FROM weekly_base wb
      JOIN recent_weeks rw
        ON rw.week_raw = wb.week_raw
    ),
    weekly_series AS (
      SELECT
        week_raw,
        SUM(IF(sales_group = 'units', amount_value, 0)) AS units,
        SUM(IF(sales_group = 'net sales', amount_value, 0)) AS net_sales,
        SUM(IF(sales_group = 'units' AND visited, amount_value, 0)) AS visited_units
      FROM joined
      GROUP BY 1
    ),
    top_packs AS (
      SELECT
        pack_des,
        SUM(IF(sales_group = 'units', amount_value, 0)) AS units,
        SUM(IF(sales_group = 'net sales', amount_value, 0)) AS net_sales
      FROM joined
      GROUP BY 1
      ORDER BY units DESC, pack_des
      LIMIT @topLimit
    )
    SELECT
      (
        SELECT AS STRUCT
          ARRAY_AGG(
            STRUCT(
              ws.week_raw AS week_raw,
              ws.units AS units,
              ws.net_sales AS net_sales,
              ws.visited_units AS visited_units
            )
            ORDER BY SAFE_CAST(ws.week_raw AS INT64), ws.week_raw
          ) AS week_rows,
          MAX(ws.week_raw) AS latest_week_raw
        FROM weekly_series ws
      ) AS weekly_data,
      (
        SELECT ARRAY_AGG(
          STRUCT(
            tp.pack_des AS pack_des,
            tp.units AS units,
            tp.net_sales AS net_sales
          )
          ORDER BY tp.units DESC, tp.pack_des
        )
        FROM top_packs tp
      ) AS top_packs
  `;

  const [rows] = await client.query({ query, params });
  const row = (rows as Array<Record<string, unknown>>)[0] ?? {};
  const weeklyData = (row.weekly_data as { latest_week_raw?: string | null; week_rows?: unknown[] } | undefined) ?? {};
  const rawRows = (weeklyData.week_rows ?? []) as Array<Record<string, unknown>>;
  const mappedRows: BusinessExcellencePrivateWeeklySeriesRow[] = rawRows.map((item) => {
    const units = Number(item.units ?? 0);
    const visitedUnits = Number(item.visited_units ?? 0);
    return {
      weekRaw: String(item.week_raw ?? ''),
      units,
      netSales: Number(item.net_sales ?? 0),
      visitedUnits,
      visitedUnitsRatio: units > 0 ? visitedUnits / units : null,
    };
  });

  const mappedTopPacks: BusinessExcellencePrivateWeeklyTopPackRow[] = ((row.top_packs ?? []) as Array<Record<string, unknown>>).map((item) => ({
    packDes: String(item.pack_des ?? 'Unmapped Pack'),
    units: Number(item.units ?? 0),
    netSales: Number(item.net_sales ?? 0),
  }));

  if (mappedRows.length === 0 && mappedTopPacks.length === 0) return null;

  return {
    latestWeekRaw: weeklyData.latest_week_raw ? String(weeklyData.latest_week_raw) : null,
    rows: mappedRows,
    topPacks: mappedTopPacks,
  };
}

export async function getBusinessExcellencePrivateWeeklyBenchmark(
  reportingVersionId?: string,
): Promise<BusinessExcellencePrivateWeeklyBenchmark | null> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;

  const client = getBigQueryClient();
  const rowLimitPerMarket = 10;
  const queryRows = `
    WITH weeks AS (
      SELECT
        ARRAY_AGG(week_raw ORDER BY SAFE_CAST(week_raw AS INT64) DESC, week_raw DESC LIMIT 4) AS w
      FROM (
        SELECT DISTINCT week_raw
        FROM \`${WEEKLY_ENRICHED_VIEW}\`
        WHERE reporting_version_id = @reportingVersionId
          AND LOWER(TRIM(sales_group)) = 'units'
      )
    ),
    ctx AS (
      SELECT
        w[SAFE_OFFSET(3)] AS week_1_raw,
        w[SAFE_OFFSET(2)] AS week_2_raw,
        w[SAFE_OFFSET(1)] AS week_3_raw,
        w[SAFE_OFFSET(0)] AS week_4_raw
      FROM weeks
      WHERE ARRAY_LENGTH(w) >= 2
    ),
    all_base AS (
      SELECT
        COALESCE(NULLIF(TRIM(market_group), ''), 'No Market') AS market_group,
        COALESCE(
          NULLIF(TRIM(brand_name), ''),
          NULLIF(TRIM(product_group), ''),
          NULLIF(TRIM(canonical_product_name), ''),
          'Unmapped Brand'
        ) AS brand_label,
        week_raw,
        amount_value,
        NULLIF(TRIM(business_unit_name), '') AS business_unit_name
      FROM \`${WEEKLY_ENRICHED_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
        AND LOWER(TRIM(sales_group)) = 'units'
    ),
    base AS (
      SELECT
        market_group,
        brand_label,
        week_raw,
        amount_value,
        'all' AS scope
      FROM all_base
      UNION ALL
      SELECT
        market_group,
        brand_label,
        week_raw,
        amount_value,
        'chiesi' AS scope
      FROM all_base
      WHERE business_unit_name IS NOT NULL
    ),
    brand_agg AS (
      SELECT
        b.market_group,
        b.scope,
        b.brand_label,
        SUM(IF(b.week_raw = c.week_1_raw, b.amount_value, 0)) AS week_1_units,
        SUM(IF(b.week_raw = c.week_2_raw, b.amount_value, 0)) AS week_2_units,
        SUM(IF(b.week_raw = c.week_3_raw, b.amount_value, 0)) AS week_3_units,
        SUM(IF(b.week_raw = c.week_4_raw, b.amount_value, 0)) AS week_4_units
      FROM base b
      CROSS JOIN ctx c
      GROUP BY 1, 2, 3
    ),
    market_totals AS (
      SELECT
        market_group,
        scope,
        SUM(week_1_units) AS week_1_total_units,
        SUM(week_2_units) AS week_2_total_units,
        SUM(week_3_units) AS week_3_total_units,
        SUM(week_4_units) AS week_4_total_units
      FROM brand_agg
      GROUP BY 1, 2
    ),
    ranked AS (
      SELECT
        b.market_group,
        b.scope,
        b.brand_label,
        b.week_1_units,
        b.week_2_units,
        b.week_3_units,
        b.week_4_units,
        t.week_1_total_units,
        t.week_2_total_units,
        t.week_3_total_units,
        t.week_4_total_units,
        ROW_NUMBER() OVER (
          PARTITION BY b.market_group, b.scope
          ORDER BY b.week_4_units DESC, b.brand_label
        ) AS rn
      FROM brand_agg b
      JOIN market_totals t
        ON t.market_group = b.market_group
       AND t.scope = b.scope
    )
    SELECT
      c.week_1_raw,
      c.week_2_raw,
      c.week_3_raw,
      c.week_4_raw,
      r.market_group,
      r.scope,
      r.brand_label,
      r.week_1_units,
      r.week_2_units,
      r.week_3_units,
      r.week_4_units,
      SAFE_DIVIDE(r.week_4_units - r.week_3_units, NULLIF(r.week_3_units, 0)) AS wow_growth_ratio,
      SAFE_DIVIDE(r.week_3_units, NULLIF(r.week_3_total_units, 0)) AS ms_week_from_ratio,
      SAFE_DIVIDE(r.week_4_units, NULLIF(r.week_4_total_units, 0)) AS ms_week_to_ratio,
      SAFE_DIVIDE(
        SAFE_DIVIDE(r.week_4_units, NULLIF(r.week_4_total_units, 0)),
        NULLIF(SAFE_DIVIDE(r.week_3_units, NULLIF(r.week_3_total_units, 0)), 0)
      ) * 100 AS evolution_index
    FROM ranked r
    CROSS JOIN ctx c
    WHERE r.rn <= @rowLimitPerMarket
    ORDER BY r.market_group, r.week_4_units DESC, r.brand_label
  `;
  const [rows] = await client.query({
    query: queryRows,
    params: { reportingVersionId: resolvedReportingVersionId, rowLimitPerMarket },
  });

  const typedRows = rows as Array<Record<string, unknown>>;
  if (typedRows.length === 0) return null;
  const week1Raw = typedRows[0]?.week_1_raw ? String(typedRows[0].week_1_raw) : null;
  const week2Raw = typedRows[0]?.week_2_raw ? String(typedRows[0].week_2_raw) : null;
  const week3Raw = typedRows[0]?.week_3_raw ? String(typedRows[0].week_3_raw) : null;
  const week4Raw = typedRows[0]?.week_4_raw ? String(typedRows[0].week_4_raw) : null;

  const mappedRows: BusinessExcellencePrivateWeeklyBenchmarkRow[] = typedRows.map((row) => ({
    scope: String(row.scope ?? 'all') as 'all' | 'chiesi',
    marketGroup: String(row.market_group ?? 'No Market'),
    brandLabel: String(row.brand_label ?? 'Unmapped Brand'),
    week1Units: Number(row.week_1_units ?? 0),
    week2Units: Number(row.week_2_units ?? 0),
    week3Units: Number(row.week_3_units ?? 0),
    week4Units: Number(row.week_4_units ?? 0),
    wowGrowthPct: asNullableNumber(row.wow_growth_ratio) === null ? null : Number(row.wow_growth_ratio) * 100,
    msWeekFromPct: asNullableNumber(row.ms_week_from_ratio) === null ? null : Number(row.ms_week_from_ratio) * 100,
    msWeekToPct: asNullableNumber(row.ms_week_to_ratio) === null ? null : Number(row.ms_week_to_ratio) * 100,
    evolutionIndex: asNullableNumber(row.evolution_index),
  }));

  const queryTotals = `
    WITH weeks AS (
      SELECT
        ARRAY_AGG(week_raw ORDER BY SAFE_CAST(week_raw AS INT64) DESC, week_raw DESC LIMIT 4) AS w
      FROM (
        SELECT DISTINCT week_raw
        FROM \`${WEEKLY_ENRICHED_VIEW}\`
        WHERE reporting_version_id = @reportingVersionId
          AND LOWER(TRIM(sales_group)) = 'units'
      )
    ),
    ctx AS (
      SELECT
        w[SAFE_OFFSET(3)] AS week_1_raw,
        w[SAFE_OFFSET(2)] AS week_2_raw,
        w[SAFE_OFFSET(1)] AS week_3_raw,
        w[SAFE_OFFSET(0)] AS week_4_raw
      FROM weeks
      WHERE ARRAY_LENGTH(w) >= 2
    ),
    all_base AS (
      SELECT
        COALESCE(NULLIF(TRIM(market_group), ''), 'No Market') AS market_group,
        week_raw,
        amount_value,
        NULLIF(TRIM(business_unit_name), '') AS business_unit_name
      FROM \`${WEEKLY_ENRICHED_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
        AND LOWER(TRIM(sales_group)) = 'units'
    ),
    base AS (
      SELECT
        market_group,
        week_raw,
        amount_value,
        'all' AS scope
      FROM all_base
      UNION ALL
      SELECT
        market_group,
        week_raw,
        amount_value,
        'chiesi' AS scope
      FROM all_base
      WHERE business_unit_name IS NOT NULL
    )
    SELECT
      b.market_group,
      b.scope,
      SUM(IF(b.week_raw = c.week_1_raw, b.amount_value, 0)) AS week_1_units,
      SUM(IF(b.week_raw = c.week_2_raw, b.amount_value, 0)) AS week_2_units,
      SUM(IF(b.week_raw = c.week_3_raw, b.amount_value, 0)) AS week_3_units,
      SUM(IF(b.week_raw = c.week_4_raw, b.amount_value, 0)) AS week_4_units
    FROM base b
    CROSS JOIN ctx c
    GROUP BY 1, 2
    ORDER BY b.scope, week_4_units DESC, b.market_group
  `;
  const [totalRows] = await client.query({
    query: queryTotals,
    params: { reportingVersionId: resolvedReportingVersionId },
  });
  const totals: BusinessExcellencePrivateWeeklyBenchmarkTotal[] = (totalRows as Array<Record<string, unknown>>).map((row) => {
    const week1Units = Number(row.week_1_units ?? 0);
    const week2Units = Number(row.week_2_units ?? 0);
    const week3Units = Number(row.week_3_units ?? 0);
    const week4Units = Number(row.week_4_units ?? 0);
    return {
      scope: String(row.scope ?? 'all') as 'all' | 'chiesi',
      marketGroup: String(row.market_group ?? 'No Market'),
      week1Units,
      week2Units,
      week3Units,
      week4Units,
      wowGrowthPct: week3Units === 0 ? null : ((week4Units - week3Units) / week3Units) * 100,
    };
  });

  return {
    week1Raw,
    week2Raw,
    week3Raw,
    week4Raw,
    rows: mappedRows,
    totals,
  };
}

export async function getBusinessExcellencePrivateDddDimensionRanking(
  reportingVersionId?: string,
  limit = 20,
): Promise<BusinessExcellencePrivateDddDimensionRankingRow[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];

  const client = getBigQueryClient();
  const query = `
    WITH all_base AS (
      SELECT
        reporting_version_id,
        COALESCE(NULLIF(TRIM(market_group), ''), 'No Market') AS market_group,
        NULLIF(TRIM(resolved_product_id), '') AS resolved_product_id,
        NULLIF(TRIM(business_unit_name), '') AS business_unit_name,
        COALESCE(NULLIF(TRIM(pack_des_raw), ''), 'Unmapped Pack') AS pack_label,
        COALESCE(NULLIF(TRIM(state), ''), 'Unmapped State') AS state_label,
        COALESCE(NULLIF(TRIM(manager), ''), 'Unmapped Manager') AS manager_label,
        COALESCE(NULLIF(TRIM(territory), ''), 'Unmapped Territory') AS territory_label,
        COALESCE(is_ytd, FALSE) AS is_ytd,
        COALESCE(is_ytd_py, FALSE) AS is_ytd_py,
        LOWER(TRIM(sales_group)) AS sales_group,
        amount_value
      FROM \`${PMM_ENRICHED_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
    ),
    scoped_base AS (
      SELECT
        reporting_version_id,
        market_group,
        'all' AS scope,
        pack_label,
        state_label,
        manager_label,
        territory_label,
        is_ytd,
        is_ytd_py,
        sales_group,
        amount_value
      FROM all_base
      UNION ALL
      SELECT
        reporting_version_id,
        market_group,
        'chiesi' AS scope,
        pack_label,
        state_label,
        manager_label,
        territory_label,
        is_ytd,
        is_ytd_py,
        sales_group,
        amount_value
      FROM all_base
      WHERE resolved_product_id IS NOT NULL
        AND business_unit_name IS NOT NULL
    ),
    pack_rows AS (
      SELECT
        reporting_version_id,
        market_group,
        scope,
        'pack' AS dimension,
        pack_label AS label,
        SUM(IF(is_ytd AND sales_group = 'units', amount_value, 0)) AS ytd_units,
        SUM(IF(is_ytd_py AND sales_group = 'units', amount_value, 0)) AS ytd_py_units
      FROM scoped_base
      GROUP BY 1, 2, 3, 4, 5
    ),
    state_rows AS (
      SELECT
        reporting_version_id,
        market_group,
        scope,
        'state' AS dimension,
        state_label AS label,
        SUM(IF(is_ytd AND sales_group = 'units', amount_value, 0)) AS ytd_units,
        SUM(IF(is_ytd_py AND sales_group = 'units', amount_value, 0)) AS ytd_py_units
      FROM scoped_base
      GROUP BY 1, 2, 3, 4, 5
    ),
    manager_rows AS (
      SELECT
        reporting_version_id,
        market_group,
        scope,
        'manager' AS dimension,
        manager_label AS label,
        SUM(IF(is_ytd AND sales_group = 'units', amount_value, 0)) AS ytd_units,
        SUM(IF(is_ytd_py AND sales_group = 'units', amount_value, 0)) AS ytd_py_units
      FROM scoped_base
      WHERE NOT REGEXP_CONTAINS(
        LOWER(TRIM(manager_label)),
        r'no\\s*visit|sin\\s*visit|not\\s*visit'
      )
      GROUP BY 1, 2, 3, 4, 5
    ),
    territory_rows AS (
      SELECT
        reporting_version_id,
        market_group,
        scope,
        'territory' AS dimension,
        territory_label AS label,
        SUM(IF(is_ytd AND sales_group = 'units', amount_value, 0)) AS ytd_units,
        SUM(IF(is_ytd_py AND sales_group = 'units', amount_value, 0)) AS ytd_py_units
      FROM scoped_base
      GROUP BY 1, 2, 3, 4, 5
    ),
    all_rows AS (
      SELECT * FROM pack_rows
      UNION ALL
      SELECT * FROM state_rows
      UNION ALL
      SELECT * FROM manager_rows
      UNION ALL
      SELECT * FROM territory_rows
    )
    SELECT
      reporting_version_id,
      market_group,
      scope,
      dimension,
      label,
      ytd_units,
      ytd_py_units
    FROM all_rows
    QUALIFY ROW_NUMBER() OVER (
      PARTITION BY market_group, scope, dimension
      ORDER BY ytd_units DESC, label
    ) <= @limit
    ORDER BY market_group, scope, dimension, ytd_units DESC, label
  `;

  const [rows] = await client.query({
    query,
    params: { reportingVersionId: resolvedReportingVersionId, limit },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => {
    const ytdUnits = Number(row.ytd_units ?? 0);
    const ytdPyUnits = Number(row.ytd_py_units ?? 0);
    const growthVsPyPct = ytdPyUnits === 0 ? null : ((ytdUnits - ytdPyUnits) / ytdPyUnits) * 100;

    return {
      reportingVersionId: String(row.reporting_version_id ?? resolvedReportingVersionId),
      marketGroup: String(row.market_group ?? 'No Market'),
      scope: String(row.scope ?? 'all') as 'all' | 'chiesi',
      dimension: String(row.dimension ?? 'pack') as 'pack' | 'state' | 'manager' | 'territory',
      label: String(row.label ?? 'Unmapped Label'),
      ytdUnits,
      ytdPyUnits,
      growthVsPyPct,
    };
  });
}

export async function getBusinessExcellencePrivatePrescriptionDimensionRanking(
  reportingVersionId?: string,
  limit = 20,
): Promise<BusinessExcellencePrivatePrescriptionDimensionRankingRow[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];

  const client = getBigQueryClient();
  const query = `
    WITH all_base AS (
      SELECT
        reporting_version_id,
        COALESCE(NULLIF(TRIM(market_group), ''), 'No Market') AS market_group,
        NULLIF(TRIM(resolved_product_id), '') AS resolved_product_id,
        COALESCE(NULLIF(TRIM(product_closeup_raw), ''), 'Unmapped Product') AS product_label,
        COALESCE(NULLIF(TRIM(specialty), ''), 'Unmapped Specialty') AS specialty_label,
        COALESCE(NULLIF(TRIM(visited_source_raw), ''), 'Unmapped Territory') AS territory_label,
        COALESCE(is_ytd, FALSE) AS is_ytd,
        COALESCE(is_ytd_py, FALSE) AS is_ytd_py,
        recetas_value
      FROM \`${CLOSEUP_ENRICHED_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
    ),
    scoped_base AS (
      SELECT
        reporting_version_id,
        market_group,
        'all' AS scope,
        product_label,
        specialty_label,
        territory_label,
        is_ytd,
        is_ytd_py,
        recetas_value
      FROM all_base
      UNION ALL
      SELECT
        reporting_version_id,
        market_group,
        'chiesi' AS scope,
        product_label,
        specialty_label,
        territory_label,
        is_ytd,
        is_ytd_py,
        recetas_value
      FROM all_base
      WHERE resolved_product_id IS NOT NULL
    ),
    product_rows AS (
      SELECT
        reporting_version_id,
        market_group,
        scope,
        'product' AS dimension,
        product_label AS label,
        SUM(IF(is_ytd, recetas_value, 0)) AS ytd_rx,
        SUM(IF(is_ytd_py, recetas_value, 0)) AS ytd_py_rx
      FROM scoped_base
      GROUP BY 1, 2, 3, 4, 5
    ),
    specialty_rows AS (
      SELECT
        reporting_version_id,
        market_group,
        scope,
        'specialty' AS dimension,
        specialty_label AS label,
        SUM(IF(is_ytd, recetas_value, 0)) AS ytd_rx,
        SUM(IF(is_ytd_py, recetas_value, 0)) AS ytd_py_rx
      FROM scoped_base
      GROUP BY 1, 2, 3, 4, 5
    ),
    territory_rows AS (
      SELECT
        reporting_version_id,
        market_group,
        scope,
        'territory' AS dimension,
        territory_label AS label,
        SUM(IF(is_ytd, recetas_value, 0)) AS ytd_rx,
        SUM(IF(is_ytd_py, recetas_value, 0)) AS ytd_py_rx
      FROM scoped_base
      GROUP BY 1, 2, 3, 4, 5
    ),
    all_rows AS (
      SELECT * FROM product_rows
      UNION ALL
      SELECT * FROM specialty_rows
      UNION ALL
      SELECT * FROM territory_rows
    )
    SELECT
      reporting_version_id,
      market_group,
      scope,
      dimension,
      label,
      ytd_rx,
      ytd_py_rx
    FROM all_rows
    QUALIFY ROW_NUMBER() OVER (
      PARTITION BY market_group, scope, dimension
      ORDER BY ytd_rx DESC, label
    ) <= @limit
    ORDER BY market_group, scope, dimension, ytd_rx DESC, label
  `;

  const [rows] = await client.query({
    query,
    params: { reportingVersionId: resolvedReportingVersionId, limit },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => {
    const ytdRx = Number(row.ytd_rx ?? 0);
    const ytdPyRx = Number(row.ytd_py_rx ?? 0);
    const growthVsPyPct = ytdPyRx === 0 ? null : ((ytdRx - ytdPyRx) / ytdPyRx) * 100;
    return {
      reportingVersionId: String(row.reporting_version_id ?? resolvedReportingVersionId),
      marketGroup: String(row.market_group ?? 'No Market'),
      scope: String(row.scope ?? 'all') as 'all' | 'chiesi',
      dimension: String(row.dimension ?? 'product') as 'product' | 'specialty' | 'territory',
      label: String(row.label ?? 'Unmapped Label'),
      ytdRx,
      ytdPyRx,
      growthVsPyPct,
    };
  });
}

export async function getBusinessExcellencePrivateSellOutOverview(
  reportingVersionId?: string,
  filters: BusinessExcellencePrivateSellOutFilters = {},
): Promise<BusinessExcellencePrivateSellOutOverview | null> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;
  const client = getBigQueryClient();
  const normalizedFilters = normalizePrivateSellOutFilters(filters);
  const params: Record<string, string | number> = {
    reportingVersionId: resolvedReportingVersionId,
  };
  const scopedWhere = buildPrivateSellOutScope(normalizedFilters, params);
  const ytdWhere = buildPrivateSellOutYtdWindow('p', 'lp');

  const query = `
    WITH filtered_pmm AS (
      SELECT *
      FROM \`${PMM_ENRICHED_TABLE}\`
      WHERE ${scopedWhere}
    ),
    version_context AS (
      SELECT
        CAST(MAX(report_period_month) AS STRING) AS report_period_month,
        CAST(MAX(source_as_of_month) AS STRING) AS source_as_of_month
      FROM filtered_pmm
    ),
    latest_period_context AS (
      SELECT CAST(MAX(period_month) AS STRING) AS latest_period
      FROM filtered_pmm
      ${normalizedFilters.periodMonth ? 'WHERE period_month = DATE(@periodMonth)' : ''}
    ),
    pmm_base AS (
      SELECT
        p.*,
        vc.report_period_month AS context_report_period_month,
        vc.source_as_of_month AS context_source_as_of_month,
        lp.latest_period AS latest_period
      FROM filtered_pmm p
      CROSS JOIN version_context vc
      CROSS JOIN latest_period_context lp
      WHERE lp.latest_period IS NOT NULL
        AND ${ytdWhere}
    )
    SELECT
      MAX(pmm_base.latest_period) AS latest_period,
      CONCAT(SUBSTR(MAX(pmm_base.latest_period), 1, 4), '-01-01') AS ytd_start_period,
      MAX(pmm_base.context_report_period_month) AS report_period_month,
      MAX(pmm_base.context_source_as_of_month) AS source_as_of_month,
      COALESCE(SUM(IF(pmm_base.period_month = DATE(pmm_base.latest_period) AND LOWER(TRIM(pmm_base.sales_group)) = 'net sales', pmm_base.amount_value, 0)), 0) AS last_month_net_sales,
      COALESCE(SUM(IF(pmm_base.period_month = DATE(pmm_base.latest_period) AND LOWER(TRIM(pmm_base.sales_group)) = 'units', pmm_base.amount_value, 0)), 0) AS last_month_units,
      COALESCE(SUM(IF(LOWER(TRIM(pmm_base.sales_group)) = 'net sales', pmm_base.amount_value, 0)), 0) AS ytd_net_sales,
      COALESCE(SUM(IF(LOWER(TRIM(pmm_base.sales_group)) = 'units', pmm_base.amount_value, 0)), 0) AS ytd_units
    FROM pmm_base
  `;

  const [rows] = await client.query({
    query,
    params,
  });
  const row = (rows as Array<Record<string, unknown>>)[0] ?? {};
  if (!row.latest_period) return null;

  return {
    latestPeriod: String(row.latest_period),
    ytdStartPeriod: String(row.ytd_start_period ?? ''),
    reportPeriodMonth: row.report_period_month ? String(row.report_period_month) : null,
    sourceAsOfMonth: row.source_as_of_month ? String(row.source_as_of_month) : null,
    lastMonthNetSales: Number(row.last_month_net_sales ?? 0),
    lastMonthUnits: Number(row.last_month_units ?? 0),
    ytdNetSales: Number(row.ytd_net_sales ?? 0),
    ytdUnits: Number(row.ytd_units ?? 0),
  };
}

export async function getBusinessExcellencePrivateManagers(
  reportingVersionId?: string,
  filters: BusinessExcellencePrivateSellOutFilters = {},
  limit = 8,
): Promise<BusinessExcellencePrivateManagerRow[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];

  const client = getBigQueryClient();
  const normalizedFilters = normalizePrivateSellOutFilters(filters);
  const params: Record<string, string | number> = {
    reportingVersionId: resolvedReportingVersionId,
    limit,
  };
  const scopedWhere = buildPrivateSellOutScope(normalizedFilters, params);
  const ytdWhere = buildPrivateSellOutYtdWindow('f', 'lp');
  const query = `
    WITH filtered_pmm AS (
      SELECT *
      FROM \`${PMM_ENRICHED_TABLE}\`
      WHERE ${scopedWhere}
    ),
    latest_period_context AS (
      SELECT CAST(MAX(period_month) AS STRING) AS latest_period
      FROM filtered_pmm
      ${normalizedFilters.periodMonth ? 'WHERE period_month = DATE(@periodMonth)' : ''}
    )
    SELECT
      COALESCE(NULLIF(f.manager, ''), 'Unassigned') AS label,
      SUM(IF(LOWER(TRIM(f.sales_group)) = 'net sales', f.amount_value, 0)) AS ytd_net_sales,
      SUM(IF(LOWER(TRIM(f.sales_group)) = 'units', f.amount_value, 0)) AS ytd_units
    FROM filtered_pmm f
    CROSS JOIN latest_period_context lp
    WHERE lp.latest_period IS NOT NULL
      AND ${ytdWhere}
    GROUP BY label
    ORDER BY ytd_net_sales DESC
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    label: String(row.label ?? 'Unassigned'),
    ytdNetSales: Number(row.ytd_net_sales ?? 0),
    ytdUnits: Number(row.ytd_units ?? 0),
  }));
}

export async function getBusinessExcellencePrivateProducts(
  reportingVersionId?: string,
  filters: BusinessExcellencePrivateSellOutFilters = {},
  limit = 8,
): Promise<BusinessExcellencePrivateProductRow[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];

  const client = getBigQueryClient();
  const normalizedFilters = normalizePrivateSellOutFilters(filters);
  const params: Record<string, string | number> = {
    reportingVersionId: resolvedReportingVersionId,
    limit,
  };
  const scopedWhere = buildPrivateSellOutScope(normalizedFilters, params);
  const ytdWhere = buildPrivateSellOutYtdWindow('f', 'lp');
  const query = `
    WITH filtered_pmm AS (
      SELECT *
      FROM \`${PMM_ENRICHED_TABLE}\`
      WHERE ${scopedWhere}
    ),
    latest_period_context AS (
      SELECT CAST(MAX(period_month) AS STRING) AS latest_period
      FROM filtered_pmm
      ${normalizedFilters.periodMonth ? 'WHERE period_month = DATE(@periodMonth)' : ''}
    )
    SELECT
      NULLIF(f.resolved_product_id, '') AS product_id,
      COALESCE(NULLIF(f.canonical_product_name, ''), 'Unmapped Product') AS canonical_product_name,
      SUM(IF(LOWER(TRIM(f.sales_group)) = 'net sales', f.amount_value, 0)) AS ytd_net_sales,
      SUM(IF(LOWER(TRIM(f.sales_group)) = 'units', f.amount_value, 0)) AS ytd_units
    FROM filtered_pmm f
    CROSS JOIN latest_period_context lp
    WHERE lp.latest_period IS NOT NULL
      AND ${ytdWhere}
    GROUP BY product_id, canonical_product_name
    ORDER BY ytd_net_sales DESC
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    productId: row.product_id ? String(row.product_id) : null,
    canonicalProductName: String(row.canonical_product_name ?? 'Unmapped Product'),
    ytdNetSales: Number(row.ytd_net_sales ?? 0),
    ytdUnits: Number(row.ytd_units ?? 0),
  }));
}

export async function getBusinessExcellencePrivateTerritories(
  reportingVersionId?: string,
  filters: BusinessExcellencePrivateSellOutFilters = {},
  limit = 8,
): Promise<BusinessExcellencePrivateTerritoryRow[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];

  const client = getBigQueryClient();
  const normalizedFilters = normalizePrivateSellOutFilters(filters);
  const params: Record<string, string | number> = {
    reportingVersionId: resolvedReportingVersionId,
    limit,
  };
  const scopedWhere = buildPrivateSellOutScope(normalizedFilters, params);
  const ytdWhere = buildPrivateSellOutYtdWindow('f', 'lp');
  const query = `
    WITH filtered_pmm AS (
      SELECT *
      FROM \`${PMM_ENRICHED_TABLE}\`
      WHERE ${scopedWhere}
    ),
    latest_period_context AS (
      SELECT CAST(MAX(period_month) AS STRING) AS latest_period
      FROM filtered_pmm
      ${normalizedFilters.periodMonth ? 'WHERE period_month = DATE(@periodMonth)' : ''}
    )
    SELECT
      COALESCE(NULLIF(f.territory, ''), 'Unassigned') AS label,
      SUM(IF(LOWER(TRIM(f.sales_group)) = 'net sales', f.amount_value, 0)) AS ytd_net_sales,
      SUM(IF(LOWER(TRIM(f.sales_group)) = 'units', f.amount_value, 0)) AS ytd_units
    FROM filtered_pmm f
    CROSS JOIN latest_period_context lp
    WHERE lp.latest_period IS NOT NULL
      AND ${ytdWhere}
    GROUP BY label
    ORDER BY ytd_net_sales DESC
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    label: String(row.label ?? 'Unassigned'),
    ytdNetSales: Number(row.ytd_net_sales ?? 0),
    ytdUnits: Number(row.ytd_units ?? 0),
  }));
}

export async function getBusinessExcellencePrivatePrescriptionsOverview(
  reportingVersionId?: string,
): Promise<BusinessExcellencePrivatePrescriptionsOverview | null> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;

  const client = getBigQueryClient();
  const specialtyPredicate = `
    (
      REGEXP_CONTAINS(LOWER(TRIM(COALESCE(specialty, ''))), r'neumo')
      OR REGEXP_CONTAINS(LOWER(TRIM(COALESCE(specialty, ''))), r'medic')
      OR REGEXP_CONTAINS(LOWER(TRIM(COALESCE(specialty, ''))), r'gral')
      OR REGEXP_CONTAINS(LOWER(TRIM(COALESCE(specialty, ''))), r'general')
    )
  `;
  const query = `
    WITH filtered_closeup AS (
      SELECT *
      FROM \`${CLOSEUP_ENRICHED_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
        AND resolved_product_id IS NOT NULL
        AND TRIM(resolved_product_id) != ''
        AND ${specialtyPredicate}
    ),
    version_context AS (
      SELECT
        CAST(MAX(report_period_month) AS STRING) AS report_period_month,
        CAST(MAX(COALESCE(source_as_of_month, period_month)) AS STRING) AS source_as_of_month
      FROM filtered_closeup
    ),
    latest_period_context AS (
      SELECT CAST(MAX(period_month) AS STRING) AS latest_period
      FROM filtered_closeup
    ),
    closeup_base AS (
      SELECT
        c.*,
        vc.report_period_month AS context_report_period_month,
        vc.source_as_of_month AS context_source_as_of_month,
        lp.latest_period AS latest_period
      FROM filtered_closeup c
      CROSS JOIN version_context vc
      CROSS JOIN latest_period_context lp
      WHERE c.reporting_version_id = @reportingVersionId
        AND lp.latest_period IS NOT NULL
        AND c.period_month BETWEEN DATE(CONCAT(SUBSTR(lp.latest_period, 1, 4), '-01-01')) AND DATE(lp.latest_period)
    )
    SELECT
      MAX(closeup_base.latest_period) AS latest_period,
      CONCAT(SUBSTR(MAX(closeup_base.latest_period), 1, 4), '-01-01') AS ytd_start_period,
      MAX(closeup_base.context_report_period_month) AS report_period_month,
      MAX(closeup_base.context_source_as_of_month) AS source_as_of_month,
      COALESCE(SUM(closeup_base.recetas_value), 0) AS ytd_recetas
    FROM closeup_base
  `;

  const [rows] = await client.query({
    query,
    params: { reportingVersionId: resolvedReportingVersionId },
  });
  const row = (rows as Array<Record<string, unknown>>)[0] ?? {};
  if (!row.latest_period) return null;

  return {
    latestPeriod: String(row.latest_period),
    ytdStartPeriod: String(row.ytd_start_period ?? ''),
    reportPeriodMonth: row.report_period_month ? String(row.report_period_month) : null,
    sourceAsOfMonth: row.source_as_of_month ? String(row.source_as_of_month) : null,
    ytdRecetas: Number(row.ytd_recetas ?? 0),
  };
}

export async function getBusinessExcellencePrivateBrandSpecialtySignals(
  reportingVersionId?: string,
): Promise<BusinessExcellencePrivateBrandSpecialtySignal[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];

  const client = getBigQueryClient();
  const query = `
    WITH base AS (
      SELECT
        reporting_version_id,
        COALESCE(NULLIF(TRIM(market_group), ''), 'No Market') AS market_group,
        COALESCE(NULLIF(TRIM(brand_name), ''), 'Unmapped Brand') AS brand_name,
        COALESCE(NULLIF(TRIM(specialty), ''), 'Unmapped Specialty') AS specialty,
        COALESCE(is_ytd, FALSE) AS is_ytd,
        COALESCE(is_ytd_py, FALSE) AS is_ytd_py,
        recetas_value
      FROM \`${CLOSEUP_ENRICHED_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
    )
    SELECT
      reporting_version_id,
      market_group,
      brand_name,
      specialty,
      SUM(IF(is_ytd, recetas_value, 0)) AS ytd_rx,
      SUM(IF(is_ytd_py, recetas_value, 0)) AS ytd_py_rx
    FROM base
    GROUP BY 1, 2, 3, 4
    HAVING ytd_rx > 0 OR ytd_py_rx > 0
    ORDER BY market_group, brand_name, ytd_rx DESC, specialty
  `;

  const [rows] = await client.query({
    query,
    params: { reportingVersionId: resolvedReportingVersionId },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => {
    const ytdRx = Number(row.ytd_rx ?? 0);
    const ytdPyRx = Number(row.ytd_py_rx ?? 0);
    return {
      reportingVersionId: String(row.reporting_version_id ?? resolvedReportingVersionId),
      marketGroup: String(row.market_group ?? 'No Market'),
      brandName: String(row.brand_name ?? 'Unmapped Brand'),
      specialty: String(row.specialty ?? 'Unmapped Specialty'),
      ytdRx,
      ytdPyRx,
      growthVsPyPct: ytdPyRx === 0 ? null : ((ytdRx - ytdPyRx) / ytdPyRx) * 100,
    };
  });
}

export async function getBusinessExcellencePrivateChannels(
  reportingVersionId?: string,
  limit = 8,
): Promise<BusinessExcellencePrivateChannelRow[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];
  const latestPeriod = await getBusinessExcellenceLatestPeriod(resolvedReportingVersionId);
  if (!latestPeriod) return [];

  const client = getBigQueryClient();
  const ytdStartPeriod = toYearStart(latestPeriod);
  const query = `
    SELECT
      COALESCE(NULLIF(manager, ''), COALESCE(NULLIF(territory, ''), 'Unassigned')) AS label,
      SUM(IF(LOWER(TRIM(sales_group)) = 'units', amount_value, 0)) AS ytd_units
    FROM \`${PMM_ENRICHED_TABLE}\`
    WHERE reporting_version_id = @reportingVersionId
      AND period_month BETWEEN DATE(@ytdStartPeriod) AND DATE(@latestPeriod)
    GROUP BY label
    ORDER BY ytd_units DESC
    LIMIT @limit
  `;

  const [rows] = await client.query({
    query,
    params: { reportingVersionId: resolvedReportingVersionId, latestPeriod, ytdStartPeriod, limit },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    label: String(row.label ?? 'Unassigned'),
    ytdUnits: Number(row.ytd_units ?? 0),
  }));
}

export async function getBusinessExcellencePrivateScorecard(
  reportingVersionId?: string,
  filters: BusinessExcellencePrivateSellOutFilters = {},
  limit = 8,
): Promise<BusinessExcellencePrivateScorecard | null> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;

  const client = getBigQueryClient();
  const normalizedFilters = normalizePrivateSellOutFilters(filters);
  const latestPeriodParams: Record<string, string | number> = {
    reportingVersionId: resolvedReportingVersionId,
  };
  const scopeWhere = buildPrivateSellOutScope(normalizedFilters, latestPeriodParams);
  if (normalizedFilters.periodMonth) {
    latestPeriodParams.periodMonth = normalizedFilters.periodMonth;
  }
  const [latestPeriodRows] = await client.query({
    query: `
      SELECT CAST(MAX(period_month) AS STRING) AS latest_period
      FROM \`${PMM_ENRICHED_TABLE}\`
      WHERE ${scopeWhere}
      ${normalizedFilters.periodMonth ? 'AND period_month = DATE(@periodMonth)' : ''}
    `,
    params: latestPeriodParams,
  });
  const latestPeriod =
    (latestPeriodRows as Array<{ latest_period?: string | null }>)[0]?.latest_period ?? null;
  if (!latestPeriod) return null;

  const latestDate = new Date(`${latestPeriod}T00:00:00`);
  const lyDate = new Date(latestDate);
  lyDate.setFullYear(lyDate.getFullYear() - 1);
  const lyPeriod = lyDate.toISOString().slice(0, 10);

  const marketParams: Record<string, string | number> = {
    ...latestPeriodParams,
    latestPeriod,
    lyPeriod,
    limit,
  };
  const effectiveMarketGroup = normalizedFilters.marketGroup ?? null;
  const marketCondition = effectiveMarketGroup ? 'AND market_group = @marketGroup' : '';
  const managerCondition = normalizedFilters.manager ? 'AND manager = @manager' : '';
  const territoryCondition = normalizedFilters.territory ? 'AND territory = @territory' : '';

  const query = `
    WITH latest_products AS (
      SELECT
        NULLIF(resolved_product_id, '') AS product_id,
        COALESCE(NULLIF(canonical_product_name, ''), 'Unmapped Product') AS canonical_product_name,
        SUM(amount_value) AS latest_units
      FROM \`${PMM_ENRICHED_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
        AND period_month = DATE(@latestPeriod)
        AND LOWER(TRIM(sales_group)) = 'units'
        ${marketCondition}
        ${managerCondition}
        ${territoryCondition}
      GROUP BY product_id, canonical_product_name
    ),
    ly_products AS (
      SELECT
        NULLIF(resolved_product_id, '') AS product_id,
        COALESCE(NULLIF(canonical_product_name, ''), 'Unmapped Product') AS canonical_product_name,
        SUM(amount_value) AS ly_units
      FROM \`${PMM_ENRICHED_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
        AND period_month = DATE(@lyPeriod)
        AND LOWER(TRIM(sales_group)) = 'units'
        ${marketCondition}
        ${managerCondition}
        ${territoryCondition}
      GROUP BY product_id, canonical_product_name
    ),
    budget_products AS (
      SELECT
        NULLIF(resolved_product_id, '') AS product_id,
        COALESCE(NULLIF(canonical_product_name, ''), 'Unmapped Product') AS canonical_product_name,
        SUM(amount_value) AS budget_units
      FROM \`${SELL_OUT_ENRICHED_VIEW}\`
      WHERE period_month = DATE(@latestPeriod)
        AND LOWER(TRIM(sales_group)) = 'units'
        ${marketCondition}
      GROUP BY product_id, canonical_product_name
    ),
    totals AS (
      SELECT
        (SELECT COALESCE(SUM(amount_value), 0)
         FROM \`${PMM_ENRICHED_TABLE}\`
         WHERE reporting_version_id = @reportingVersionId
           AND period_month = DATE(@latestPeriod)
           AND LOWER(TRIM(sales_group)) = 'units'
           ${marketCondition}) AS latest_total_units,
        (SELECT COALESCE(SUM(amount_value), 0)
         FROM \`${PMM_ENRICHED_TABLE}\`
         WHERE reporting_version_id = @reportingVersionId
           AND period_month = DATE(@lyPeriod)
           AND LOWER(TRIM(sales_group)) = 'units'
           ${marketCondition}
           ${managerCondition}
           ${territoryCondition}) AS ly_total_units,
        (SELECT COALESCE(SUM(amount_value), 0)
         FROM \`${PMM_ENRICHED_TABLE}\`
         WHERE reporting_version_id = @reportingVersionId
           AND period_month = DATE(@latestPeriod)
           AND LOWER(TRIM(sales_group)) = 'units'
           ${marketCondition}
           ${managerCondition}
           ${territoryCondition}) AS filtered_latest_total_units,
        (SELECT COALESCE(SUM(amount_value), 0)
         FROM \`${SELL_OUT_ENRICHED_VIEW}\`
         WHERE period_month = DATE(@latestPeriod)
           AND LOWER(TRIM(sales_group)) = 'units'
           ${marketCondition}) AS budget_total_units
    )
    SELECT
      COALESCE(l.product_id, y.product_id, b.product_id) AS product_id,
      COALESCE(l.canonical_product_name, y.canonical_product_name, b.canonical_product_name) AS canonical_product_name,
      COALESCE(l.latest_units, 0) AS latest_units,
      y.ly_units AS ly_units,
      b.budget_units AS budget_units,
      t.filtered_latest_total_units AS latest_total_units,
      t.ly_total_units,
      t.budget_total_units
    FROM latest_products l
    FULL OUTER JOIN ly_products y
      ON COALESCE(l.product_id, CONCAT('name:', l.canonical_product_name))
       = COALESCE(y.product_id, CONCAT('name:', y.canonical_product_name))
    FULL OUTER JOIN budget_products b
      ON COALESCE(COALESCE(l.product_id, y.product_id), CONCAT('name:', COALESCE(l.canonical_product_name, y.canonical_product_name)))
       = COALESCE(b.product_id, CONCAT('name:', b.canonical_product_name))
    CROSS JOIN totals t
    ORDER BY latest_units DESC
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params: marketParams });
  const typedRows = rows as Array<Record<string, unknown>>;
  const latestTotalUnits = Number(typedRows[0]?.latest_total_units ?? 0);
  const lyTotalUnitsRaw = Number(typedRows[0]?.ly_total_units ?? 0);
  const budgetTotalUnitsRaw = Number(typedRows[0]?.budget_total_units ?? 0);

  const scoreRows: BusinessExcellencePrivateScorecardRow[] = typedRows.map((row) => {
    const latestUnits = Number(row.latest_units ?? 0);
    const lyUnits = row.ly_units === null || row.ly_units === undefined ? null : Number(row.ly_units);
    const budgetUnits = row.budget_units === null || row.budget_units === undefined ? null : Number(row.budget_units);
    const marketShareLatestPct = latestTotalUnits > 0 ? (latestUnits / latestTotalUnits) * 100 : null;
    const marketShareLyPct =
      lyUnits !== null && lyTotalUnitsRaw > 0 ? (lyUnits / lyTotalUnitsRaw) * 100 : null;
    const growthPct =
      lyUnits === null || lyUnits === 0 ? null : ((latestUnits - lyUnits) / lyUnits) * 100;
    const coveragePct =
      budgetUnits === null || budgetUnits === 0 ? null : (latestUnits / budgetUnits) * 100;
    const evolutionIndex =
      marketShareLyPct === null || marketShareLyPct === 0 || marketShareLatestPct === null
        ? null
        : (marketShareLatestPct / marketShareLyPct) * 100;

    return {
      productId: row.product_id ? String(row.product_id) : null,
      canonicalProductName: String(row.canonical_product_name ?? 'Unmapped Product'),
      latestUnits,
      lyUnits,
      budgetUnits,
      growthPct,
      coveragePct,
      marketShareLyPct,
      marketShareLatestPct,
      evolutionIndex,
    };
  });

  const latestUnitsTotal = scoreRows.reduce((sum, row) => sum + row.latestUnits, 0);
  const lyUnitsTotal = scoreRows.every((row) => row.lyUnits === null)
    ? null
    : scoreRows.reduce((sum, row) => sum + (row.lyUnits ?? 0), 0);
  const budgetUnitsTotal = scoreRows.every((row) => row.budgetUnits === null)
    ? null
    : scoreRows.reduce((sum, row) => sum + (row.budgetUnits ?? 0), 0);

  return {
    marketGroup: effectiveMarketGroup,
    latestPeriod,
    lyPeriod,
    budgetAvailable: budgetTotalUnitsRaw > 0,
    rows: scoreRows,
    totals: {
      latestUnits: latestUnitsTotal,
      lyUnits: lyUnitsTotal,
      budgetUnits: budgetUnitsTotal,
      growthPct:
        lyUnitsTotal === null || lyUnitsTotal === 0 ? null : ((latestUnitsTotal - lyUnitsTotal) / lyUnitsTotal) * 100,
      coveragePct:
        budgetUnitsTotal === null || budgetUnitsTotal === 0 ? null : (latestUnitsTotal / budgetUnitsTotal) * 100,
      marketShareLyPct: lyTotalUnitsRaw > 0 && lyUnitsTotal !== null ? (lyUnitsTotal / lyTotalUnitsRaw) * 100 : null,
      marketShareLatestPct: latestTotalUnits > 0 ? (latestUnitsTotal / latestTotalUnits) * 100 : null,
      evolutionIndex:
        lyTotalUnitsRaw > 0 &&
        lyUnitsTotal !== null &&
        latestTotalUnits > 0 &&
        ((lyUnitsTotal / lyTotalUnitsRaw) * 100) !== 0
          ? ((latestUnitsTotal / latestTotalUnits) * 100) / ((lyUnitsTotal / lyTotalUnitsRaw) * 100) * 100
          : null,
    },
  };
}

export async function getBusinessExcellencePrivateUploadContext(
  reportingVersionId?: string,
): Promise<BusinessExcellencePrivateUploadContext | null> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;
  const client = getBigQueryClient();
  const query = `
    SELECT
      e.reporting_version_id AS reporting_version_id,
      e.upload_id AS pmm_upload_id,
      u.source_file_name AS pmm_source_file_name,
      COALESCE(
        NULLIF(TRIM(u.ddd_source), ''),
        CASE
          WHEN LOWER(u.source_file_name) LIKE '%innovair%' THEN 'innovair'
          WHEN LOWER(u.source_file_name) LIKE '%ribuspir%' THEN 'ribuspir'
          WHEN LOWER(u.source_file_name) LIKE '%rinoclenil%' THEN 'rinoclenil'
          ELSE 'unknown'
        END
      ) AS pmm_source_key,
      CAST(NULL AS STRING) AS private_sell_out_upload_id,
      CAST(NULL AS STRING) AS private_sell_out_source_file_name
    FROM \`${PMM_ENRICHED_TABLE}\` e
    LEFT JOIN \`${RAW_UPLOADS}\` u
      ON u.upload_id = e.upload_id
    WHERE e.reporting_version_id = @reportingVersionId
    QUALIFY ROW_NUMBER() OVER (ORDER BY e.period_month DESC, e.row_number DESC) = 1
  `;

  const [rows] = await client.query({ query, params: { reportingVersionId: resolvedReportingVersionId } });
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;

  return {
    reportingVersionId: row.reporting_version_id ? String(row.reporting_version_id) : null,
    pmmUploadId: row.pmm_upload_id ? String(row.pmm_upload_id) : null,
    pmmSourceFileName: row.pmm_source_file_name ? String(row.pmm_source_file_name) : null,
    pmmSourceKey: row.pmm_source_key ? String(row.pmm_source_key) : null,
    privateSellOutUploadId: row.private_sell_out_upload_id ? String(row.private_sell_out_upload_id) : null,
    privateSellOutSourceFileName: row.private_sell_out_source_file_name
      ? String(row.private_sell_out_source_file_name)
      : null,
  };
}

export async function getBusinessExcellenceSourceOverviews(
  reportingVersionId?: string,
): Promise<BusinessExcellenceSourceOverview[]> {
  const client = getBigQueryClient();
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];
  const [pmmLatestPeriod, closeupLatestPeriod, budgetLatestPeriod] = await Promise.all([
    getLatestPeriodDirect(PMM_ENRICHED_TABLE, resolvedReportingVersionId),
    getLatestPeriodDirect(CLOSEUP_ENRICHED_VIEW, resolvedReportingVersionId),
    getLatestPeriodForTable(SELL_OUT_TABLE, 'latest_sell_out_uploads'),
  ]);

  const results: BusinessExcellenceSourceOverview[] = [];

  if (pmmLatestPeriod) {
    const ytdStartPeriod = toYearStart(pmmLatestPeriod);
    const query = `
      SELECT
        COALESCE(SUM(IF(period_month = DATE(@latestPeriod) AND LOWER(TRIM(sales_group)) = 'net sales', amount_value, 0)), 0) AS last_month_net_sales,
        COALESCE(SUM(IF(LOWER(TRIM(sales_group)) = 'net sales', amount_value, 0)), 0) AS ytd_net_sales,
        COALESCE(SUM(IF(LOWER(TRIM(sales_group)) = 'units', amount_value, 0)), 0) AS ytd_units
      FROM \`${PMM_ENRICHED_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
        AND period_month BETWEEN DATE(@ytdStartPeriod) AND DATE(@latestPeriod)
    `;
    const [rows] = await client.query({
      query,
      params: { reportingVersionId: resolvedReportingVersionId, latestPeriod: pmmLatestPeriod, ytdStartPeriod },
    });
    const row = (rows as Array<Record<string, unknown>>)[0] ?? {};
    results.push({
      sourceKey: 'pmm',
      sourceLabel: 'Sell Out Privado',
      latestPeriod: pmmLatestPeriod,
      ytdStartPeriod,
      lastMonthPrimaryValue: Number(row.last_month_net_sales ?? 0),
      ytdPrimaryValue: Number(row.ytd_net_sales ?? 0),
      secondaryValue: Number(row.ytd_units ?? 0),
      primaryMode: 'currency',
      secondaryMode: 'units',
      hasData: true,
    });
  } else {
    results.push({
      sourceKey: 'pmm',
      sourceLabel: 'Sell Out Privado',
      latestPeriod: null,
      ytdStartPeriod: null,
      lastMonthPrimaryValue: 0,
      ytdPrimaryValue: 0,
      secondaryValue: null,
      primaryMode: 'currency',
      secondaryMode: 'units',
      hasData: false,
    });
  }

  if (closeupLatestPeriod) {
    const ytdStartPeriod = toYearStart(closeupLatestPeriod);
    const query = `
      SELECT
        COALESCE(SUM(IF(period_month = DATE(@latestPeriod), recetas_value, 0)), 0) AS last_month_recetas,
        COALESCE(SUM(recetas_value), 0) AS ytd_recetas
      FROM \`${CLOSEUP_ENRICHED_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
        AND period_month BETWEEN DATE(@ytdStartPeriod) AND DATE(@latestPeriod)
    `;
    const [rows] = await client.query({
      query,
      params: { reportingVersionId: resolvedReportingVersionId, latestPeriod: closeupLatestPeriod, ytdStartPeriod },
    });
    const row = (rows as Array<Record<string, unknown>>)[0] ?? {};
    results.push({
      sourceKey: 'closeup',
      sourceLabel: 'Private Prescriptions',
      latestPeriod: closeupLatestPeriod,
      ytdStartPeriod,
      lastMonthPrimaryValue: Number(row.last_month_recetas ?? 0),
      ytdPrimaryValue: Number(row.ytd_recetas ?? 0),
      secondaryValue: null,
      primaryMode: 'units',
      secondaryMode: 'recetas',
      hasData: true,
    });
  } else {
    results.push({
      sourceKey: 'closeup',
      sourceLabel: 'Private Prescriptions',
      latestPeriod: null,
      ytdStartPeriod: null,
      lastMonthPrimaryValue: 0,
      ytdPrimaryValue: 0,
      secondaryValue: null,
      primaryMode: 'units',
      secondaryMode: 'recetas',
      hasData: false,
    });
  }

  if (budgetLatestPeriod) {
    const ytdStartPeriod = toYearStart(budgetLatestPeriod);
    const query = `
      WITH ${latestUploadsCtes()}
      SELECT
        COALESCE(SUM(IF(period_month = DATE(@latestPeriod) AND LOWER(TRIM(sales_group)) = 'units', amount_value, 0)), 0) AS last_month_budget_units,
        COALESCE(SUM(IF(LOWER(TRIM(sales_group)) = 'units', amount_value, 0)), 0) AS ytd_budget_units
      FROM \`${SELL_OUT_TABLE}\`
      WHERE upload_id IN (SELECT upload_id FROM latest_sell_out_uploads)
        AND period_month BETWEEN DATE(@ytdStartPeriod) AND DATE(@latestPeriod)
    `;
    const [rows] = await client.query({ query, params: { latestPeriod: budgetLatestPeriod, ytdStartPeriod } });
    const row = (rows as Array<Record<string, unknown>>)[0] ?? {};
    results.push({
      sourceKey: 'budget_sell_out',
      sourceLabel: 'Budget Sell Out',
      latestPeriod: budgetLatestPeriod,
      ytdStartPeriod,
      lastMonthPrimaryValue: Number(row.last_month_budget_units ?? 0),
      ytdPrimaryValue: Number(row.ytd_budget_units ?? 0),
      secondaryValue: null,
      primaryMode: 'units',
      secondaryMode: null,
      hasData: true,
    });
  } else {
    results.push({
      sourceKey: 'budget_sell_out',
      sourceLabel: 'Budget Sell Out',
      latestPeriod: null,
      ytdStartPeriod: null,
      lastMonthPrimaryValue: 0,
      ytdPrimaryValue: 0,
      secondaryValue: null,
      primaryMode: 'units',
      secondaryMode: null,
      hasData: false,
    });
  }

  return results;
}
