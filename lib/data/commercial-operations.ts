import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';

export type CommercialOperationsSourceRow = {
  moduleCode: string;
  moduleLabel: string;
  uploadId: string | null;
  reportingVersionId: string | null;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  uploadedAt: string | null;
  status: string | null;
  rowsValid: number | null;
  rowsTotal: number | null;
};

export type CommercialOperationsDsoOverviewRow = {
  reportingVersionId: string;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  latestPeriodMonth: string | null;
  groupName: string;
  customerSegment: string;
  channelScope: string;
  dsoReportPeriod: number | null;
  dsoReportPeriodPy: number | null;
  dsoPreviousMonth: number | null;
  dsoMth: number | null;
  dsoMthPy: number | null;
  dsoYtdAvg: number | null;
  dsoYtdAvgPy: number | null;
  deltaVsMoM: number | null;
  deltaVsYtdAvgPy: number | null;
  deltaVsPyMth: number | null;
  deltaVsPyYtd: number | null;
};

export type CommercialOperationsDsoTrendRow = {
  reportingVersionId: string;
  groupName: string;
  periodMonth: string;
  dsoValue: number;
  isYtd: boolean;
  isYtdPy: boolean;
  isMth: boolean;
  isMthPy: boolean;
};

export type CommercialOperationsStockRow = {
  reportingVersionId: string;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  latestPeriodMonth: string | null;
  businessType: string | null;
  market: string | null;
  businessUnitName: string | null;
  clientInstitution: string | null;
  marketGroup: string | null;
  brandName: string | null;
  canonicalProductName: string | null;
  stockType: string | null;
  periodMonth: string;
  stockValue: number;
  isYtd: boolean;
  isYtdPy: boolean;
  isMth: boolean;
  isMthPy: boolean;
};

const SOURCE_MODULES: Array<{ moduleCode: string; moduleLabel: string }> = [
  { moduleCode: 'commercial_operations_dso', moduleLabel: 'DSO' },
  { moduleCode: 'commercial_operations_government_orders', moduleLabel: 'Pedidos Gobierno' },
  {
    moduleCode: 'commercial_operations_government_contract_progress',
    moduleLabel: 'Avances de contrato Gobierno',
  },
  { moduleCode: 'commercial_operations_stocks', moduleLabel: 'Stocks' },
  { moduleCode: 'commercial_operations_sanctions', moduleLabel: 'Sansiones' },
];

const DSO_ENRICHED_VIEW = 'chiesi-committee.chiesi_committee_stg.vw_commercial_operations_dso_enriched';
const STOCKS_ENRICHED_VIEW = 'chiesi-committee.chiesi_committee_stg.vw_commercial_operations_stocks_enriched';

export async function getCommercialOperationsAuditSources(
  reportingVersionId?: string,
): Promise<CommercialOperationsSourceRow[]> {
  const client = getBigQueryClient();

  const moduleListSql = SOURCE_MODULES.map(
    (item) => `SELECT '${item.moduleCode}' AS module_code, '${item.moduleLabel}' AS module_label`,
  ).join('\nUNION ALL\n');

  const [rows] = await client.query({
    query: `
      WITH module_list AS (
        ${moduleListSql}
      ),
      uploads_scoped AS (
        SELECT
          u.upload_id,
          LOWER(TRIM(u.module_code)) AS module_code,
          u.reporting_version_id,
          CAST(u.period_month AS STRING) AS report_period_month,
          CAST(u.source_as_of_month AS STRING) AS source_as_of_month,
          CAST(u.uploaded_at AS STRING) AS uploaded_at,
          LOWER(TRIM(u.status)) AS status,
          CAST(u.rows_valid AS INT64) AS rows_valid,
          CAST(u.rows_total AS INT64) AS rows_total,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(u.module_code))
            ORDER BY u.uploaded_at DESC
          ) AS rn
        FROM \`chiesi-committee.chiesi_committee_raw.uploads\` u
        WHERE LOWER(TRIM(u.module_code)) IN (SELECT module_code FROM module_list)
          AND (@reportingVersionId IS NULL OR u.reporting_version_id = @reportingVersionId)
      )
      SELECT
        m.module_code,
        m.module_label,
        u.upload_id,
        u.reporting_version_id,
        u.report_period_month,
        u.source_as_of_month,
        u.uploaded_at,
        u.status,
        u.rows_valid,
        u.rows_total
      FROM module_list m
      LEFT JOIN uploads_scoped u
        ON u.module_code = m.module_code
       AND u.rn = 1
      ORDER BY m.module_label
    `,
    params: {
      reportingVersionId: reportingVersionId ?? null,
    },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    moduleCode: String(row.module_code ?? ''),
    moduleLabel: String(row.module_label ?? ''),
    uploadId: row.upload_id == null ? null : String(row.upload_id),
    reportingVersionId: row.reporting_version_id == null ? null : String(row.reporting_version_id),
    reportPeriodMonth: row.report_period_month == null ? null : String(row.report_period_month),
    sourceAsOfMonth: row.source_as_of_month == null ? null : String(row.source_as_of_month),
    uploadedAt: row.uploaded_at == null ? null : String(row.uploaded_at),
    status: row.status == null ? null : String(row.status),
    rowsValid: row.rows_valid == null ? null : Number(row.rows_valid),
    rowsTotal: row.rows_total == null ? null : Number(row.rows_total),
  }));
}

export async function getCommercialOperationsDsoOverview(
  reportingVersionId?: string,
): Promise<CommercialOperationsDsoOverviewRow[]> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH scoped AS (
        SELECT *
        FROM \`${DSO_ENRICHED_VIEW}\`
        WHERE (@reportingVersionId IS NULL OR reporting_version_id = @reportingVersionId)
      ),
      latest AS (
        SELECT
          reporting_version_id,
          MAX(latest_period_month) AS latest_period_month
        FROM scoped
        GROUP BY reporting_version_id
      )
      SELECT
        s.reporting_version_id,
        CAST(MAX(s.report_period_month) AS STRING) AS report_period_month,
        CAST(MAX(s.source_as_of_month) AS STRING) AS source_as_of_month,
        CAST(MAX(l.latest_period_month) AS STRING) AS latest_period_month,
        COALESCE(NULLIF(s.group_name, ''), 'Unassigned') AS group_name,
        COALESCE(NULLIF(s.customer_segment, ''), 'General') AS customer_segment,
        COALESCE(NULLIF(s.channel_scope, ''), 'General') AS channel_scope,
        CAST(AVG(IF(s.period_month = s.report_period_month, s.dso_value, NULL)) AS FLOAT64) AS dso_report_period,
        CAST(
          AVG(IF(s.period_month = DATE_SUB(s.report_period_month, INTERVAL 1 YEAR), s.dso_value, NULL))
          AS FLOAT64
        ) AS dso_report_period_py,
        CAST(
          AVG(IF(s.period_month = DATE_SUB(s.report_period_month, INTERVAL 1 MONTH), s.dso_value, NULL))
          AS FLOAT64
        ) AS dso_previous_month,
        CAST(AVG(IF(s.is_mth, s.dso_value, NULL)) AS FLOAT64) AS dso_mth,
        CAST(AVG(IF(s.is_mth_py, s.dso_value, NULL)) AS FLOAT64) AS dso_mth_py,
        CAST(
          AVG(
            IF(
              EXTRACT(YEAR FROM s.period_month) = EXTRACT(YEAR FROM s.report_period_month)
              AND s.period_month <= s.report_period_month,
              s.dso_value,
              NULL
            )
          ) AS FLOAT64
        ) AS dso_ytd_avg,
        CAST(
          COALESCE(
            AVG(
              IF(
                EXTRACT(YEAR FROM s.period_month) = EXTRACT(YEAR FROM DATE_SUB(s.report_period_month, INTERVAL 1 YEAR))
                AND EXTRACT(MONTH FROM s.period_month) <= EXTRACT(MONTH FROM s.report_period_month),
                s.dso_value,
                NULL
              )
            ),
            AVG(
              IF(
                EXTRACT(YEAR FROM s.period_month) = EXTRACT(YEAR FROM DATE_SUB(s.report_period_month, INTERVAL 1 YEAR)),
                s.dso_value,
                NULL
              )
            )
          ) AS FLOAT64
        ) AS dso_ytd_avg_py,
        CAST(
          AVG(IF(s.period_month = s.report_period_month, s.dso_value, NULL))
          - AVG(IF(s.period_month = DATE_SUB(s.report_period_month, INTERVAL 1 MONTH), s.dso_value, NULL))
          AS FLOAT64
        ) AS delta_vs_mom,
        CAST(
          AVG(
            IF(
              EXTRACT(YEAR FROM s.period_month) = EXTRACT(YEAR FROM s.report_period_month)
              AND s.period_month <= s.report_period_month,
              s.dso_value,
              NULL
            )
          ) - COALESCE(
            AVG(
              IF(
                EXTRACT(YEAR FROM s.period_month) = EXTRACT(YEAR FROM DATE_SUB(s.report_period_month, INTERVAL 1 YEAR))
                AND EXTRACT(MONTH FROM s.period_month) <= EXTRACT(MONTH FROM s.report_period_month),
                s.dso_value,
                NULL
              )
            ),
            AVG(
              IF(
                EXTRACT(YEAR FROM s.period_month) = EXTRACT(YEAR FROM DATE_SUB(s.report_period_month, INTERVAL 1 YEAR)),
                s.dso_value,
                NULL
              )
            )
          )
          AS FLOAT64
        ) AS delta_vs_ytd_avg_py,
        CAST(
          AVG(IF(s.is_mth, s.dso_value, NULL)) - AVG(IF(s.is_mth_py, s.dso_value, NULL))
          AS FLOAT64
        ) AS delta_vs_py_mth,
        CAST(
          AVG(
            IF(
              EXTRACT(YEAR FROM s.period_month) = EXTRACT(YEAR FROM s.report_period_month)
              AND s.period_month <= s.report_period_month,
              s.dso_value,
              NULL
            )
          ) - COALESCE(
            AVG(
              IF(
                EXTRACT(YEAR FROM s.period_month) = EXTRACT(YEAR FROM DATE_SUB(s.report_period_month, INTERVAL 1 YEAR))
                AND EXTRACT(MONTH FROM s.period_month) <= EXTRACT(MONTH FROM s.report_period_month),
                s.dso_value,
                NULL
              )
            ),
            AVG(
              IF(
                EXTRACT(YEAR FROM s.period_month) = EXTRACT(YEAR FROM DATE_SUB(s.report_period_month, INTERVAL 1 YEAR)),
                s.dso_value,
                NULL
              )
            )
          )
          AS FLOAT64
        ) AS delta_vs_py_ytd
      FROM scoped s
      JOIN latest l
        ON l.reporting_version_id = s.reporting_version_id
      GROUP BY
        s.reporting_version_id,
        group_name,
        customer_segment,
        channel_scope
      ORDER BY group_name
    `,
    params: {
      reportingVersionId: reportingVersionId ?? null,
    },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    reportingVersionId: String(row.reporting_version_id ?? ''),
    reportPeriodMonth: row.report_period_month == null ? null : String(row.report_period_month),
    sourceAsOfMonth: row.source_as_of_month == null ? null : String(row.source_as_of_month),
    latestPeriodMonth: row.latest_period_month == null ? null : String(row.latest_period_month),
    groupName: String(row.group_name ?? 'Unassigned'),
    customerSegment: String(row.customer_segment ?? 'General'),
    channelScope: String(row.channel_scope ?? 'General'),
    dsoReportPeriod: row.dso_report_period == null ? null : Number(row.dso_report_period),
    dsoReportPeriodPy: row.dso_report_period_py == null ? null : Number(row.dso_report_period_py),
    dsoPreviousMonth: row.dso_previous_month == null ? null : Number(row.dso_previous_month),
    dsoMth: row.dso_mth == null ? null : Number(row.dso_mth),
    dsoMthPy: row.dso_mth_py == null ? null : Number(row.dso_mth_py),
    dsoYtdAvg: row.dso_ytd_avg == null ? null : Number(row.dso_ytd_avg),
    dsoYtdAvgPy: row.dso_ytd_avg_py == null ? null : Number(row.dso_ytd_avg_py),
    deltaVsMoM: row.delta_vs_mom == null ? null : Number(row.delta_vs_mom),
    deltaVsYtdAvgPy: row.delta_vs_ytd_avg_py == null ? null : Number(row.delta_vs_ytd_avg_py),
    deltaVsPyMth: row.delta_vs_py_mth == null ? null : Number(row.delta_vs_py_mth),
    deltaVsPyYtd: row.delta_vs_py_ytd == null ? null : Number(row.delta_vs_py_ytd),
  }));
}

export async function getCommercialOperationsDsoTrend(
  reportingVersionId?: string,
  groupName?: string,
): Promise<CommercialOperationsDsoTrendRow[]> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        reporting_version_id,
        COALESCE(NULLIF(group_name, ''), 'Unassigned') AS group_name,
        CAST(period_month AS STRING) AS period_month,
        CAST(dso_value AS FLOAT64) AS dso_value,
        is_ytd,
        is_ytd_py,
        is_mth,
        is_mth_py
      FROM \`${DSO_ENRICHED_VIEW}\`
      WHERE (@reportingVersionId = '' OR reporting_version_id = @reportingVersionId)
        AND (@groupName = '' OR COALESCE(NULLIF(group_name, ''), 'Unassigned') = @groupName)
      ORDER BY period_month
    `,
    params: {
      reportingVersionId: reportingVersionId ?? '',
      groupName: groupName ?? '',
    },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    reportingVersionId: String(row.reporting_version_id ?? ''),
    groupName: String(row.group_name ?? 'Unassigned'),
    periodMonth: String(row.period_month ?? ''),
    dsoValue: Number(row.dso_value ?? 0),
    isYtd: Boolean(row.is_ytd),
    isYtdPy: Boolean(row.is_ytd_py),
    isMth: Boolean(row.is_mth),
    isMthPy: Boolean(row.is_mth_py),
  }));
}

export async function getCommercialOperationsStocksRows(
  reportingVersionId?: string,
): Promise<CommercialOperationsStockRow[]> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        reporting_version_id,
        CAST(report_period_month AS STRING) AS report_period_month,
        CAST(source_as_of_month AS STRING) AS source_as_of_month,
        CAST(latest_period_month AS STRING) AS latest_period_month,
        business_type,
        market,
        business_unit_name,
        client_institution,
        market_group,
        brand_name,
        canonical_product_name,
        stock_type,
        CAST(period_month AS STRING) AS period_month,
        CAST(stock_value AS FLOAT64) AS stock_value,
        is_ytd,
        is_ytd_py,
        is_mth,
        is_mth_py
      FROM \`${STOCKS_ENRICHED_VIEW}\`
      WHERE (@reportingVersionId = '' OR reporting_version_id = @reportingVersionId)
      ORDER BY period_month
    `,
    params: {
      reportingVersionId: reportingVersionId ?? '',
    },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    reportingVersionId: String(row.reporting_version_id ?? ''),
    reportPeriodMonth: row.report_period_month == null ? null : String(row.report_period_month),
    sourceAsOfMonth: row.source_as_of_month == null ? null : String(row.source_as_of_month),
    latestPeriodMonth: row.latest_period_month == null ? null : String(row.latest_period_month),
    businessType: row.business_type == null ? null : String(row.business_type),
    market: row.market == null ? null : String(row.market),
    businessUnitName: row.business_unit_name == null ? null : String(row.business_unit_name),
    clientInstitution: row.client_institution == null ? null : String(row.client_institution),
    marketGroup: row.market_group == null ? null : String(row.market_group),
    brandName: row.brand_name == null ? null : String(row.brand_name),
    canonicalProductName: row.canonical_product_name == null ? null : String(row.canonical_product_name),
    stockType: row.stock_type == null ? null : String(row.stock_type),
    periodMonth: String(row.period_month ?? ''),
    stockValue: Number(row.stock_value ?? 0),
    isYtd: Boolean(row.is_ytd),
    isYtdPy: Boolean(row.is_ytd_py),
    isMth: Boolean(row.is_mth),
    isMthPy: Boolean(row.is_mth_py),
  }));
}
