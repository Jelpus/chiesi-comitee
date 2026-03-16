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

export type CommercialOperationsGovernmentContractProgressRow = {
  reportingVersionId: string;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  latestPeriodMonth: string | null;
  category: string | null;
  contractKey: string | null;
  cbCode: string | null;
  assignedTo: string | null;
  contractNumber: string | null;
  contractType: string | null;
  institution: string | null;
  centralInstitution: string | null;
  businessUnit: string | null;
  marketGroup: string | null;
  brandName: string | null;
  sourceProductRaw: string | null;
  canonicalProductName: string | null;
  periodMonth: string;
  deliveredQuantity: number;
  maxQuantity2025: number | null;
  maxQuantity2026: number | null;
  maxQuantity2025Safe: number | null;
  maxQuantity2026Safe: number | null;
  total2025: number | null;
  total2026: number | null;
  maxContractQuantitySafe: number | null;
  maxContractQuantity: number | null;
  contractTotalQuantity: number | null;
  isYtd: boolean;
  isYtdPy: boolean;
  isMth: boolean;
  isMthPy: boolean;
};

export type CommercialOperationsDeliveryOrderRow = {
  reportingVersionId: string;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  latestPeriodMonth: string | null;
  orderScope: string | null;
  channelScope: string | null;
  businessUnitResolved: string | null;
  marketGroup: string | null;
  brandName: string | null;
  canonicalProductName: string | null;
  clientRequester: string | null;
  periodMonth: string;
  cantidadTotalPedido: number;
  cantidadEntregada: number;
  cantidadFacturada: number;
  fillRateDelivered: number | null;
  fillRateInvoiced: number | null;
  leadTimeDays: number | null;
  amountNotDelivered: number | null;
  unitsNotDelivered: number | null;
  isYtd: boolean;
  isYtdPy: boolean;
  isMth: boolean;
  isMthPy: boolean;
};

const SOURCE_MODULES: Array<{ moduleCode: string; moduleLabel: string }> = [
  { moduleCode: 'commercial_operations_dso', moduleLabel: 'DSO' },
  { moduleCode: 'commercial_operations_government_orders', moduleLabel: 'Pedidos Gobierno' },
  { moduleCode: 'commercial_operations_private_orders', moduleLabel: 'Pedidos Privado' },
  {
    moduleCode: 'commercial_operations_government_contract_progress',
    moduleLabel: 'Avances de contrato Gobierno',
  },
  { moduleCode: 'commercial_operations_stocks', moduleLabel: 'Stocks' },
  { moduleCode: 'commercial_operations_sanctions', moduleLabel: 'Sansiones' },
];

const DSO_ENRICHED_VIEW = 'chiesi-committee.chiesi_committee_stg.vw_commercial_operations_dso_enriched';
const STOCKS_ENRICHED_VIEW = 'chiesi-committee.chiesi_committee_stg.vw_commercial_operations_stocks_enriched';
const GOVERNMENT_CONTRACT_PROGRESS_ENRICHED_VIEW =
  'chiesi-committee.chiesi_committee_stg.vw_commercial_operations_government_contract_progress_enriched';
const DELIVERY_ORDERS_ENRICHED_VIEW =
  'chiesi-committee.chiesi_committee_stg.vw_commercial_operations_delivery_orders_enriched';

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

export async function getCommercialOperationsGovernmentContractProgressRows(
  reportingVersionId?: string,
): Promise<CommercialOperationsGovernmentContractProgressRow[]> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        reporting_version_id,
        CAST(report_period_month AS STRING) AS report_period_month,
        CAST(source_as_of_month AS STRING) AS source_as_of_month,
        CAST(latest_period_month AS STRING) AS latest_period_month,
        category,
        contract_key,
        cb_code,
        assigned_to,
        contract_number,
        contract_type,
        institution,
        central_institution,
        business_unit,
        market_group,
        brand_name,
        source_product_raw,
        canonical_product_name,
        CAST(period_month AS STRING) AS period_month,
        CAST(delivered_quantity AS FLOAT64) AS delivered_quantity,
        CAST(max_quantity_2025 AS FLOAT64) AS max_quantity_2025,
        CAST(max_quantity_2026 AS FLOAT64) AS max_quantity_2026,
        SAFE_CAST(
          REGEXP_REPLACE(
            COALESCE(
              JSON_VALUE(source_payload_json, '$."CANTIDAD MÁXIMA 2025"'),
              JSON_VALUE(source_payload_json, '$."CANTIDAD MAXIMA 2025"'),
              JSON_VALUE(source_payload_json, '$."CANTIDAD MÃXIMA 2025"')
            ),
            r'[^0-9,.\-]',
            ''
          ) AS FLOAT64
        ) AS max_quantity_2025_safe,
        SAFE_CAST(
          REGEXP_REPLACE(
            COALESCE(
              JSON_VALUE(source_payload_json, '$."CANTIDAD MÁXIMA 2026"'),
              JSON_VALUE(source_payload_json, '$."CANTIDAD MAXIMA 2026"'),
              JSON_VALUE(source_payload_json, '$."CANTIDAD MÃXIMA 2026"')
            ),
            r'[^0-9,.\-]',
            ''
          ) AS FLOAT64
        ) AS max_quantity_2026_safe,
        CAST(total_2025 AS FLOAT64) AS total_2025,
        CAST(total_2026 AS FLOAT64) AS total_2026,
        SAFE_CAST(
          REGEXP_REPLACE(
            COALESCE(
              JSON_VALUE(source_payload_json, '$."CANTIDAD TOTAL DEL CONTRATO"')
            ),
            r'[^0-9,.\-]',
            ''
          ) AS FLOAT64
        ) AS max_contract_quantity_safe,
        CAST(max_contract_quantity AS FLOAT64) AS max_contract_quantity,
        CAST(contract_total_quantity AS FLOAT64) AS contract_total_quantity,
        is_ytd,
        is_ytd_py,
        is_mth,
        is_mth_py
      FROM \`${GOVERNMENT_CONTRACT_PROGRESS_ENRICHED_VIEW}\`
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
    category: row.category == null ? null : String(row.category),
    contractKey: row.contract_key == null ? null : String(row.contract_key),
    cbCode: row.cb_code == null ? null : String(row.cb_code),
    assignedTo: row.assigned_to == null ? null : String(row.assigned_to),
    contractNumber: row.contract_number == null ? null : String(row.contract_number),
    contractType: row.contract_type == null ? null : String(row.contract_type),
    institution: row.institution == null ? null : String(row.institution),
    centralInstitution: row.central_institution == null ? null : String(row.central_institution),
    businessUnit: row.business_unit == null ? null : String(row.business_unit),
    marketGroup: row.market_group == null ? null : String(row.market_group),
    brandName: row.brand_name == null ? null : String(row.brand_name),
    sourceProductRaw: row.source_product_raw == null ? null : String(row.source_product_raw),
    canonicalProductName: row.canonical_product_name == null ? null : String(row.canonical_product_name),
    periodMonth: String(row.period_month ?? ''),
    deliveredQuantity: Number(row.delivered_quantity ?? 0),
    maxQuantity2025: row.max_quantity_2025 == null ? null : Number(row.max_quantity_2025),
    maxQuantity2026: row.max_quantity_2026 == null ? null : Number(row.max_quantity_2026),
    maxQuantity2025Safe:
      row.max_quantity_2025_safe == null ? null : Number(row.max_quantity_2025_safe),
    maxQuantity2026Safe:
      row.max_quantity_2026_safe == null ? null : Number(row.max_quantity_2026_safe),
    total2025: row.total_2025 == null ? null : Number(row.total_2025),
    total2026: row.total_2026 == null ? null : Number(row.total_2026),
    maxContractQuantitySafe:
      row.max_contract_quantity_safe == null ? null : Number(row.max_contract_quantity_safe),
    maxContractQuantity:
      row.max_contract_quantity == null ? null : Number(row.max_contract_quantity),
    contractTotalQuantity:
      row.contract_total_quantity == null ? null : Number(row.contract_total_quantity),
    isYtd: Boolean(row.is_ytd),
    isYtdPy: Boolean(row.is_ytd_py),
    isMth: Boolean(row.is_mth),
    isMthPy: Boolean(row.is_mth_py),
  }));
}

export async function getCommercialOperationsDeliveryOrderRows(
  reportingVersionId?: string,
): Promise<CommercialOperationsDeliveryOrderRow[]> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        reporting_version_id,
        CAST(report_period_month AS STRING) AS report_period_month,
        CAST(source_as_of_month AS STRING) AS source_as_of_month,
        CAST(latest_period_month AS STRING) AS latest_period_month,
        order_scope,
        channel_scope,
        business_unit_resolved,
        market_group,
        brand_name,
        canonical_product_name,
        client_requester,
        CAST(period_month AS STRING) AS period_month,
        CAST(cantidad_total_pedido AS FLOAT64) AS cantidad_total_pedido,
        CAST(cantidad_entregada AS FLOAT64) AS cantidad_entregada,
        CAST(cantidad_facturada AS FLOAT64) AS cantidad_facturada,
        CAST(fill_rate_delivered AS FLOAT64) AS fill_rate_delivered,
        CAST(fill_rate_invoiced AS FLOAT64) AS fill_rate_invoiced,
        CAST(lead_time_days AS FLOAT64) AS lead_time_days,
        CAST(amount_not_delivered AS FLOAT64) AS amount_not_delivered,
        CAST(units_not_delivered AS FLOAT64) AS units_not_delivered,
        is_ytd,
        is_ytd_py,
        is_mth,
        is_mth_py
      FROM \`${DELIVERY_ORDERS_ENRICHED_VIEW}\`
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
    orderScope: row.order_scope == null ? null : String(row.order_scope),
    channelScope: row.channel_scope == null ? null : String(row.channel_scope),
    businessUnitResolved: row.business_unit_resolved == null ? null : String(row.business_unit_resolved),
    marketGroup: row.market_group == null ? null : String(row.market_group),
    brandName: row.brand_name == null ? null : String(row.brand_name),
    canonicalProductName:
      row.canonical_product_name == null ? null : String(row.canonical_product_name),
    clientRequester: row.client_requester == null ? null : String(row.client_requester),
    periodMonth: String(row.period_month ?? ''),
    cantidadTotalPedido: Number(row.cantidad_total_pedido ?? 0),
    cantidadEntregada: Number(row.cantidad_entregada ?? 0),
    cantidadFacturada: Number(row.cantidad_facturada ?? 0),
    fillRateDelivered: row.fill_rate_delivered == null ? null : Number(row.fill_rate_delivered),
    fillRateInvoiced: row.fill_rate_invoiced == null ? null : Number(row.fill_rate_invoiced),
    leadTimeDays: row.lead_time_days == null ? null : Number(row.lead_time_days),
    amountNotDelivered: row.amount_not_delivered == null ? null : Number(row.amount_not_delivered),
    unitsNotDelivered: row.units_not_delivered == null ? null : Number(row.units_not_delivered),
    isYtd: Boolean(row.is_ytd),
    isYtdPy: Boolean(row.is_ytd_py),
    isMth: Boolean(row.is_mth),
    isMthPy: Boolean(row.is_mth_py),
  }));
}
