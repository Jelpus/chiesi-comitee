import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import type {
  SalesInternalBudgetDualKpis,
  SalesInternalBudgetBrandBreakdownRow,
  SalesInternalBudgetChannelPerformanceRow,
  SalesInternalBudgetBreakdownRow,
  SalesInternalBudgetMonthlyRow,
  SalesInternalBudgetMetricComparison,
  SalesInternalBudgetKpis,
  SalesInternalBudgetProductVarianceRow,
  SalesInternalBreakdownRow,
  SalesInternalComparisonContext,
  SalesInternalDualKpis,
  SalesInternalDualKpisYoY,
  SalesInternalFilterOptions,
  SalesInternalFilters,
  SalesInternalKpis,
  SalesInternalProductRow,
  SalesInternalSummaryRow,
  SalesInternalTrendYoY,
  SalesInternalTopProductRow,
} from '@/types/sales-internal';

const SALES_INTERNAL_DATASET =
  process.env.SALES_INTERNAL_DATASET ?? 'chiesi_committee_serving';
const SALES_INTERNAL_VIEW_PROJECT =
  process.env.SALES_INTERNAL_VIEW_PROJECT ?? 'chiesi-committee';

const SUMMARY_VIEW =
  `${SALES_INTERNAL_VIEW_PROJECT}.${SALES_INTERNAL_DATASET}.vw_sales_internal_summary`;
const PRODUCT_VIEW =
  `${SALES_INTERNAL_VIEW_PROJECT}.${SALES_INTERNAL_DATASET}.vw_sales_internal_product_month_active`;
const BUDGET_VIEW =
  'chiesi-committee.chiesi_committee_mart.vw_sales_internal_product_month_vs_budget';

function applyCommonFilters(filters: SalesInternalFilters) {
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (filters.periodMonth) {
    conditions.push('period_month = DATE(@periodMonth)');
    params.periodMonth = filters.periodMonth;
  }

  if (filters.bu) {
    conditions.push('bu = @bu');
    params.bu = filters.bu;
  }

  if (filters.channel) {
    conditions.push('channel = @channel');
    params.channel = filters.channel;
  }

  if (filters.distributionChannel) {
    conditions.push('distribution_channel = @distributionChannel');
    params.distributionChannel = filters.distributionChannel;
  }

  if (filters.salesGroup) {
    conditions.push('sales_group = @salesGroup');
    params.salesGroup = filters.salesGroup;
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

function isMissingSalesGroupError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /Unrecognized name:\s*sales_group/i.test(error.message);
}

function removeSalesGroupFilter(
  whereClause: string,
  params: Record<string, string>,
): { whereClause: string; params: Record<string, string> } {
  const conditions = whereClause
    .replace(/^WHERE\s+/i, '')
    .split(/\s+AND\s+/i)
    .map((condition) => condition.trim())
    .filter((condition) => condition.length > 0 && !/sales_group\s*=\s*@salesGroup/i.test(condition));

  const nextParams = { ...params };
  delete nextParams.salesGroup;

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params: nextParams,
  };
}

function normalizeSalesGroup(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const NET_SALES_GROUP_NORMALIZED = normalizeSalesGroup(
  process.env.SALES_GROUP_NET_LABEL ?? 'Net Sales',
);
const UNITS_GROUP_NORMALIZED = normalizeSalesGroup(
  process.env.SALES_GROUP_UNITS_LABEL ?? 'Units',
);

function mapSalesGroupToMetric(groupRaw: string | null | undefined): 'net' | 'units' | 'unknown' {
  const group = normalizeSalesGroup(groupRaw);
  if (group === UNITS_GROUP_NORMALIZED) return 'units';
  if (group === NET_SALES_GROUP_NORMALIZED) return 'net';
  return 'unknown';
}

function applyContextFilters(
  filters: SalesInternalFilters,
  options: { includeSalesGroup: boolean },
) {
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (filters.bu) {
    conditions.push('bu = @bu');
    params.bu = filters.bu;
  }

  if (filters.channel) {
    conditions.push('channel = @channel');
    params.channel = filters.channel;
  }

  if (filters.distributionChannel) {
    conditions.push('distribution_channel = @distributionChannel');
    params.distributionChannel = filters.distributionChannel;
  }

  if (options.includeSalesGroup && filters.salesGroup) {
    conditions.push('sales_group = @salesGroup');
    params.salesGroup = filters.salesGroup;
  }

  if (filters.productId) {
    conditions.push('product_id = @productId');
    params.productId = filters.productId;
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

function buildComparisonRangeWhere(
  baseWhereClause: string,
  analysisYear: number,
  lyYear: number,
  cutoffMonth: number,
) {
  const comparisonParts = [
    `EXTRACT(YEAR FROM period_month) IN (${analysisYear}, ${lyYear})`,
    `EXTRACT(MONTH FROM period_month) <= ${cutoffMonth}`,
  ];

  if (!baseWhereClause) {
    return `WHERE ${comparisonParts.join(' AND ')}`;
  }

  return `${baseWhereClause} AND ${comparisonParts.join(' AND ')}`;
}

function appendWhereCondition(whereClause: string, condition: string) {
  if (!whereClause) return `WHERE ${condition}`;
  return `${whereClause} AND ${condition}`;
}

function ytdWindowCondition(analysisYear: number, cutoffMonth: number) {
  return `EXTRACT(YEAR FROM period_month) = ${analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${cutoffMonth}`;
}

function computeKpiComparison(actual: number, ly: number | null) {
  if (ly === null) {
    return { actual, ly: null, delta: null, deltaPct: null };
  }

  const delta = actual - ly;
  const deltaPct = ly === 0 ? null : (delta / ly) * 100;

  return {
    actual,
    ly,
    delta,
    deltaPct,
  };
}

function monthLabel(month: number) {
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return labels[month - 1] ?? String(month);
}

function buildBudgetFilters(filters: SalesInternalFilters) {
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (filters.bu) {
    conditions.push('bu = @bu');
    params.bu = filters.bu;
  }

  if (filters.salesGroup) {
    conditions.push('sales_group = @salesGroup');
    params.salesGroup = filters.salesGroup;
  }

  if (filters.channel) {
    conditions.push('channel = @channel');
    params.channel = filters.channel;
  }

  if (filters.productId) {
    conditions.push('product_id = @productId');
    params.productId = filters.productId;
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

export async function getSalesInternalBudgetChannelBreakdown(
  filters: SalesInternalFilters = {},
): Promise<SalesInternalBudgetBreakdownRow[]> {
  const client = getBigQueryClient();
  const budgetContext = await getBudgetContext(filters);
  if (!budgetContext.analysisYear || !budgetContext.cutoffMonth) {
    return [];
  }

  const budgetFilters = buildBudgetFilters(filters);
  const whereClause = budgetFilters.whereClause
    ? `${budgetFilters.whereClause} AND EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`
    : `WHERE EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`;

  const query = `
    SELECT
      channel AS label,
      SUM(budget_value) AS budget_value
    FROM \`${BUDGET_VIEW}\`
    ${whereClause}
    GROUP BY channel
    ORDER BY budget_value DESC
  `;

  const [rows] = await client.query({
    query,
    params: budgetFilters.params,
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    label: String(row.label ?? '-'),
    budgetValue: Number(row.budget_value ?? 0),
  }));
}

export async function getSalesInternalBudgetChannelPerformance(
  filters: SalesInternalFilters = {},
): Promise<SalesInternalBudgetChannelPerformanceRow[]> {
  const client = getBigQueryClient();
  const budgetContext = await getBudgetContext(filters);
  if (!budgetContext.analysisYear || !budgetContext.cutoffMonth) {
    return [];
  }

  const actualFilters = applyContextFilters(filters, { includeSalesGroup: true });
  const budgetFilters = buildBudgetFilters(filters);

  const actualWhereClause = actualFilters.whereClause
    ? `${actualFilters.whereClause} AND EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`
    : `WHERE EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`;

  const budgetWhereClause = budgetFilters.whereClause
    ? `${budgetFilters.whereClause} AND EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`
    : `WHERE EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`;

  const query = `
    WITH actual_by_channel AS (
      SELECT
        channel AS label,
        SUM(actual_value) AS actual_value
      FROM \`${PRODUCT_VIEW}\`
      ${actualWhereClause}
      GROUP BY label
    ),
    budget_by_channel AS (
      SELECT
        channel AS label,
        SUM(budget_value) AS budget_value
      FROM \`${BUDGET_VIEW}\`
      ${budgetWhereClause}
      GROUP BY label
    )
    SELECT
      COALESCE(a.label, b.label) AS label,
      COALESCE(a.actual_value, 0) AS actual_value,
      COALESCE(b.budget_value, 0) AS budget_value,
      COALESCE(a.actual_value, 0) - COALESCE(b.budget_value, 0) AS variance_value
    FROM actual_by_channel a
    FULL OUTER JOIN budget_by_channel b
      ON a.label = b.label
    ORDER BY actual_value DESC
  `;

  const [rows] = await client.query({
    query,
    params: {
      ...actualFilters.params,
      ...budgetFilters.params,
    },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    label: String(row.label ?? '-'),
    actualValue: Number(row.actual_value ?? 0),
    budgetValue: Number(row.budget_value ?? 0),
    varianceValue: Number(row.variance_value ?? 0),
  }));
}

export async function getSalesInternalBudgetBuBreakdown(
  filters: SalesInternalFilters = {},
): Promise<SalesInternalBudgetBreakdownRow[]> {
  const client = getBigQueryClient();
  const budgetContext = await getBudgetContext(filters);
  if (!budgetContext.analysisYear || !budgetContext.cutoffMonth) {
    return [];
  }

  const budgetFilters = buildBudgetFilters(filters);
  const whereClause = budgetFilters.whereClause
    ? `${budgetFilters.whereClause} AND EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`
    : `WHERE EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`;

  const query = `
    SELECT
      bu AS label,
      SUM(budget_value) AS budget_value
    FROM \`${BUDGET_VIEW}\`
    ${whereClause}
    GROUP BY bu
    ORDER BY budget_value DESC
  `;

  const [rows] = await client.query({
    query,
    params: budgetFilters.params,
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    label: String(row.label ?? '-'),
    budgetValue: Number(row.budget_value ?? 0),
  }));
}

export async function getSalesInternalBudgetBrandBreakdown(
  filters: SalesInternalFilters = {},
): Promise<SalesInternalBudgetBrandBreakdownRow[]> {
  const client = getBigQueryClient();
  const budgetContext = await getBudgetContext(filters);
  if (!budgetContext.analysisYear || !budgetContext.cutoffMonth) {
    return [];
  }

  const budgetFilters = buildBudgetFilters(filters);
  const actualFilters = applyContextFilters(filters, { includeSalesGroup: true });

  const actualWhereClause = actualFilters.whereClause
    ? `${actualFilters.whereClause} AND EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`
    : `WHERE EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`;

  const budgetWhereClause = budgetFilters.whereClause
    ? `${budgetFilters.whereClause} AND EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`
    : `WHERE EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`;

  const query = `
    WITH product_metadata_dedup AS (
      SELECT product_id, brand_name
      FROM (
        SELECT
          pm.*,
          ROW_NUMBER() OVER (
            PARTITION BY pm.product_id
            ORDER BY pm.updated_at DESC, pm.created_at DESC
          ) AS rn
        FROM \`chiesi-committee.chiesi_committee_admin.product_metadata\` pm
      )
      WHERE rn = 1
    ),
    actual_by_brand AS (
      SELECT
        COALESCE(NULLIF(pm.brand_name, ''), 'Brand (Not Classified)') AS label,
        SUM(v.actual_value) AS actual_value
      FROM \`${PRODUCT_VIEW}\` v
      LEFT JOIN product_metadata_dedup pm
        ON pm.product_id = v.product_id
      ${actualWhereClause}
      GROUP BY label
    ),
    budget_by_brand AS (
      SELECT
        COALESCE(NULLIF(pm.brand_name, ''), 'Brand (Not Classified)') AS label,
        SUM(v.budget_value) AS budget_value
      FROM \`${BUDGET_VIEW}\` v
      LEFT JOIN product_metadata_dedup pm
        ON pm.product_id = v.product_id
      ${budgetWhereClause}
      GROUP BY label
    )
    SELECT
      COALESCE(a.label, b.label) AS label,
      COALESCE(a.actual_value, 0) AS actual_value,
      COALESCE(b.budget_value, 0) AS budget_value,
      COALESCE(a.actual_value, 0) - COALESCE(b.budget_value, 0) AS variance_value
    FROM actual_by_brand a
    FULL OUTER JOIN budget_by_brand b
      ON a.label = b.label
    ORDER BY actual_value DESC
  `;

  const [rows] = await client.query({
    query,
    params: {
      ...actualFilters.params,
      ...budgetFilters.params,
    },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    label: String(row.label ?? 'Brand (Not Classified)'),
    actualValue: Number(row.actual_value ?? 0),
    budgetValue: Number(row.budget_value ?? 0),
    varianceValue: Number(row.variance_value ?? 0),
  }));
}

export async function getSalesInternalBudgetMonthly(
  filters: SalesInternalFilters = {},
): Promise<SalesInternalBudgetMonthlyRow[]> {
  const client = getBigQueryClient();
  const budgetContext = await getBudgetContext(filters);
  if (!budgetContext.analysisYear || !budgetContext.cutoffMonth) {
    return [];
  }

  const budgetFilters = buildBudgetFilters(filters);
  const whereClause = budgetFilters.whereClause
    ? `${budgetFilters.whereClause} AND EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`
    : `WHERE EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`;

  const query = `
    SELECT
      CAST(period_month AS STRING) AS period_month,
      product_id,
      ANY_VALUE(bu) AS bu,
      ANY_VALUE(channel) AS channel,
      SUM(budget_value) AS budget_value
    FROM \`${BUDGET_VIEW}\`
    ${whereClause}
    GROUP BY period_month, product_id
  `;

  const [rows] = await client.query({
    query,
    params: budgetFilters.params,
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    periodMonth: String(row.period_month ?? ''),
    productId: String(row.product_id ?? ''),
    bu: String(row.bu ?? ''),
    channel: String(row.channel ?? ''),
    budgetValue: Number(row.budget_value ?? 0),
  }));
}

async function getBudgetContext(filters: SalesInternalFilters): Promise<{
  analysisYear: number | null;
  cutoffMonth: number | null;
}> {
  const comparisonContext = await getComparisonContext(filters, { includeSalesGroup: true });
  return {
    analysisYear: comparisonContext.analysisYear,
    cutoffMonth: comparisonContext.cutoffMonth,
  };
}

async function getComparisonContext(
  filters: SalesInternalFilters,
  options: { includeSalesGroup: boolean },
): Promise<SalesInternalComparisonContext> {
  const client = getBigQueryClient();
  const contextFilters = applyContextFilters(filters, options);

  const analysisYearQuery = `
    SELECT MAX(EXTRACT(YEAR FROM period_month)) AS analysis_year
    FROM \`${PRODUCT_VIEW}\`
    ${contextFilters.whereClause}
  `;

  const [analysisRows] = await client.query({
    query: analysisYearQuery,
    params: contextFilters.params,
  });
  const analysisYear = Number(
    ((analysisRows as Array<{ analysis_year?: number | null }>)[0]?.analysis_year ?? 0),
  );
  if (!analysisYear) {
    return {
      analysisYear: null,
      lyYear: null,
      cutoffMonth: null,
      hasLyData: false,
    };
  }

  const lyYear = analysisYear - 1;
  const cutoffQuery = `
    SELECT MAX(EXTRACT(MONTH FROM period_month)) AS cutoff_month
    FROM \`${PRODUCT_VIEW}\`
    ${contextFilters.whereClause ? `${contextFilters.whereClause} AND` : 'WHERE'}
    EXTRACT(YEAR FROM period_month) = ${analysisYear}
  `;
  const [cutoffRows] = await client.query({
    query: cutoffQuery,
    params: contextFilters.params,
  });
  const cutoffMonth = Number(
    ((cutoffRows as Array<{ cutoff_month?: number | null }>)[0]?.cutoff_month ?? 0),
  );
  if (!cutoffMonth) {
    return {
      analysisYear,
      lyYear,
      cutoffMonth: null,
      hasLyData: false,
    };
  }

  const lyExistsQuery = `
    SELECT COUNT(1) AS ly_rows
    FROM \`${PRODUCT_VIEW}\`
    ${contextFilters.whereClause ? `${contextFilters.whereClause} AND` : 'WHERE'}
    EXTRACT(YEAR FROM period_month) = ${lyYear}
    AND EXTRACT(MONTH FROM period_month) <= ${cutoffMonth}
  `;
  const [lyRows] = await client.query({
    query: lyExistsQuery,
    params: contextFilters.params,
  });
  const lyCount = Number(((lyRows as Array<{ ly_rows?: number | null }>)[0]?.ly_rows ?? 0));

  return {
    analysisYear,
    lyYear,
    cutoffMonth,
    hasLyData: lyCount > 0,
  };
}

export async function getSalesInternalSummary(
  filters: SalesInternalFilters = {},
): Promise<SalesInternalSummaryRow[]> {
  const client = getBigQueryClient();
  const { whereClause, params } = applyCommonFilters(filters);
  const withoutSalesGroup = removeSalesGroupFilter(whereClause, params);

  const queryWithSalesGroup = `
    SELECT
      CAST(period_month AS STRING) AS period_month,
      bu,
      channel,
      distribution_channel,
      distribution_channel_name,
      COALESCE(sales_group, 'unknown') AS sales_group,
      actual_value,
      row_count,
      customer_count,
      CAST(last_normalized_at AS STRING) AS last_normalized_at
    FROM \`${SUMMARY_VIEW}\`
    ${whereClause}
    ORDER BY period_month DESC, actual_value DESC
  `;

  try {
    const [rows] = await client.query({ query: queryWithSalesGroup, params });
    return (rows as Record<string, unknown>[]).map((row) => ({
      periodMonth: String(row.period_month ?? ''),
      bu: String(row.bu ?? ''),
      channel: String(row.channel ?? ''),
      distributionChannel: String(row.distribution_channel ?? ''),
      distributionChannelName: String(row.distribution_channel_name ?? ''),
      salesGroup: String(row.sales_group ?? ''),
      actualValue: Number(row.actual_value ?? 0),
      rowCount: Number(row.row_count ?? 0),
      customerCount: Number(row.customer_count ?? 0),
      lastNormalizedAt: row.last_normalized_at ? String(row.last_normalized_at) : null,
    }));
  } catch (error) {
    const fallbackFilter = isMissingSalesGroupError(error)
      ? withoutSalesGroup
      : { whereClause, params };
    const fallbackQuery = `
      SELECT
        CAST(period_month AS STRING) AS period_month,
        bu,
        channel,
        distribution_channel,
        distribution_channel_name,
        actual_value,
        row_count,
        customer_count,
        CAST(last_normalized_at AS STRING) AS last_normalized_at
      FROM \`${SUMMARY_VIEW}\`
      ${fallbackFilter.whereClause}
      ORDER BY period_month DESC, actual_value DESC
    `;
    const [rows] = await client.query({ query: fallbackQuery, params: fallbackFilter.params });
    return (rows as Record<string, unknown>[]).map((row) => ({
      periodMonth: String(row.period_month ?? ''),
      bu: String(row.bu ?? ''),
      channel: String(row.channel ?? ''),
      distributionChannel: String(row.distribution_channel ?? ''),
      distributionChannelName: String(row.distribution_channel_name ?? ''),
      salesGroup: 'all',
      actualValue: Number(row.actual_value ?? 0),
      rowCount: Number(row.row_count ?? 0),
      customerCount: Number(row.customer_count ?? 0),
      lastNormalizedAt: row.last_normalized_at ? String(row.last_normalized_at) : null,
    }));
  }
}

export async function getSalesInternalProductDetail(
  filters: SalesInternalFilters = {},
  limit = 200,
): Promise<SalesInternalProductRow[]> {
  const client = getBigQueryClient();
  const { whereClause, params } = applyCommonFilters(filters);

  const detailFilters: string[] = [];
  const detailParams: Record<string, string | number> = { ...params, limit };

  if (whereClause) {
    detailFilters.push(whereClause.replace(/^WHERE\s+/i, ''));
  }

  if (filters.productId) {
    detailFilters.push('product_id = @productId');
    detailParams.productId = filters.productId;
  }

  if (!filters.periodMonth) {
    const context = await getComparisonContext(filters, { includeSalesGroup: true });
    if (context.analysisYear && context.lyYear && context.cutoffMonth) {
      detailFilters.push(
        `EXTRACT(YEAR FROM period_month) IN (${context.analysisYear}, ${context.lyYear}) AND EXTRACT(MONTH FROM period_month) <= ${context.cutoffMonth}`,
      );
    }
  }

  const finalWhereClause =
    detailFilters.length > 0 ? `WHERE ${detailFilters.join(' AND ')}` : '';

  const queryWithSalesGroup = `
    SELECT
      CAST(period_month AS STRING) AS period_month,
      bu,
      channel,
      distribution_channel,
      distribution_channel_name,
      COALESCE(sales_group, 'unknown') AS sales_group,
      product_id,
      canonical_product_code,
      canonical_product_name,
      actual_value,
      row_count,
      customer_count
    FROM \`${PRODUCT_VIEW}\`
    ${finalWhereClause}
    ORDER BY period_month DESC, actual_value DESC
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({
      query: queryWithSalesGroup,
      params: detailParams,
    });

    return (rows as Record<string, unknown>[]).map((row) => ({
      periodMonth: String(row.period_month ?? ''),
      bu: String(row.bu ?? ''),
      channel: String(row.channel ?? ''),
      distributionChannel: String(row.distribution_channel ?? ''),
      distributionChannelName: String(row.distribution_channel_name ?? ''),
      salesGroup: String(row.sales_group ?? ''),
      productId: String(row.product_id ?? ''),
      canonicalProductCode: String(row.canonical_product_code ?? ''),
      canonicalProductName: String(row.canonical_product_name ?? ''),
      actualValue: Number(row.actual_value ?? 0),
      rowCount: Number(row.row_count ?? 0),
      customerCount: Number(row.customer_count ?? 0),
    }));
  } catch {
    const fallbackQuery = `
      SELECT
        CAST(period_month AS STRING) AS period_month,
        bu,
        channel,
        distribution_channel,
        distribution_channel_name,
        product_id,
        canonical_product_code,
        canonical_product_name,
        actual_value,
        row_count,
        customer_count
      FROM \`${PRODUCT_VIEW}\`
      ${finalWhereClause}
      ORDER BY period_month DESC, actual_value DESC
      LIMIT @limit
    `;
    const [rows] = await client.query({
      query: fallbackQuery,
      params: detailParams,
    });
    return (rows as Record<string, unknown>[]).map((row) => ({
      periodMonth: String(row.period_month ?? ''),
      bu: String(row.bu ?? ''),
      channel: String(row.channel ?? ''),
      distributionChannel: String(row.distribution_channel ?? ''),
      distributionChannelName: String(row.distribution_channel_name ?? ''),
      salesGroup: 'all',
      productId: String(row.product_id ?? ''),
      canonicalProductCode: String(row.canonical_product_code ?? ''),
      canonicalProductName: String(row.canonical_product_name ?? ''),
      actualValue: Number(row.actual_value ?? 0),
      rowCount: Number(row.row_count ?? 0),
      customerCount: Number(row.customer_count ?? 0),
    }));
  }
}

export async function getSalesInternalFilterOptions(): Promise<SalesInternalFilterOptions> {
  const client = getBigQueryClient();
  const query = `
    SELECT
      CAST(period_month AS STRING) AS period_month,
      bu,
      channel,
      distribution_channel,
      distribution_channel_name,
      COALESCE(sales_group, 'unknown') AS sales_group
    FROM \`${SUMMARY_VIEW}\`
  `;

  let rows: unknown[] = [];
  try {
    [rows] = await client.query({ query });
  } catch {
    const fallbackQuery = `
      SELECT
        CAST(period_month AS STRING) AS period_month,
        bu,
        channel,
        distribution_channel,
        distribution_channel_name
      FROM \`${SUMMARY_VIEW}\`
    `;
    [rows] = await client.query({ query: fallbackQuery });
  }
  const typedRows = rows as Array<{
    period_month: string | null;
    bu: string | null;
    channel: string | null;
    distribution_channel: string | null;
    distribution_channel_name: string | null;
    sales_group?: string | null;
  }>;

  const periods = new Set<string>();
  const bus = new Set<string>();
  const channels = new Set<string>();
  const distributionMap = new Map<string, { label: string; channel: string }>();
  const salesGroups = new Set<string>();
  const businessUnitMap = new Map<string, string>();

  for (const row of typedRows) {
    if (row.period_month) periods.add(row.period_month);
    if (row.bu) bus.add(row.bu);
    if (row.channel) channels.add(row.channel);
    if (row.distribution_channel && row.channel) {
      distributionMap.set(
        row.distribution_channel,
        {
          label: row.distribution_channel_name ?? row.distribution_channel,
          channel: row.channel,
        },
      );
    }
    if (row.sales_group) {
      salesGroups.add(row.sales_group);
    }
  }

  try {
    const [businessUnitRows] = await client.query({
      query: `
        SELECT
          v.bu AS bu_code,
          ANY_VALUE(pm.business_unit_name) AS business_unit_name
        FROM \`${PRODUCT_VIEW}\` AS v
        LEFT JOIN \`chiesi-committee.chiesi_committee_admin.product_metadata\` AS pm
          ON pm.product_id = v.product_id
        GROUP BY v.bu
      `,
    });

    for (const row of businessUnitRows as Array<{ bu_code?: string | null; business_unit_name?: string | null }>) {
      const code = (row.bu_code ?? '').trim();
      if (!code) continue;
      const label = (row.business_unit_name ?? '').trim() || code;
      businessUnitMap.set(code, label);
    }
  } catch {
    // No-op fallback to BU code labels.
  }

  for (const code of bus) {
    if (!businessUnitMap.has(code)) {
      businessUnitMap.set(code, code);
    }
  }

  try {
    const [salesGroupRows] = await client.query({
      query: `
        SELECT DISTINCT COALESCE(sales_group, 'unknown') AS sales_group
        FROM \`${PRODUCT_VIEW}\`
        ORDER BY sales_group
      `,
    });
    for (const row of salesGroupRows as Array<{ sales_group?: string | null }>) {
      if (row.sales_group) {
        salesGroups.add(row.sales_group);
      }
    }
  } catch {
    // No-op: fallback to options extracted from summary view.
  }

  return {
    periods: [...periods].sort((a, b) => b.localeCompare(a)),
    bus: [...bus].sort(),
    businessUnits: [...businessUnitMap.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    channels: [...channels].sort(),
    distributionChannels: [...distributionMap.entries()]
      .map(([value, meta]) => ({ value, label: meta.label, channel: meta.channel }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    salesGroups: [...salesGroups].sort(),
  };
}

export async function getSalesInternalKpis(
  filters: SalesInternalFilters = {},
): Promise<SalesInternalKpis> {
  const client = getBigQueryClient();
  const baseFilters = applyCommonFilters(filters);
  let whereClause = baseFilters.whereClause;
  const params = baseFilters.params;
  if (!filters.periodMonth) {
    const context = await getComparisonContext(filters, { includeSalesGroup: true });
    if (context.analysisYear && context.cutoffMonth) {
      whereClause = appendWhereCondition(
        whereClause,
        ytdWindowCondition(context.analysisYear, context.cutoffMonth),
      );
    }
  }
  const withoutSalesGroup = removeSalesGroupFilter(whereClause, params);

  const query = `
    SELECT
      SUM(actual_value) AS total_actual_value
    FROM \`${SUMMARY_VIEW}\`
    ${whereClause}
  `;

  let row: Record<string, unknown>;
  try {
    const [rows] = await client.query({ query, params });
    row = (rows as Record<string, unknown>[])[0] ?? {};
  } catch (error) {
    if (!isMissingSalesGroupError(error)) {
      throw error;
    }
    const fallbackQuery = `
      SELECT
        SUM(actual_value) AS total_actual_value
      FROM \`${SUMMARY_VIEW}\`
      ${withoutSalesGroup.whereClause}
    `;
    const [rows] = await client.query({
      query: fallbackQuery,
      params: withoutSalesGroup.params,
    });
    row = (rows as Record<string, unknown>[])[0] ?? {};
  }

  return {
    totalActualValue: Number(row.total_actual_value ?? 0),
  };
}

export async function getSalesInternalDualKpis(
  filters: SalesInternalFilters = {},
): Promise<SalesInternalDualKpis> {
  const client = getBigQueryClient();
  const { whereClause, params } = applyCommonFilters(filters);
  const withoutSalesGroup = removeSalesGroupFilter(whereClause, params);

  const summaryQuery = `
    SELECT
      COALESCE(sales_group, 'unknown') AS sales_group,
      SUM(actual_value) AS total_actual_value
    FROM \`${SUMMARY_VIEW}\`
    ${withoutSalesGroup.whereClause}
    GROUP BY sales_group
  `;

  let rows: Array<{ sales_group?: string | null; total_actual_value?: number | null }> = [];
  try {
    const [result] = await client.query({
      query: summaryQuery,
      params: withoutSalesGroup.params,
    });
    rows = result as Array<{ sales_group?: string | null; total_actual_value?: number | null }>;
  } catch (error) {
    if (!isMissingSalesGroupError(error)) {
      throw error;
    }
    const productQuery = `
      SELECT
        COALESCE(sales_group, 'unknown') AS sales_group,
        SUM(actual_value) AS total_actual_value
      FROM \`${PRODUCT_VIEW}\`
      ${withoutSalesGroup.whereClause}
      GROUP BY sales_group
    `;
    const [result] = await client.query({
      query: productQuery,
      params: withoutSalesGroup.params,
    });
    rows = result as Array<{ sales_group?: string | null; total_actual_value?: number | null }>;
  }

  let netSalesTotal = 0;
  let unitsTotal = 0;
  for (const row of rows) {
    const metric = mapSalesGroupToMetric(row.sales_group);
    const value = Number(row.total_actual_value ?? 0);
    if (metric === 'units') {
      unitsTotal += value;
      continue;
    }
    if (metric === 'net') {
      netSalesTotal += value;
    }
  }

  return { netSalesTotal, unitsTotal };
}

export async function getSalesInternalDualKpisYoY(
  filters: SalesInternalFilters = {},
): Promise<SalesInternalDualKpisYoY> {
  const context = await getComparisonContext(filters, { includeSalesGroup: false });
  if (!context.analysisYear || !context.lyYear || !context.cutoffMonth) {
    return {
      context,
      netSales: computeKpiComparison(0, null),
      units: computeKpiComparison(0, null),
    };
  }

  const client = getBigQueryClient();
  const baseFilters = applyContextFilters(filters, { includeSalesGroup: false });
  const whereClause = buildComparisonRangeWhere(
    baseFilters.whereClause,
    context.analysisYear,
    context.lyYear,
    context.cutoffMonth,
  );
  const query = `
    SELECT
      EXTRACT(YEAR FROM period_month) AS year_value,
      COALESCE(sales_group, 'unknown') AS sales_group,
      SUM(actual_value) AS total_actual_value
    FROM \`${PRODUCT_VIEW}\`
    ${whereClause}
    GROUP BY year_value, sales_group
  `;

  const [rows] = await client.query({
    query,
    params: baseFilters.params,
  });

  let netActual = 0;
  let netLy = 0;
  let unitsActual = 0;
  let unitsLy = 0;

  for (const row of rows as Array<{ year_value?: number | null; sales_group?: string | null; total_actual_value?: number | null }>) {
    const yearValue = Number(row.year_value ?? 0);
    const value = Number(row.total_actual_value ?? 0);
    const metric = mapSalesGroupToMetric(row.sales_group);

    if (metric === 'units') {
      if (yearValue === context.analysisYear) unitsActual += value;
      if (yearValue === context.lyYear) unitsLy += value;
      continue;
    }

    if (metric === 'net') {
      if (yearValue === context.analysisYear) netActual += value;
      if (yearValue === context.lyYear) netLy += value;
    }
  }

  return {
    context,
    netSales: computeKpiComparison(netActual, context.hasLyData ? netLy : null),
    units: computeKpiComparison(unitsActual, context.hasLyData ? unitsLy : null),
  };
}

export async function getSalesInternalTrendYoY(
  filters: SalesInternalFilters = {},
): Promise<SalesInternalTrendYoY> {
  const context = await getComparisonContext(filters, { includeSalesGroup: true });
  if (!context.analysisYear || !context.lyYear || !context.cutoffMonth) {
    return { context, points: [] };
  }

  const client = getBigQueryClient();
  const baseFilters = applyContextFilters(filters, { includeSalesGroup: true });
  const whereClause = buildComparisonRangeWhere(
    baseFilters.whereClause,
    context.analysisYear,
    context.lyYear,
    context.cutoffMonth,
  );

  const query = `
    SELECT
      EXTRACT(YEAR FROM period_month) AS year_value,
      EXTRACT(MONTH FROM period_month) AS month_value,
      SUM(actual_value) AS total_actual_value
    FROM \`${PRODUCT_VIEW}\`
    ${whereClause}
    GROUP BY year_value, month_value
  `;

  const [rows] = await client.query({
    query,
    params: baseFilters.params,
  });

  const actualByMonth = new Map<number, number>();
  const lyByMonth = new Map<number, number>();

  for (const row of rows as Array<{ year_value?: number | null; month_value?: number | null; total_actual_value?: number | null }>) {
    const yearValue = Number(row.year_value ?? 0);
    const monthValue = Number(row.month_value ?? 0);
    if (!monthValue) continue;

    const value = Number(row.total_actual_value ?? 0);
    if (yearValue === context.analysisYear) {
      actualByMonth.set(monthValue, value);
    } else if (yearValue === context.lyYear) {
      lyByMonth.set(monthValue, value);
    }
  }

  const points = Array.from({ length: context.cutoffMonth }, (_, index) => {
    const month = index + 1;
    return {
      month,
      monthLabel: monthLabel(month),
      actualValue: actualByMonth.get(month) ?? 0,
      lyValue: context.hasLyData ? (lyByMonth.get(month) ?? 0) : null,
    };
  });

  return {
    context,
    points,
  };
}

export async function getSalesInternalBudgetKpis(
  filters: SalesInternalFilters = {},
): Promise<SalesInternalBudgetKpis> {
  const client = getBigQueryClient();
  const budgetContext = await getBudgetContext(filters);
  if (!budgetContext.analysisYear || !budgetContext.cutoffMonth) {
    return {
      analysisYear: null,
      cutoffMonth: null,
      hasData: false,
      actualTotal: 0,
      budgetTotal: 0,
      varianceTotal: 0,
      variancePct: null,
    };
  }

  const budgetFilters = buildBudgetFilters(filters);
  const whereClause = budgetFilters.whereClause
    ? `${budgetFilters.whereClause} AND EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`
    : `WHERE EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`;

  const query = `
    SELECT
      SUM(actual_value) AS actual_total,
      SUM(budget_value) AS budget_total
    FROM \`${BUDGET_VIEW}\`
    ${whereClause}
  `;
  const [rows] = await client.query({
    query,
    params: budgetFilters.params,
  });
  const row = (rows as Array<{ actual_total?: number | null; budget_total?: number | null }>)[0] ?? {};
  const actualTotal = Number(row.actual_total ?? 0);
  const budgetTotal = Number(row.budget_total ?? 0);
  const varianceTotal = actualTotal - budgetTotal;
  const variancePct = budgetTotal === 0 ? null : varianceTotal / budgetTotal;

  return {
    analysisYear: budgetContext.analysisYear,
    cutoffMonth: budgetContext.cutoffMonth,
    hasData: true,
    actualTotal,
    budgetTotal,
    varianceTotal,
    variancePct,
  };
}

export async function getSalesInternalBudgetTopVariance(
  filters: SalesInternalFilters = {},
  limit = 12,
): Promise<SalesInternalBudgetProductVarianceRow[]> {
  const client = getBigQueryClient();
  const budgetContext = await getBudgetContext(filters);
  if (!budgetContext.analysisYear || !budgetContext.cutoffMonth) {
    return [];
  }

  const budgetFilters = buildBudgetFilters(filters);
  const whereClause = budgetFilters.whereClause
    ? `${budgetFilters.whereClause} AND EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`
    : `WHERE EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`;

  const query = `
    SELECT
      product_id,
      canonical_product_code,
      canonical_product_name,
      ANY_VALUE(bu) AS bu,
      ANY_VALUE(sales_group) AS sales_group,
      SUM(actual_value) AS actual_value,
      SUM(budget_value) AS budget_value,
      SUM(variance_vs_budget) AS variance_vs_budget,
      SAFE_DIVIDE(SUM(variance_vs_budget), NULLIF(SUM(budget_value), 0)) AS variance_vs_budget_pct
    FROM \`${BUDGET_VIEW}\`
    ${whereClause}
    GROUP BY product_id, canonical_product_code, canonical_product_name
    ORDER BY ABS(variance_vs_budget) DESC
    LIMIT @limit
  `;
  const [rows] = await client.query({
    query,
    params: { ...budgetFilters.params, limit },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    productId: String(row.product_id ?? ''),
    canonicalProductCode: String(row.canonical_product_code ?? ''),
    canonicalProductName: String(row.canonical_product_name ?? ''),
    bu: String(row.bu ?? ''),
    salesGroup: String(row.sales_group ?? ''),
    actualValue: Number(row.actual_value ?? 0),
    budgetValue: Number(row.budget_value ?? 0),
    varianceVsBudget: Number(row.variance_vs_budget ?? 0),
    varianceVsBudgetPct:
      row.variance_vs_budget_pct === null || row.variance_vs_budget_pct === undefined
        ? null
        : Number(row.variance_vs_budget_pct),
    coveragePct:
      row.budget_value === null || row.budget_value === undefined || Number(row.budget_value) === 0
        ? null
        : Number(row.actual_value ?? 0) / Number(row.budget_value),
  }));
}

function emptyBudgetMetric(): SalesInternalBudgetMetricComparison {
  return {
    actual: 0,
    budget: 0,
    variance: 0,
    variancePct: null,
    coveragePct: null,
  };
}

export async function getSalesInternalBudgetDualKpis(
  filters: SalesInternalFilters = {},
): Promise<SalesInternalBudgetDualKpis> {
  const client = getBigQueryClient();
  const budgetContext = await getBudgetContext(filters);
  if (!budgetContext.analysisYear || !budgetContext.cutoffMonth) {
    return {
      analysisYear: null,
      cutoffMonth: null,
      hasData: false,
      netSales: emptyBudgetMetric(),
      units: emptyBudgetMetric(),
    };
  }

  const budgetFilters = buildBudgetFilters(filters);
  const whereClause = budgetFilters.whereClause
    ? `${budgetFilters.whereClause} AND EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`
    : `WHERE EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`;

  const query = `
    SELECT
      COALESCE(sales_group, 'unknown') AS sales_group,
      SUM(actual_value) AS actual_total,
      SUM(budget_value) AS budget_total
    FROM \`${BUDGET_VIEW}\`
    ${whereClause}
    GROUP BY sales_group
  `;
  const [rows] = await client.query({
    query,
    params: budgetFilters.params,
  });

  const netSales = emptyBudgetMetric();
  const units = emptyBudgetMetric();
  for (const row of rows as Array<{ sales_group?: string | null; actual_total?: number | null; budget_total?: number | null }>) {
    const metric = mapSalesGroupToMetric(row.sales_group);
    const actual = Number(row.actual_total ?? 0);
    const budget = Number(row.budget_total ?? 0);
    const variance = actual - budget;

    const target = metric === 'units' ? units : metric === 'net' ? netSales : null;
    if (!target) continue;
    target.actual += actual;
    target.budget += budget;
    target.variance += variance;
    target.variancePct = target.budget === 0 ? null : target.variance / target.budget;
    target.coveragePct = target.budget === 0 ? null : target.actual / target.budget;
  }

  return {
    analysisYear: budgetContext.analysisYear,
    cutoffMonth: budgetContext.cutoffMonth,
    hasData: true,
    netSales,
    units,
  };
}

export async function getSalesInternalBudgetProductTotals(
  filters: SalesInternalFilters = {},
  limit = 2000,
): Promise<SalesInternalBudgetProductVarianceRow[]> {
  const client = getBigQueryClient();
  const budgetContext = await getBudgetContext(filters);
  if (!budgetContext.analysisYear || !budgetContext.cutoffMonth) {
    return [];
  }

  const budgetFilters = buildBudgetFilters(filters);
  const whereClause = budgetFilters.whereClause
    ? `${budgetFilters.whereClause} AND EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`
    : `WHERE EXTRACT(YEAR FROM period_month) = ${budgetContext.analysisYear} AND EXTRACT(MONTH FROM period_month) <= ${budgetContext.cutoffMonth}`;

  const query = `
    SELECT
      product_id,
      canonical_product_code,
      canonical_product_name,
      ANY_VALUE(bu) AS bu,
      ANY_VALUE(sales_group) AS sales_group,
      SUM(actual_value) AS actual_value,
      SUM(budget_value) AS budget_value,
      SUM(variance_vs_budget) AS variance_vs_budget,
      SAFE_DIVIDE(SUM(variance_vs_budget), NULLIF(SUM(budget_value), 0)) AS variance_vs_budget_pct
    FROM \`${BUDGET_VIEW}\`
    ${whereClause}
    GROUP BY product_id, canonical_product_code, canonical_product_name
    ORDER BY ABS(variance_vs_budget) DESC
    LIMIT @limit
  `;
  const [rows] = await client.query({
    query,
    params: { ...budgetFilters.params, limit },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    productId: String(row.product_id ?? ''),
    canonicalProductCode: String(row.canonical_product_code ?? ''),
    canonicalProductName: String(row.canonical_product_name ?? ''),
    bu: String(row.bu ?? ''),
    salesGroup: String(row.sales_group ?? ''),
    actualValue: Number(row.actual_value ?? 0),
    budgetValue: Number(row.budget_value ?? 0),
    varianceVsBudget: Number(row.variance_vs_budget ?? 0),
    varianceVsBudgetPct:
      row.variance_vs_budget_pct === null || row.variance_vs_budget_pct === undefined
        ? null
        : Number(row.variance_vs_budget_pct),
    coveragePct:
      row.budget_value === null || row.budget_value === undefined || Number(row.budget_value) === 0
        ? null
        : Number(row.actual_value ?? 0) / Number(row.budget_value),
  }));
}

export async function getSalesInternalChannelBreakdown(
  filters: SalesInternalFilters = {},
): Promise<SalesInternalBreakdownRow[]> {
  const client = getBigQueryClient();
  const baseFilters = applyCommonFilters(filters);
  let whereClause = baseFilters.whereClause;
  const params = baseFilters.params;
  if (!filters.periodMonth) {
    const context = await getComparisonContext(filters, { includeSalesGroup: true });
    if (context.analysisYear && context.cutoffMonth) {
      whereClause = appendWhereCondition(
        whereClause,
        ytdWindowCondition(context.analysisYear, context.cutoffMonth),
      );
    }
  }
  const withoutSalesGroup = removeSalesGroupFilter(whereClause, params);

  const query = `
    SELECT
      channel AS label,
      SUM(actual_value) AS actual_value
    FROM \`${SUMMARY_VIEW}\`
    ${whereClause}
    GROUP BY channel
    ORDER BY actual_value DESC
  `;

  let rows: unknown[];
  try {
    [rows] = await client.query({ query, params });
  } catch (error) {
    if (!isMissingSalesGroupError(error)) {
      throw error;
    }
    const fallbackQuery = `
      SELECT
        channel AS label,
        SUM(actual_value) AS actual_value
      FROM \`${SUMMARY_VIEW}\`
      ${withoutSalesGroup.whereClause}
      GROUP BY channel
      ORDER BY actual_value DESC
    `;
    [rows] = await client.query({
      query: fallbackQuery,
      params: withoutSalesGroup.params,
    });
  }
  return (rows as Record<string, unknown>[]).map((row) => ({
    label: String(row.label ?? '-'),
    actualValue: Number(row.actual_value ?? 0),
  }));
}

export async function getSalesInternalBuBreakdown(
  filters: SalesInternalFilters = {},
): Promise<SalesInternalBreakdownRow[]> {
  const client = getBigQueryClient();
  const baseFilters = applyCommonFilters(filters);
  let whereClause = baseFilters.whereClause;
  const params = baseFilters.params;
  if (!filters.periodMonth) {
    const context = await getComparisonContext(filters, { includeSalesGroup: true });
    if (context.analysisYear && context.cutoffMonth) {
      whereClause = appendWhereCondition(
        whereClause,
        ytdWindowCondition(context.analysisYear, context.cutoffMonth),
      );
    }
  }
  const withoutSalesGroup = removeSalesGroupFilter(whereClause, params);

  const query = `
    SELECT
      bu AS label,
      SUM(actual_value) AS actual_value
    FROM \`${SUMMARY_VIEW}\`
    ${whereClause}
    GROUP BY bu
    ORDER BY actual_value DESC
  `;

  let rows: unknown[];
  try {
    [rows] = await client.query({ query, params });
  } catch (error) {
    if (!isMissingSalesGroupError(error)) {
      throw error;
    }
    const fallbackQuery = `
      SELECT
        bu AS label,
        SUM(actual_value) AS actual_value
      FROM \`${SUMMARY_VIEW}\`
      ${withoutSalesGroup.whereClause}
      GROUP BY bu
      ORDER BY actual_value DESC
    `;
    [rows] = await client.query({
      query: fallbackQuery,
      params: withoutSalesGroup.params,
    });
  }
  return (rows as Record<string, unknown>[]).map((row) => ({
    label: String(row.label ?? '-'),
    actualValue: Number(row.actual_value ?? 0),
  }));
}

function buildTopProductsQuery(withMetadata: boolean) {
  return `
    ${
      withMetadata
        ? `
    WITH product_metadata_dedup AS (
      SELECT product_id, brand_name, subbrand_or_device, portfolio_name, business_unit_name, lifecycle_status, notes
      FROM (
        SELECT
          pm.*,
          ROW_NUMBER() OVER (
            PARTITION BY pm.product_id
            ORDER BY pm.updated_at DESC, pm.created_at DESC
          ) AS rn
        FROM \`chiesi-committee.chiesi_committee_admin.product_metadata\` pm
      )
      WHERE rn = 1
    )
    `
        : ''
    }
    SELECT
      v.product_id,
      v.canonical_product_code,
      v.canonical_product_name,
      SUM(v.actual_value) AS actual_value,
      SUM(v.row_count) AS row_count,
      SUM(v.customer_count) AS customer_count,
      ${withMetadata ? 'ANY_VALUE(pm.brand_name)' : 'NULL'} AS brand_name,
      ${withMetadata ? 'ANY_VALUE(pm.subbrand_or_device)' : 'NULL'} AS subbrand_or_device,
      ${withMetadata ? 'ANY_VALUE(pm.portfolio_name)' : 'NULL'} AS portfolio_name,
      ${withMetadata ? 'ANY_VALUE(pm.business_unit_name)' : 'NULL'} AS business_unit_name,
      ${withMetadata ? 'ANY_VALUE(pm.lifecycle_status)' : 'NULL'} AS lifecycle_status,
      ${withMetadata ? 'ANY_VALUE(pm.notes)' : 'NULL'} AS notes
    FROM \`${PRODUCT_VIEW}\` AS v
    ${
      withMetadata
        ? 'LEFT JOIN product_metadata_dedup AS pm ON pm.product_id = v.product_id'
        : ''
    }
    __WHERE__
    GROUP BY v.product_id, v.canonical_product_code, v.canonical_product_name
    ORDER BY actual_value DESC
    LIMIT @limit
  `;
}

export async function getSalesInternalTopProducts(
  filters: SalesInternalFilters = {},
  limit = 10,
): Promise<SalesInternalTopProductRow[]> {
  const client = getBigQueryClient();
  const { whereClause, params } = applyCommonFilters(filters);

  const detailFilters: string[] = [];
  const detailParams: Record<string, string | number> = { ...params, limit };

  if (whereClause) {
    detailFilters.push(whereClause.replace(/^WHERE\s+/i, ''));
  }

  if (filters.productId) {
    detailFilters.push('v.product_id = @productId');
    detailParams.productId = filters.productId;
  }

  if (!filters.periodMonth) {
    const context = await getComparisonContext(filters, { includeSalesGroup: true });
    if (context.analysisYear && context.cutoffMonth) {
      detailFilters.push(
        `EXTRACT(YEAR FROM v.period_month) = ${context.analysisYear} AND EXTRACT(MONTH FROM v.period_month) <= ${context.cutoffMonth}`,
      );
    }
  }

  const finalWhereClause =
    detailFilters.length > 0 ? `WHERE ${detailFilters.join(' AND ')}` : '';

  try {
    const query = buildTopProductsQuery(true).replace('__WHERE__', finalWhereClause);
    const [rows] = await client.query({ query, params: detailParams });
    return (rows as Record<string, unknown>[]).map((row) => ({
      productId: String(row.product_id ?? ''),
      canonicalProductCode: String(row.canonical_product_code ?? ''),
      canonicalProductName: String(row.canonical_product_name ?? ''),
      actualValue: Number(row.actual_value ?? 0),
      rowCount: Number(row.row_count ?? 0),
      customerCount: Number(row.customer_count ?? 0),
      brandName: row.brand_name ? String(row.brand_name) : null,
      subbrandOrDevice: row.subbrand_or_device ? String(row.subbrand_or_device) : null,
      portfolioName: row.portfolio_name ? String(row.portfolio_name) : null,
      businessUnitName: row.business_unit_name ? String(row.business_unit_name) : null,
      lifecycleStatus: row.lifecycle_status ? String(row.lifecycle_status) : null,
      notes: row.notes ? String(row.notes) : null,
    }));
  } catch {
    const fallbackQuery = buildTopProductsQuery(false).replace('__WHERE__', finalWhereClause);
    const [rows] = await client.query({ query: fallbackQuery, params: detailParams });
    return (rows as Record<string, unknown>[]).map((row) => ({
      productId: String(row.product_id ?? ''),
      canonicalProductCode: String(row.canonical_product_code ?? ''),
      canonicalProductName: String(row.canonical_product_name ?? ''),
      actualValue: Number(row.actual_value ?? 0),
      rowCount: Number(row.row_count ?? 0),
      customerCount: Number(row.customer_count ?? 0),
      brandName: null,
      subbrandOrDevice: null,
      portfolioName: null,
      businessUnitName: null,
      lifecycleStatus: null,
      notes: null,
    }));
  }
}
