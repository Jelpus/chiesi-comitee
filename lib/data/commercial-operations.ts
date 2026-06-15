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

export type CommercialOperationsArAgingRow = {
  reportingVersionId: string;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  account: string | null;
  customer: string | null;
  documentNumber: string | null;
  documentDate: string | null;
  invoiceAmount: number;
  reference: string | null;
  invoiceDueDate: string | null;
  paymentGroup: string | null;
  daysPastDue: number | null;
  assignment: string | null;
  channelGroup: string;
  status: 'Expired' | 'Due to expire' | 'Other';
  agingGroup: string;
  channel: string | null;
  billingYear: number | null;
  customerGroups: string | null;
  management: string | null;
};

export type CommercialOperationsArCollectionRow = {
  reportingVersionId: string;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  sourceType: 'actual' | 'forecast';
  account: string | null;
  customer: string;
  invoiceReference: string | null;
  assignment: string | null;
  reference: string | null;
  documentNumber: string | null;
  documentDate: string | null;
  paymentDate: string | null;
  termsOfPayment: string | null;
  documentType: string;
  invoiceAmount: number;
  periodMonth: string;
  customerReference: string | null;
  clearingDocument: string | null;
  netDueDate: string | null;
  channelGroup: string;
  text: string | null;
  documentHeaderText: string | null;
  fiscalYear: number | null;
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

export type CommercialOperationsOtifRow = {
  reportingVersionId: string;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  latestPeriodMonth: string | null;
  periodMonth: string;
  orden: string | null;
  referenciaCliente: string | null;
  solicitante: string | null;
  customerDescription: string | null;
  shipToCity: string | null;
  region: string | null;
  canal: string | null;
  channelGroup: string;
  status: string | null;
  falseOtifReason: string | null;
  observacion: string | null;
  returnedPieces: number | null;
  onTimeDelivery: boolean | null;
  deliveredPieces: number | null;
  otif: boolean;
  isYtd: boolean;
  isMth: boolean;
};

export type CommercialOperationsSanctionRow = {
  reportingVersionId: string;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  latestPeriodMonth: string | null;
  periodMonth: string;
  provisionYear: number | null;
  estimatedMonthRaw: string | null;
  sanctionDate: string | null;
  orderNumber: string | null;
  documentNumber: string | null;
  contractNumber: string | null;
  clientInstitution: string | null;
  businessUnit: string | null;
  sanctionResponsible: string | null;
  channelRaw: string | null;
  channelGroup: string;
  sourceProductRaw: string | null;
  sku: string | null;
  canonicalProductName: string | null;
  marketGroup: string | null;
  brandName: string | null;
  productBusinessUnitName: string | null;
  sanctionType: string | null;
  sanctionReason: string | null;
  sanctionStatus: string | null;
  sanctionAmount: number | null;
  invoicedAmount: number | null;
  daysCount: number | null;
  observations: string | null;
  isYtd: boolean;
  isMth: boolean;
  isYtdPy: boolean;
  isMthPy: boolean;
};

const SOURCE_MODULES: Array<{ moduleCode: string; moduleLabel: string }> = [
  { moduleCode: 'commercial_operations_dso', moduleLabel: 'DSO' },
  { moduleCode: 'commercial_operations_aging', moduleLabel: 'Aging / Cobranza' },
  { moduleCode: 'commercial_operations_government_orders', moduleLabel: 'Pedidos Gobierno' },
  { moduleCode: 'commercial_operations_private_orders', moduleLabel: 'Pedidos Privado' },
  {
    moduleCode: 'commercial_operations_government_contract_progress',
    moduleLabel: 'Avances de contrato Gobierno',
  },
  { moduleCode: 'commercial_operations_stocks', moduleLabel: 'Stocks' },
  { moduleCode: 'commercial_operations_incidencias', moduleLabel: 'OTIF' },
  { moduleCode: 'commercial_operations_sanctions', moduleLabel: 'Sansiones' },
];

const DSO_ENRICHED_VIEW = 'chiesi-committee.chiesi_committee_stg.vw_commercial_operations_dso_enriched';
const AR_AGING_STAGING_TABLE = 'chiesi-committee.chiesi_committee_stg.stg_commercial_operations_ar_aging';
const AR_COLLECTION_STAGING_TABLE = 'chiesi-committee.chiesi_committee_stg.stg_commercial_operations_ar_collection';
const STOCKS_ENRICHED_VIEW = 'chiesi-committee.chiesi_committee_stg.vw_commercial_operations_stocks_enriched';
const GOVERNMENT_CONTRACT_PROGRESS_ENRICHED_VIEW =
  'chiesi-committee.chiesi_committee_stg.vw_commercial_operations_government_contract_progress_enriched';
const DELIVERY_ORDERS_ENRICHED_VIEW =
  'chiesi-committee.chiesi_committee_stg.vw_commercial_operations_delivery_orders_enriched';
const OTIF_ENRICHED_VIEW = 'chiesi-committee.chiesi_committee_stg.vw_commercial_operations_otif_enriched';
const SANCTIONS_ENRICHED_VIEW = 'chiesi-committee.chiesi_committee_stg.vw_commercial_operations_sanctions_enriched';

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

function isBigQueryNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('not found') || message.includes('not found: table');
}

export async function getCommercialOperationsArAgingRows(
  reportingVersionId?: string,
): Promise<CommercialOperationsArAgingRow[]> {
  const client = getBigQueryClient();
  let rows;
  try {
    [rows] = await client.query({
      query: `
        SELECT
          u.reporting_version_id,
          CAST(rv.period_month AS STRING) AS report_period_month,
          CAST(u.source_as_of_month AS STRING) AS source_as_of_month,
          a.account,
          a.customer,
          a.document_number,
          CAST(a.document_date AS STRING) AS document_date,
          CAST(a.invoice_amount AS FLOAT64) AS invoice_amount,
          a.reference,
          CAST(a.invoice_due_date AS STRING) AS invoice_due_date,
          a.payment_group,
          CAST(a.days_past_due AS FLOAT64) AS days_past_due,
          a.assignment,
          COALESCE(NULLIF(a.channel_group, ''), 'Unassigned') AS channel_group,
          CASE
            WHEN a.status IN ('Expired', 'Due to expire') THEN a.status
            ELSE 'Other'
          END AS status,
          COALESCE(NULLIF(a.aging_group, ''), 'Unassigned') AS aging_group,
          a.channel,
          a.billing_year,
          a.customer_groups,
          a.management
        FROM \`${AR_AGING_STAGING_TABLE}\` a
        JOIN \`chiesi-committee.chiesi_committee_raw.uploads\` u
          ON u.upload_id = a.upload_id
        LEFT JOIN \`chiesi-committee.chiesi_committee_admin.reporting_versions\` rv
          ON rv.reporting_version_id = u.reporting_version_id
        WHERE LOWER(TRIM(u.module_code)) IN ('commercial_operations_aging', 'commercial_operations_ar', 'ar')
          AND LOWER(TRIM(u.status)) IN ('normalized', 'published')
          AND (@reportingVersionId = '' OR u.reporting_version_id = @reportingVersionId)
        ORDER BY a.invoice_amount DESC
      `,
      params: {
        reportingVersionId: reportingVersionId ?? '',
      },
    });
  } catch (error) {
    if (isBigQueryNotFoundError(error)) return [];
    throw error;
  }

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    reportingVersionId: String(row.reporting_version_id ?? ''),
    reportPeriodMonth: row.report_period_month == null ? null : String(row.report_period_month),
    sourceAsOfMonth: row.source_as_of_month == null ? null : String(row.source_as_of_month),
    account: row.account == null ? null : String(row.account),
    customer: row.customer == null ? null : String(row.customer),
    documentNumber: row.document_number == null ? null : String(row.document_number),
    documentDate: row.document_date == null ? null : String(row.document_date),
    invoiceAmount: Number(row.invoice_amount ?? 0),
    reference: row.reference == null ? null : String(row.reference),
    invoiceDueDate: row.invoice_due_date == null ? null : String(row.invoice_due_date),
    paymentGroup: row.payment_group == null ? null : String(row.payment_group),
    daysPastDue: row.days_past_due == null ? null : Number(row.days_past_due),
    assignment: row.assignment == null ? null : String(row.assignment),
    channelGroup: String(row.channel_group ?? 'Unassigned'),
    status:
      row.status === 'Expired' || row.status === 'Due to expire'
        ? row.status
        : 'Other',
    agingGroup: String(row.aging_group ?? 'Unassigned'),
    channel: row.channel == null ? null : String(row.channel),
    billingYear: row.billing_year == null ? null : Number(row.billing_year),
    customerGroups: row.customer_groups == null ? null : String(row.customer_groups),
    management: row.management == null ? null : String(row.management),
  }));
}

export async function getCommercialOperationsArCollectionRows(
  reportingVersionId?: string,
): Promise<CommercialOperationsArCollectionRow[]> {
  const client = getBigQueryClient();
  let rows;
  try {
    [rows] = await client.query({
      query: `
        SELECT
          u.reporting_version_id,
          CAST(rv.period_month AS STRING) AS report_period_month,
          CAST(u.source_as_of_month AS STRING) AS source_as_of_month,
          c.source_type,
          c.account,
          COALESCE(NULLIF(c.customer, ''), 'Unassigned') AS customer,
          c.invoice_reference,
          c.assignment,
          c.reference,
          c.document_number,
          CAST(c.document_date AS STRING) AS document_date,
          CAST(c.payment_date AS STRING) AS payment_date,
          c.terms_of_payment,
          c.document_type,
          CAST(c.invoice_amount AS FLOAT64) AS invoice_amount,
          CAST(c.period_month AS STRING) AS period_month,
          c.customer_reference,
          c.clearing_document,
          CAST(c.net_due_date AS STRING) AS net_due_date,
          COALESCE(NULLIF(c.channel_group, ''), 'Unassigned') AS channel_group,
          c.text,
          c.document_header_text,
          c.fiscal_year
        FROM \`${AR_COLLECTION_STAGING_TABLE}\` c
        JOIN \`chiesi-committee.chiesi_committee_raw.uploads\` u
          ON u.upload_id = c.upload_id
        LEFT JOIN \`chiesi-committee.chiesi_committee_admin.reporting_versions\` rv
          ON rv.reporting_version_id = u.reporting_version_id
        WHERE LOWER(TRIM(u.module_code)) IN ('commercial_operations_aging', 'commercial_operations_ar', 'ar')
          AND LOWER(TRIM(u.status)) IN ('normalized', 'published')
          AND (@reportingVersionId = '' OR u.reporting_version_id = @reportingVersionId)
        ORDER BY c.period_month, c.source_type, c.invoice_amount DESC
      `,
      params: {
        reportingVersionId: reportingVersionId ?? '',
      },
    });
  } catch (error) {
    if (isBigQueryNotFoundError(error)) return [];
    throw error;
  }

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    reportingVersionId: String(row.reporting_version_id ?? ''),
    reportPeriodMonth: row.report_period_month == null ? null : String(row.report_period_month),
    sourceAsOfMonth: row.source_as_of_month == null ? null : String(row.source_as_of_month),
    sourceType: row.source_type === 'forecast' ? 'forecast' : 'actual',
    account: row.account == null ? null : String(row.account),
    customer: String(row.customer ?? 'Unassigned'),
    invoiceReference: row.invoice_reference == null ? null : String(row.invoice_reference),
    assignment: row.assignment == null ? null : String(row.assignment),
    reference: row.reference == null ? null : String(row.reference),
    documentNumber: row.document_number == null ? null : String(row.document_number),
    documentDate: row.document_date == null ? null : String(row.document_date),
    paymentDate: row.payment_date == null ? null : String(row.payment_date),
    termsOfPayment: row.terms_of_payment == null ? null : String(row.terms_of_payment),
    documentType: String(row.document_type ?? ''),
    invoiceAmount: Number(row.invoice_amount ?? 0),
    periodMonth: String(row.period_month ?? ''),
    customerReference: row.customer_reference == null ? null : String(row.customer_reference),
    clearingDocument: row.clearing_document == null ? null : String(row.clearing_document),
    netDueDate: row.net_due_date == null ? null : String(row.net_due_date),
    channelGroup: String(row.channel_group ?? 'Unassigned'),
    text: row.text == null ? null : String(row.text),
    documentHeaderText: row.document_header_text == null ? null : String(row.document_header_text),
    fiscalYear: row.fiscal_year == null ? null : Number(row.fiscal_year),
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

export async function getCommercialOperationsOtifRows(
  reportingVersionId?: string,
): Promise<CommercialOperationsOtifRow[]> {
  const client = getBigQueryClient();
  let rows;
  try {
    [rows] = await client.query({
      query: `
        SELECT
          reporting_version_id,
          CAST(report_period_month AS STRING) AS report_period_month,
          CAST(source_as_of_month AS STRING) AS source_as_of_month,
          CAST(latest_period_month AS STRING) AS latest_period_month,
          CAST(period_month AS STRING) AS period_month,
          orden,
          referencia_cliente,
          solicitante,
          customer_description,
          ship_to_city,
          region,
          canal,
          COALESCE(NULLIF(channel_group, ''), 'Other') AS channel_group,
          status,
          false_otif_reason,
          observacion,
          CAST(returned_pieces AS FLOAT64) AS returned_pieces,
          on_time_delivery,
          CAST(delivered_pieces AS FLOAT64) AS delivered_pieces,
          otif,
          is_ytd,
          is_mth
        FROM \`${OTIF_ENRICHED_VIEW}\`
        WHERE (@reportingVersionId = '' OR reporting_version_id = @reportingVersionId)
        ORDER BY period_month, orden
      `,
      params: {
        reportingVersionId: reportingVersionId ?? '',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (message.includes('not found') || message.includes('not found: table')) return [];
    throw error;
  }

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    reportingVersionId: String(row.reporting_version_id ?? ''),
    reportPeriodMonth: row.report_period_month == null ? null : String(row.report_period_month),
    sourceAsOfMonth: row.source_as_of_month == null ? null : String(row.source_as_of_month),
    latestPeriodMonth: row.latest_period_month == null ? null : String(row.latest_period_month),
    periodMonth: String(row.period_month ?? ''),
    orden: row.orden == null ? null : String(row.orden),
    referenciaCliente: row.referencia_cliente == null ? null : String(row.referencia_cliente),
    solicitante: row.solicitante == null ? null : String(row.solicitante),
    customerDescription: row.customer_description == null ? null : String(row.customer_description),
    shipToCity: row.ship_to_city == null ? null : String(row.ship_to_city),
    region: row.region == null ? null : String(row.region),
    canal: row.canal == null ? null : String(row.canal),
    channelGroup: String(row.channel_group ?? 'Other'),
    status: row.status == null ? null : String(row.status),
    falseOtifReason: row.false_otif_reason == null ? null : String(row.false_otif_reason),
    observacion: row.observacion == null ? null : String(row.observacion),
    returnedPieces: row.returned_pieces == null ? null : Number(row.returned_pieces),
    onTimeDelivery: row.on_time_delivery == null ? null : Boolean(row.on_time_delivery),
    deliveredPieces: row.delivered_pieces == null ? null : Number(row.delivered_pieces),
    otif: Boolean(row.otif),
    isYtd: Boolean(row.is_ytd),
    isMth: Boolean(row.is_mth),
  }));
}

export async function getCommercialOperationsSanctionRows(
  reportingVersionId?: string,
): Promise<CommercialOperationsSanctionRow[]> {
  const client = getBigQueryClient();
  let rows;
  try {
    [rows] = await client.query({
      query: `
        SELECT
          reporting_version_id,
          CAST(report_period_month AS STRING) AS report_period_month,
          CAST(source_as_of_month AS STRING) AS source_as_of_month,
          CAST(latest_period_month AS STRING) AS latest_period_month,
          CAST(period_month AS STRING) AS period_month,
          provision_year,
          estimated_month_raw,
          CAST(sanction_date AS STRING) AS sanction_date,
          order_number,
          document_number,
          contract_number,
          client_institution,
          business_unit,
          sanction_responsible,
          channel_raw,
          COALESCE(NULLIF(channel_group, ''), 'Other') AS channel_group,
          source_product_raw,
          sku,
          canonical_product_name,
          market_group,
          brand_name,
          product_business_unit_name,
          sanction_type,
          sanction_reason,
          sanction_status,
          CAST(sanction_amount AS FLOAT64) AS sanction_amount,
          CAST(invoiced_amount AS FLOAT64) AS invoiced_amount,
          CAST(days_count AS FLOAT64) AS days_count,
          observations,
          is_ytd,
          is_mth,
          is_ytd_py,
          is_mth_py
        FROM \`${SANCTIONS_ENRICHED_VIEW}\`
        WHERE (@reportingVersionId = '' OR reporting_version_id = @reportingVersionId) AND
        estimated_month_raw IS NOT NULL AND sanction_amount IS NOT NULL AND sanction_amount > 0 AND
        estimated_month_raw != ''
        ORDER BY period_month, sanction_amount DESC
      `,
      params: {
        reportingVersionId: reportingVersionId ?? '',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (message.includes('not found') || message.includes('not found: table')) return [];
    throw error;
  }

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    reportingVersionId: String(row.reporting_version_id ?? ''),
    reportPeriodMonth: row.report_period_month == null ? null : String(row.report_period_month),
    sourceAsOfMonth: row.source_as_of_month == null ? null : String(row.source_as_of_month),
    latestPeriodMonth: row.latest_period_month == null ? null : String(row.latest_period_month),
    periodMonth: String(row.period_month ?? ''),
    provisionYear: row.provision_year == null ? null : Number(row.provision_year),
    estimatedMonthRaw: row.estimated_month_raw == null ? null : String(row.estimated_month_raw),
    sanctionDate: row.sanction_date == null ? null : String(row.sanction_date),
    orderNumber: row.order_number == null ? null : String(row.order_number),
    documentNumber: row.document_number == null ? null : String(row.document_number),
    contractNumber: row.contract_number == null ? null : String(row.contract_number),
    clientInstitution: row.client_institution == null ? null : String(row.client_institution),
    businessUnit: row.business_unit == null ? null : String(row.business_unit),
    sanctionResponsible: row.sanction_responsible == null ? null : String(row.sanction_responsible),
    channelRaw: row.channel_raw == null ? null : String(row.channel_raw),
    channelGroup: String(row.channel_group ?? 'Other'),
    sourceProductRaw: row.source_product_raw == null ? null : String(row.source_product_raw),
    sku: row.sku == null ? null : String(row.sku),
    canonicalProductName: row.canonical_product_name == null ? null : String(row.canonical_product_name),
    marketGroup: row.market_group == null ? null : String(row.market_group),
    brandName: row.brand_name == null ? null : String(row.brand_name),
    productBusinessUnitName: row.product_business_unit_name == null ? null : String(row.product_business_unit_name),
    sanctionType: row.sanction_type == null ? null : String(row.sanction_type),
    sanctionReason: row.sanction_reason == null ? null : String(row.sanction_reason),
    sanctionStatus: row.sanction_status == null ? null : String(row.sanction_status),
    sanctionAmount: row.sanction_amount == null ? null : Number(row.sanction_amount),
    invoicedAmount: row.invoiced_amount == null ? null : Number(row.invoiced_amount),
    daysCount: row.days_count == null ? null : Number(row.days_count),
    observations: row.observations == null ? null : String(row.observations),
    isYtd: Boolean(row.is_ytd),
    isMth: Boolean(row.is_mth),
    isYtdPy: Boolean(row.is_ytd_py),
    isMthPy: Boolean(row.is_mth_py),
  }));
}
