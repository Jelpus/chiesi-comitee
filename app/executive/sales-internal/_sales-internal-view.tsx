import Link from 'next/link';
import { SalesInternalFilterBar } from '@/components/executive/sales-internal/filter-bar';
import { unstable_cache } from 'next/cache';
import { SalesInternalInsightsDashboard } from '@/components/executive/sales-internal/insights-dashboard';
import { SalesInternalKpiCards } from '@/components/executive/sales-internal/kpi-cards';
import { SectionHeader } from '@/components/ui/section-header';
import { formatSalesMetric, resolveSalesMetricMode } from '@/lib/format/sales-metric';
import { getSalesInternalInsightsModel, getSalesInternalScorecardPriorities } from '@/lib/insights/sales-internal';
import {
  getSalesInternalAuditContext,
  getSalesInternalBuBreakdown,
  getSalesInternalBudgetDualKpis,
  getSalesInternalBudgetBuBreakdown,
  getSalesInternalBudgetBrandBreakdown,
  getSalesInternalBudgetChannelPerformance,
  getSalesInternalBudgetChannelBreakdown,
  getSalesInternalBudgetMonthly,
  getSalesInternalBudgetKpis,
  getSalesInternalBudgetProductTotals,
  getSalesInternalBudgetTopVariance,
  getSalesInternalChannelBreakdown,
  getSalesInternalDualKpisYoY,
  getSalesInternalFilterOptions,
  getSalesInternalKpis,
  getSalesInternalProductDetail,
  getSalesInternalTopProducts,
  getSalesInternalTrendYoY,
} from '@/lib/data/sales-internal';
import type { SalesInternalFilters } from '@/types/sales-internal';

export type SalesInternalViewMode = 'insights' | 'scorecard' | 'dashboard';

type SearchParams = {
  periodMonth?: string;
  bu?: string;
  channel?: string;
  distributionChannel?: string;
  salesGroup?: string;
  productId?: string;
};

type SalesInternalViewProps = {
  searchParams: SearchParams;
  viewMode: SalesInternalViewMode;
};

function sanitizeFilter(value: string | undefined) {
  const normalized = (value ?? '').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSalesGroup(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parsePeriodMonth(value: string) {
  const [yearRaw, monthRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month) return null;
  return { year, month };
}

function formatPeriodTag(value: string | null | undefined) {
  if (!value) return 'N/A';
  const raw = String(value).trim();
  if (!raw) return 'N/A';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00Z`) : new Date(raw);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function compactLabel(value: string | null | undefined) {
  const normalized = (value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveSalesGroup(selected: string | undefined, options: string[]) {
  if (options.length === 0) return selected;
  if (selected && options.includes(selected)) return selected;

  const preferredOrder = ['net sales', 'units'];
  for (const preferred of preferredOrder) {
    const match = options.find((option) => normalizeSalesGroup(option) === preferred);
    if (match) return match;
  }

  return options[0];
}

function formatPct(value: number | null) {
  if (value === null) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatBudgetCoverage(value: number | null) {
  if (value === null) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

function growthTone(value: number | null) {
  if (value === null) return 'text-slate-600 bg-slate-100 border-slate-200';
  if (value >= 0) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
}

function growthSignal(netGrowth: number | null, unitsGrowth: number | null) {
  const net = netGrowth ?? 0;
  const units = unitsGrowth ?? 0;
  const score = net + units;

  if (netGrowth === null && unitsGrowth === null) {
    return {
      label: 'Awaiting LY baseline',
      tone: 'text-slate-700 bg-slate-100 border-slate-200',
      message: 'No LY baseline is available yet. Insights will auto-activate after historical data is loaded.',
    };
  }

  if (score >= 6) {
    return {
      label: 'Growth accelerating',
      tone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      message: 'Momentum is positive across value and volume. Keep investment focused on winning channels.',
    };
  }

  if (score >= 0) {
    return {
      label: 'Growth stable',
      tone: 'text-amber-700 bg-amber-50 border-amber-200',
      message: 'Trajectory is stable with mixed signals. Prioritize top drivers and reduce concentration risk.',
    };
  }

  return {
    label: 'Growth under pressure',
    tone: 'text-rose-700 bg-rose-50 border-rose-200',
    message: 'YoY trend is negative. Immediate corrective actions are recommended in priority channels and business units.',
  };
}

function modeHref(mode: SalesInternalViewMode, params: SearchParams) {
  const query = new URLSearchParams();
  if (params.periodMonth) query.set('periodMonth', params.periodMonth);
  if (params.bu) query.set('bu', params.bu);
  if (params.channel) query.set('channel', params.channel);
  if (params.distributionChannel) query.set('distributionChannel', params.distributionChannel);
  if (params.salesGroup) query.set('salesGroup', params.salesGroup);
  if (params.productId) query.set('productId', params.productId);
  const queryText = query.toString();
  return `/executive/sales-internal/${mode}${queryText ? `?${queryText}` : ''}`;
}

type ScorecardSignal = {
  id: string;
  level: 'Total' | 'BU' | 'Product' | 'SKU';
  item: string;
  sharePct: number;
  signalPct: number | null;
  coveragePct: number | null;
  actualValue: number;
  budgetValue: number | null;
  varianceValue: number | null;
  score: number;
  summary: string;
  action: string;
};

type BrandPerformanceRow = {
  brandName: string;
  sharePct: number;
  coveragePct: number | null;
  yoyPct: number | null;
  momPct: number | null;
  variance: number;
};

type BrandContributionRow = {
  brandName: string;
  value: number;
  contributionPct: number;
};

function toPercent(value: number | null) {
  return value === null ? null : value * 100;
}

function buildIssueScore(sharePct: number, signalPct: number | null, coveragePct: number | null, isNegativeVariance: boolean) {
  const trendPressure = signalPct !== null && signalPct < 0 ? Math.abs(signalPct) / 100 : 0;
  const budgetPressure = coveragePct !== null && coveragePct < 1 ? 1 - coveragePct : 0;
  const variancePressure = isNegativeVariance ? 0.6 : 0;
  return sharePct * (trendPressure + budgetPressure * 1.2 + variancePressure);
}

function buildStrengthScore(sharePct: number, signalPct: number | null, coveragePct: number | null, isPositiveVariance: boolean) {
  const trendStrength = signalPct !== null && signalPct > 0 ? signalPct / 100 : 0;
  const budgetStrength = coveragePct !== null && coveragePct > 1 ? coveragePct - 1 : 0;
  const varianceStrength = isPositiveVariance ? 0.5 : 0;
  return sharePct * (trendStrength + budgetStrength + varianceStrength);
}

function isUnderTarget(coveragePct: number | null, variance: number | null) {
  return (coveragePct ?? 1) < 1 || (variance ?? 0) < 0;
}

const getCachedFilterOptions = unstable_cache(
  async () => getSalesInternalFilterOptions(),
  ['sales-internal-filter-options-v1'],
  { revalidate: 120 },
);

const getCachedSalesInternalDataset = unstable_cache(
  async (
    periodMonth: string,
    bu: string,
    channel: string,
    distributionChannel: string,
    salesGroup: string,
    productId: string,
  ) => {
    const contextFilters: SalesInternalFilters = {
      periodMonth: periodMonth || undefined,
      bu: bu || undefined,
      channel: channel || undefined,
      distributionChannel: distributionChannel || undefined,
      productId: productId || undefined,
    };
    const metricFilters: SalesInternalFilters = {
      ...contextFilters,
      salesGroup: salesGroup || undefined,
    };

    const [
      kpis,
      dualKpisYoY,
      budgetDualKpis,
      trendYoY,
      budgetKpis,
      budgetChannelBreakdown,
      budgetBuBreakdown,
      budgetBrandBreakdown,
      budgetChannelPerformance,
      budgetMonthly,
      budgetVarianceRows,
      budgetProductTotals,
      channelBreakdown,
      buBreakdown,
      topProducts,
      productDetails,
    ] = await Promise.all([
      getSalesInternalKpis(metricFilters),
      getSalesInternalDualKpisYoY(contextFilters),
      getSalesInternalBudgetDualKpis(contextFilters),
      getSalesInternalTrendYoY(metricFilters),
      getSalesInternalBudgetKpis(metricFilters),
      getSalesInternalBudgetChannelBreakdown(metricFilters),
      getSalesInternalBudgetBuBreakdown(metricFilters),
      getSalesInternalBudgetBrandBreakdown(metricFilters),
      getSalesInternalBudgetChannelPerformance(metricFilters),
      getSalesInternalBudgetMonthly(metricFilters),
      getSalesInternalBudgetTopVariance(metricFilters, 12),
      getSalesInternalBudgetProductTotals(metricFilters, 600),
      getSalesInternalChannelBreakdown(metricFilters),
      getSalesInternalBuBreakdown(metricFilters),
      getSalesInternalTopProducts(metricFilters, 600),
      getSalesInternalProductDetail(metricFilters, 400),
    ]);

    return {
      kpis,
      dualKpisYoY,
      budgetDualKpis,
      trendYoY,
      budgetKpis,
      budgetChannelBreakdown,
      budgetBuBreakdown,
      budgetBrandBreakdown,
      budgetChannelPerformance,
      budgetMonthly,
      budgetVarianceRows,
      budgetProductTotals,
      channelBreakdown,
      buBreakdown,
      topProducts,
      productDetails,
    };
  },
  ['sales-internal-dataset-v12'],
  { revalidate: 45 },
);

const getCachedSalesInternalAuditContext = unstable_cache(
  async (periodMonth: string) => getSalesInternalAuditContext(periodMonth || undefined),
  ['sales-internal-audit-context-v1'],
  { revalidate: 60 },
);

export async function SalesInternalView({ searchParams: params, viewMode }: SalesInternalViewProps) {
  const contextFilters: SalesInternalFilters = {
    periodMonth: sanitizeFilter(params.periodMonth),
    bu: sanitizeFilter(params.bu),
    channel: sanitizeFilter(params.channel),
    distributionChannel: sanitizeFilter(params.distributionChannel),
    productId: sanitizeFilter(params.productId),
  };
  const requestedMetric = sanitizeFilter(params.salesGroup);

  const filterOptions = await getCachedFilterOptions();
  const effectiveSalesGroup = resolveSalesGroup(requestedMetric, filterOptions.salesGroups);
  const metricFilters: SalesInternalFilters = {
    ...contextFilters,
    salesGroup: effectiveSalesGroup,
  };
  const auditContext = await getCachedSalesInternalAuditContext(contextFilters.periodMonth ?? '');
  const reportPeriodTag =
    auditContext.reportPeriodMonth ??
    contextFilters.periodMonth ??
    filterOptions.periods[0] ??
    null;
  const sourceAsOfTag =
    auditContext.sourceAsOfMonth ??
    contextFilters.periodMonth ??
    filterOptions.periods[0] ??
    null;
  const metricMode = resolveSalesMetricMode(metricFilters.salesGroup);

  const {
    kpis,
    dualKpisYoY,
    budgetDualKpis,
    trendYoY,
    budgetKpis,
    budgetChannelBreakdown,
    budgetBuBreakdown,
    budgetBrandBreakdown,
    budgetChannelPerformance,
    budgetMonthly,
    budgetVarianceRows,
    budgetProductTotals,
    channelBreakdown,
    buBreakdown,
    topProducts,
    productDetails,
  } = await getCachedSalesInternalDataset(
    contextFilters.periodMonth ?? '',
    contextFilters.bu ?? '',
    contextFilters.channel ?? '',
    contextFilters.distributionChannel ?? '',
    metricFilters.salesGroup ?? '',
    contextFilters.productId ?? '',
  );
  const selectedBudgetMetric = metricMode === 'currency' ? budgetDualKpis.netSales : budgetDualKpis.units;
  const selectedActualYtd = metricMode === 'currency' ? dualKpisYoY.netSales.actual : dualKpisYoY.units.actual;
  const selectedBudgetYtd = selectedBudgetMetric.budget;
  const selectedVarianceYtd = selectedActualYtd - selectedBudgetYtd;
  const selectedVariancePctYtd =
    selectedBudgetYtd === 0 ? null : selectedVarianceYtd / selectedBudgetYtd;

  const budgetComparableForDrivers = !contextFilters.distributionChannel;
  const buCodeToName = new Map(filterOptions.businessUnits.map((item) => [item.value, item.label]));
  const buBreakdownNamed = buBreakdown.map((row) => ({
    ...row,
    label: buCodeToName.get(row.label) ?? row.label,
  }));

  if (viewMode === 'dashboard') {
    return (
      <section className="space-y-4 pb-8">
        <SectionHeader
          eyebrow="Executive"
          title="Sales Internal"
          description="Executive insights for normalized sales from STG and consolidated in MART."
        />
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
            <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Report Period</span>
            <span className="font-semibold text-slate-900">{formatPeriodTag(reportPeriodTag)}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
            <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Source As Of</span>
            <span className="font-semibold text-slate-900">{formatPeriodTag(sourceAsOfTag)}</span>
          </span>
        </div>

        <div className="space-y-4 pr-1">
          <SalesInternalKpiCards dualKpisYoY={dualKpisYoY} budgetDualKpis={budgetDualKpis} metricMode={metricMode} />

          <div className="sticky top-0 z-30 rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.12)] backdrop-blur-md">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 flex-1">
                <SalesInternalFilterBar
                  options={filterOptions}
                  selected={{
                    periodMonth: contextFilters.periodMonth,
                    bu: contextFilters.bu,
                    channel: contextFilters.channel,
                    distributionChannel: contextFilters.distributionChannel,
                    salesGroup: metricFilters.salesGroup,
                  }}
                />
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                {(['insights', 'scorecard', 'dashboard'] as SalesInternalViewMode[]).map((mode) => {
                  const active = viewMode === mode;
                  return (
                    <Link
                      key={mode}
                      href={modeHref(mode, params)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                        active
                          ? 'bg-slate-900 text-white shadow-[0_8px_22px_rgba(15,23,42,0.35)]'
                          : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {mode}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <SalesInternalInsightsDashboard
              channelBreakdown={channelBreakdown}
              buBreakdown={buBreakdownNamed}
              topProducts={topProducts}
              productDetails={productDetails}
              metricMode={metricMode}
              trendYoY={trendYoY}
              budgetProductTotals={budgetProductTotals}
              budgetChannelBreakdown={budgetChannelBreakdown}
              budgetMonthly={budgetMonthly}
              budgetComparable={budgetComparableForDrivers}
            />

            <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Actual vs Budget Snapshot</p>
                <p className={`rounded-full border px-2 py-1 text-xs font-semibold ${growthTone(
                  selectedVariancePctYtd === null ? null : selectedVariancePctYtd * 100,
                )}`}>
                  {formatPct(selectedVariancePctYtd === null ? null : selectedVariancePctYtd * 100)}
                </p>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <p className="rounded-[10px] border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-700">
                  Actual YTD: <span className="font-semibold text-slate-900">{formatSalesMetric(selectedActualYtd, metricMode)}</span>
                </p>
                <p className="rounded-[10px] border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-700">
                  Budget YTD: <span className="font-semibold text-slate-900">{formatSalesMetric(selectedBudgetYtd, metricMode)}</span>
                </p>
                <p className={`rounded-[10px] border px-3 py-2 text-sm ${selectedVarianceYtd >= 0 ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800' : 'border-rose-200 bg-rose-50/70 text-rose-800'}`}>
                  Variance: <span className="font-semibold">{formatSalesMetric(selectedVarianceYtd, metricMode)}</span>
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
    );
  }

  const topChannel = channelBreakdown[0];
  const topBu = buBreakdownNamed[0];
  const top3Value = topProducts.slice(0, 3).reduce((sum, item) => sum + item.actualValue, 0);
  const topProductsPositiveTotal = topProducts
    .filter((item) => item.actualValue > 0)
    .reduce((sum, item) => sum + item.actualValue, 0);
  const top3Share =
    topProductsPositiveTotal > 0
      ? Math.min(100, (top3Value / topProductsPositiveTotal) * 100)
      : 0;

  const trendPoints = trendYoY.points;
  const lastPoint = trendPoints[trendPoints.length - 1];
  const prevPoint = trendPoints[trendPoints.length - 2];
  const trendAvgBase =
    trendPoints.length > 0
      ? trendPoints.reduce((sum, point) => sum + point.actualValue, 0) / trendPoints.length
      : 0;
  const trendLowBaseThreshold = Math.max(1, trendAvgBase * 0.12);
  const trendMomentum =
    lastPoint && prevPoint && Math.abs(prevPoint.actualValue) >= trendLowBaseThreshold
      ? ((lastPoint.actualValue - prevPoint.actualValue) / prevPoint.actualValue) * 100
      : null;

  const signal = growthSignal(dualKpisYoY.netSales.deltaPct, dualKpisYoY.units.deltaPct);
  const insightsModel =
    viewMode === 'insights'
      ? await getSalesInternalInsightsModel({
          metricMode,
          dualKpisYoY,
          budgetDualKpis,
          trendYoY,
          channelBreakdown,
          buBreakdown: buBreakdownNamed,
          topProducts,
          budgetKpis,
          budgetVarianceRows,
        })
      : null;

  const totalActualForShare = kpis.totalActualValue > 0 ? kpis.totalActualValue : 1;
  const productMetaById = new Map(
    topProducts.map((item) => [
      item.productId,
      {
        canonicalProductName: item.canonicalProductName,
        subbrandOrDevice: item.subbrandOrDevice?.trim() || null,
        portfolioName: item.portfolioName?.trim() || null,
        brandName: item.brandName?.trim() || null,
        businessUnitName: item.businessUnitName?.trim() || null,
      },
    ]),
  );

  const skuTotals = new Map<string, { actual: number; budget: number; variance: number; name: string }>();
  for (const row of budgetProductTotals) {
    const key = row.canonicalProductCode || row.productId;
    const current = skuTotals.get(key) ?? { actual: 0, budget: 0, variance: 0, name: row.canonicalProductName };
    current.actual += row.actualValue;
    current.budget += row.budgetValue;
    current.variance += row.varianceVsBudget;
    if (!current.name) current.name = row.canonicalProductName;
    skuTotals.set(key, current);
  }

  const budgetByBusinessUnitName = new Map<string, { actual: number; budget: number; variance: number }>();
  for (const row of budgetProductTotals) {
    const meta = productMetaById.get(row.productId);
    const businessUnitName = meta?.businessUnitName || 'Business Unit (Not Classified)';

    const buCurrent = budgetByBusinessUnitName.get(businessUnitName) ?? { actual: 0, budget: 0, variance: 0 };
    buCurrent.actual += row.actualValue;
    buCurrent.budget += row.budgetValue;
    buCurrent.variance += row.varianceVsBudget;
    budgetByBusinessUnitName.set(businessUnitName, buCurrent);

  }

  const budgetByBuCode = new Map(budgetBuBreakdown.map((row) => [row.label, row.budgetValue]));

  const issueSignals: ScorecardSignal[] = [];
  const strengthSignals: ScorecardSignal[] = [];

  const addIssueSignal = (signalRow: Omit<ScorecardSignal, 'score'>) => {
    const score = buildIssueScore(
      signalRow.sharePct,
      signalRow.signalPct,
      signalRow.coveragePct,
      (signalRow.varianceValue ?? 0) < 0,
    );
    issueSignals.push({ ...signalRow, score });
  };

  const addStrengthSignal = (signalRow: Omit<ScorecardSignal, 'score'>) => {
    const score = buildStrengthScore(
      signalRow.sharePct,
      signalRow.signalPct,
      signalRow.coveragePct,
      (signalRow.varianceValue ?? 0) > 0,
    );
    strengthSignals.push({ ...signalRow, score });
  };

  const netShare = (dualKpisYoY.netSales.actual / totalActualForShare) * 100;
  const unitsShare = (dualKpisYoY.units.actual / totalActualForShare) * 100;
  const netSignalPct = dualKpisYoY.netSales.deltaPct;
  const unitsSignalPct = dualKpisYoY.units.deltaPct;
  const netCoverage = budgetDualKpis.netSales.coveragePct;
  const unitsCoverage = budgetDualKpis.units.coveragePct;

  if (netSignalPct !== null && netSignalPct < 0) {
    addIssueSignal({
      id: 'total-net-yoy',
      level: 'Total',
      item: 'Net Sales',
      sharePct: netShare,
      signalPct: netSignalPct,
      coveragePct: netCoverage,
      actualValue: dualKpisYoY.netSales.actual,
      budgetValue: budgetDualKpis.netSales.budget,
      varianceValue: budgetDualKpis.netSales.variance,
      summary: `Net Sales YoY is ${formatPct(netSignalPct)} with ${formatPct(toPercent(netCoverage))} coverage vs budget.`,
      action: 'Review top value loss drivers and recover in highest-share channels.',
    });
  } else {
    addStrengthSignal({
      id: 'total-net-yoy',
      level: 'Total',
      item: 'Net Sales',
      sharePct: netShare,
      signalPct: netSignalPct,
      coveragePct: netCoverage,
      actualValue: dualKpisYoY.netSales.actual,
      budgetValue: budgetDualKpis.netSales.budget,
      varianceValue: budgetDualKpis.netSales.variance,
      summary: `Net Sales YoY is ${formatPct(netSignalPct)} with ${formatPct(toPercent(netCoverage))} coverage vs budget.`,
      action: 'Scale winning initiatives and protect margin quality.',
    });
  }

  if (unitsSignalPct !== null && unitsSignalPct < 0) {
    addIssueSignal({
      id: 'total-units-yoy',
      level: 'Total',
      item: 'Units',
      sharePct: unitsShare,
      signalPct: unitsSignalPct,
      coveragePct: unitsCoverage,
      actualValue: dualKpisYoY.units.actual,
      budgetValue: budgetDualKpis.units.budget,
      varianceValue: budgetDualKpis.units.variance,
      summary: `Units YoY is ${formatPct(unitsSignalPct)} with ${formatPct(toPercent(unitsCoverage))} coverage vs budget.`,
      action: 'Activate volume recovery plans by high-impact portfolio and channel.',
    });
  } else {
    addStrengthSignal({
      id: 'total-units-yoy',
      level: 'Total',
      item: 'Units',
      sharePct: unitsShare,
      signalPct: unitsSignalPct,
      coveragePct: unitsCoverage,
      actualValue: dualKpisYoY.units.actual,
      budgetValue: budgetDualKpis.units.budget,
      varianceValue: budgetDualKpis.units.variance,
      summary: `Units YoY is ${formatPct(unitsSignalPct)} with ${formatPct(toPercent(unitsCoverage))} coverage vs budget.`,
      action: 'Maintain execution discipline and avoid volume dilution.',
    });
  }

  const buGroups = buBreakdown.map((row) => {
    const budgetValue = budgetByBuCode.get(row.label) ?? 0;
    const name = buCodeToName.get(row.label) ?? row.label;
    const actual = row.actualValue;
    return {
      name,
      actual,
      budget: budgetValue,
      variance: actual - budgetValue,
    };
  })
  .sort((a, b) => b.actual - a.actual)
  .slice(0, 8);
  const totalBuNamedActual = buGroups.reduce((sum, item) => sum + item.actual, 0);

  for (const buRow of buGroups) {
    const sharePct = totalBuNamedActual > 0 ? (buRow.actual / totalBuNamedActual) * 100 : 0;
    const coveragePct = buRow.budget > 0 ? buRow.actual / buRow.budget : null;
    const varianceValue = buRow.variance;
    const summary = `${buRow.name} contributes ${sharePct.toFixed(1)}% with ${formatPct(toPercent(coveragePct))} budget coverage.`;

    if (coveragePct !== null && coveragePct < 1) {
      addIssueSignal({
        id: `bu-${buRow.name}`,
        level: 'BU',
        item: buRow.name,
        sharePct,
        signalPct: coveragePct === null ? null : (coveragePct - 1) * 100,
        coveragePct,
        actualValue: buRow.actual,
        budgetValue: buRow.budget,
        varianceValue,
        summary,
        action: 'Focus corrective actions in this business unit: rebalance mix and accelerate the recovery brands.',
      });
    } else {
      addStrengthSignal({
        id: `bu-${buRow.name}`,
        level: 'BU',
        item: buRow.name,
        sharePct,
        signalPct: coveragePct === null ? null : (coveragePct - 1) * 100,
        coveragePct,
        actualValue: buRow.actual,
        budgetValue: buRow.budget,
        varianceValue,
        summary,
        action: 'Capture this BU playbook and replicate execution patterns in the lagging units.',
      });
    }
  }

  for (const row of budgetVarianceRows.slice(0, 16)) {
    const sharePct = (row.actualValue / totalActualForShare) * 100;
    const signalPct = toPercent(row.varianceVsBudgetPct);
    const summary = `${row.canonicalProductName} has ${sharePct.toFixed(1)}% share with ${formatPct(signalPct)} vs budget.`;

    if (row.varianceVsBudget < 0) {
      addIssueSignal({
        id: `prd-${row.productId}`,
        level: 'Product',
        item: row.canonicalProductName,
        sharePct,
        signalPct,
        coveragePct: row.coveragePct,
        actualValue: row.actualValue,
        budgetValue: row.budgetValue,
        varianceValue: row.varianceVsBudget,
        summary,
        action: 'Assign recovery owner and define 30-day product-level corrective actions.',
      });
    } else {
      addStrengthSignal({
        id: `prd-${row.productId}`,
        level: 'Product',
        item: row.canonicalProductName,
        sharePct,
        signalPct,
        coveragePct: row.coveragePct,
        actualValue: row.actualValue,
        budgetValue: row.budgetValue,
        varianceValue: row.varianceVsBudget,
        summary,
        action: 'Replicate this product execution pattern across similar portfolios.',
      });
    }

    const skuLabel = row.canonicalProductCode || row.productId;
    if (skuLabel) {
      const sku = skuTotals.get(skuLabel);
      if (sku) {
        const skuShare = (sku.actual / totalActualForShare) * 100;
        const skuCoverage = sku.budget > 0 ? sku.actual / sku.budget : null;
        const skuVariancePct = sku.budget > 0 ? ((sku.actual - sku.budget) / sku.budget) * 100 : null;
        const skuSummary = `${sku.name} has ${skuShare.toFixed(1)}% share with ${formatPct(skuVariancePct)} vs budget.`;
        if (sku.variance < 0) {
          addIssueSignal({
            id: `sku-${skuLabel}`,
            level: 'SKU',
            item: sku.name,
            sharePct: skuShare,
            signalPct: skuVariancePct,
            coveragePct: skuCoverage,
            actualValue: sku.actual,
            budgetValue: sku.budget,
            varianceValue: sku.variance,
            summary: skuSummary,
            action: 'Prioritize tactical SKU recovery (availability, demand generation, account mix).',
          });
        } else {
          addStrengthSignal({
            id: `sku-${skuLabel}`,
            level: 'SKU',
            item: sku.name,
            sharePct: skuShare,
            signalPct: skuVariancePct,
            coveragePct: skuCoverage,
            actualValue: sku.actual,
            budgetValue: sku.budget,
            varianceValue: sku.variance,
            summary: skuSummary,
            action: 'Defend in-stock and distribution to sustain overperformance.',
          });
        }
      }
    }
  }

  const dedupeSignals = (rows: ScorecardSignal[]) => {
    const unique = new Map<string, ScorecardSignal>();
    for (const row of rows) {
      if (!unique.has(row.id)) unique.set(row.id, row);
    }
    return [...unique.values()];
  };

  const scoredIssues = dedupeSignals(issueSignals)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const brandGroups = budgetBrandBreakdown
    .map((row) => ({ name: row.label, actual: row.actualValue, budget: row.budgetValue, variance: row.varianceValue }))
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 8);
  const totalBrandActual = brandGroups.reduce((sum, item) => sum + item.actual, 0);

  const buTopGapBrands = new Map<string, string[]>();
  const buTopWinningBrands = new Map<string, string[]>();
  const brandsByBu = new Map<string, Array<{ name: string; variance: number }>>();
  for (const row of budgetProductTotals) {
    const meta = productMetaById.get(row.productId);
    const businessUnitName = meta?.businessUnitName || 'Business Unit (Not Classified)';
    const brandName = compactLabel(meta?.brandName) || 'Unclassified Brand';
    const bucket = brandsByBu.get(businessUnitName) ?? [];
    bucket.push({ name: brandName, variance: row.varianceVsBudget });
    brandsByBu.set(businessUnitName, bucket);
  }
  for (const [buName, items] of brandsByBu.entries()) {
    const grouped = new Map<string, number>();
    for (const item of items) {
      grouped.set(item.name, (grouped.get(item.name) ?? 0) + item.variance);
    }
    const groupedRows = items
      .map((item) => ({ name: item.name, variance: grouped.get(item.name) ?? 0 }))
      .filter((item, idx, arr) => arr.findIndex((x) => x.name === item.name) === idx);

    const topNegative = groupedRows
      .filter((item) => item.variance < 0)
      .sort((a, b) => a.variance - b.variance)
      .slice(0, 3)
      .map((item) => item.name);
    if (topNegative.length > 0) {
      buTopGapBrands.set(buName, topNegative);
    }

    const topPositive = groupedRows
      .filter((item) => item.variance > 0)
      .sort((a, b) => b.variance - a.variance)
      .slice(0, 3)
      .map((item) => item.name);
    if (topPositive.length > 0) {
      buTopWinningBrands.set(buName, topPositive);
    }
  }

  const brandTopBudgetGapSkus = new Map<string, string[]>();
  const brandTopBudgetWinningSkus = new Map<string, string[]>();
  const skusByBrandForBudget = new Map<string, Array<{ sku: string; variance: number }>>();
  for (const row of budgetProductTotals) {
    const meta = productMetaById.get(row.productId);
    const brandName = meta?.brandName || 'Brand (Not Classified)';
    const skuLabel =
      compactLabel(meta?.subbrandOrDevice) ||
      compactLabel(meta?.canonicalProductName) ||
      compactLabel(row.canonicalProductName) ||
      'Unclassified SKU';
    const bucket = skusByBrandForBudget.get(brandName) ?? [];
    bucket.push({ sku: skuLabel, variance: row.varianceVsBudget });
    skusByBrandForBudget.set(brandName, bucket);
  }
  for (const [brandName, items] of skusByBrandForBudget.entries()) {
    const topBudgetGap = items
      .filter((item) => item.variance < 0)
      .sort((a, b) => a.variance - b.variance)
      .slice(0, 3)
      .map((item) => item.sku);
    if (topBudgetGap.length > 0) {
      brandTopBudgetGapSkus.set(brandName, topBudgetGap);
    }
    const topBudgetWinning = items
      .filter((item) => item.variance > 0)
      .sort((a, b) => b.variance - a.variance)
      .slice(0, 3)
      .map((item) => item.sku);
    if (topBudgetWinning.length > 0) {
      brandTopBudgetWinningSkus.set(brandName, topBudgetWinning);
    }
  }

  const brandTopLyGapSkus = new Map<string, string[]>();
  const brandTopLyWinningSkus = new Map<string, string[]>();
  if (trendYoY.context.analysisYear && trendYoY.context.lyYear && trendYoY.context.cutoffMonth) {
    const skuByBrandLy = new Map<
      string,
      Map<string, { sku: string; actual: number; ly: number }>
    >();

    for (const row of productDetails) {
      const period = parsePeriodMonth(row.periodMonth);
      if (!period) continue;
      if (period.month > trendYoY.context.cutoffMonth) continue;
      if (period.year !== trendYoY.context.analysisYear && period.year !== trendYoY.context.lyYear) continue;

      const meta = productMetaById.get(row.productId);
      const brandName = meta?.brandName || 'Brand (Not Classified)';
      const skuKey = row.productId || row.canonicalProductCode || row.canonicalProductName;
      const skuLabel =
        compactLabel(meta?.subbrandOrDevice) ||
        compactLabel(meta?.canonicalProductName) ||
        compactLabel(row.canonicalProductName) ||
        'Unclassified SKU';

      const brandMap = skuByBrandLy.get(brandName) ?? new Map<string, { sku: string; actual: number; ly: number }>();
      const current = brandMap.get(skuKey) ?? { sku: skuLabel, actual: 0, ly: 0 };
      if (period.year === trendYoY.context.analysisYear) current.actual += row.actualValue;
      if (period.year === trendYoY.context.lyYear) current.ly += row.actualValue;
      brandMap.set(skuKey, current);
      skuByBrandLy.set(brandName, brandMap);
    }

    for (const [brandName, skuMap] of skuByBrandLy.entries()) {
      const topLyGap = [...skuMap.values()]
        .map((item) => ({ sku: item.sku, deltaVsLy: item.actual - item.ly }))
        .filter((item) => item.deltaVsLy < 0)
        .sort((a, b) => a.deltaVsLy - b.deltaVsLy)
        .slice(0, 3)
        .map((item) => item.sku);
      if (topLyGap.length > 0) {
        brandTopLyGapSkus.set(brandName, topLyGap);
      }
      const topLyWinning = [...skuMap.values()]
        .map((item) => ({ sku: item.sku, deltaVsLy: item.actual - item.ly }))
        .filter((item) => item.deltaVsLy > 0)
        .sort((a, b) => b.deltaVsLy - a.deltaVsLy)
        .slice(0, 3)
        .map((item) => item.sku);
      if (topLyWinning.length > 0) {
        brandTopLyWinningSkus.set(brandName, topLyWinning);
      }
    }
  }

  const brandPortfolioHighlights = new Map<string, string[]>();
  const portfoliosByBrand = new Map<string, Set<string>>();
  for (const item of topProducts) {
    const brandName = item.brandName?.trim() || 'Brand (Not Classified)';
    const portfolioName = item.portfolioName?.trim();
    if (!portfolioName) continue;
    const bucket = portfoliosByBrand.get(brandName) ?? new Set<string>();
    bucket.add(portfolioName);
    portfoliosByBrand.set(brandName, bucket);
  }
  for (const [brandName, portfolioSet] of portfoliosByBrand.entries()) {
    brandPortfolioHighlights.set(brandName, [...portfolioSet].slice(0, 2));
  }

  const buDirectorAll = buGroups
    .map((row) => {
      const coveragePct = row.budget > 0 ? row.actual / row.budget : null;
      const sharePct = totalBuNamedActual > 0 ? (row.actual / totalBuNamedActual) * 100 : 0;
      return {
        owner: row.name,
        sharePct,
        coveragePct,
        variance: row.variance,
      };
    });

  const buDirectorImprove = buDirectorAll
    .filter((row) => (row.coveragePct ?? 1) < 1 || row.variance < 0)
    .sort((a, b) => b.sharePct - a.sharePct);

  const buDirectorWorking = buDirectorAll
    .filter((row) => (row.coveragePct ?? 0) >= 1 && row.variance >= 0)
    .sort((a, b) => b.sharePct - a.sharePct);

  const brandOwnerAll = brandGroups
    .map((row) => {
      const coveragePct = row.budget > 0 ? row.actual / row.budget : null;
      const sharePct = totalBrandActual > 0 ? (row.actual / totalBrandActual) * 100 : 0;
      return {
        owner: row.name,
        sharePct,
        coveragePct,
        variance: row.variance,
      };
    });

  const brandOwnerImprove = brandOwnerAll
    .filter((row) => (row.coveragePct ?? 1) < 1 || row.variance < 0)
    .sort((a, b) => b.sharePct - a.sharePct);

  const brandOwnerWorking = brandOwnerAll
    .filter((row) => (row.coveragePct ?? 0) >= 1 && row.variance >= 0)
    .sort((a, b) => b.sharePct - a.sharePct);

  const brandTimeline = new Map<string, Map<number, Map<number, number>>>();
  for (const row of productDetails) {
    const period = parsePeriodMonth(row.periodMonth);
    if (!period) continue;

    if (trendYoY.context.cutoffMonth && period.month > trendYoY.context.cutoffMonth) continue;
    if (
      trendYoY.context.analysisYear &&
      trendYoY.context.lyYear &&
      period.year !== trendYoY.context.analysisYear &&
      period.year !== trendYoY.context.lyYear
    ) {
      continue;
    }

    const brandName = productMetaById.get(row.productId)?.brandName || 'Brand (Not Classified)';
    const byYear = brandTimeline.get(brandName) ?? new Map<number, Map<number, number>>();
    const byMonth = byYear.get(period.year) ?? new Map<number, number>();
    byMonth.set(period.month, (byMonth.get(period.month) ?? 0) + row.actualValue);
    byYear.set(period.year, byMonth);
    brandTimeline.set(brandName, byYear);
  }

  const brandPerformanceRows: BrandPerformanceRow[] = brandGroups.map((brand) => {
    const sharePct = totalBrandActual > 0 ? (brand.actual / totalBrandActual) * 100 : 0;
    const coveragePct = brand.budget > 0 ? brand.actual / brand.budget : null;
    const byYear = brandTimeline.get(brand.name) ?? new Map<number, Map<number, number>>();
    const currentYearTotals =
      trendYoY.context.analysisYear !== null ? byYear.get(trendYoY.context.analysisYear) : undefined;
    const lyYearTotals = trendYoY.context.lyYear !== null ? byYear.get(trendYoY.context.lyYear) : undefined;

    let currentYtd = 0;
    if (currentYearTotals) {
      currentYtd = [...currentYearTotals.values()].reduce((sum, value) => sum + value, 0);
    }

    let lyYtd = 0;
    if (lyYearTotals) {
      lyYtd = [...lyYearTotals.values()].reduce((sum, value) => sum + value, 0);
    }

    const yoyPct = lyYtd > 0 ? ((currentYtd - lyYtd) / lyYtd) * 100 : null;

    let momPct: number | null = null;
    if (currentYearTotals && trendYoY.context.cutoffMonth && trendYoY.context.cutoffMonth > 1) {
      const currentMonth = currentYearTotals.get(trendYoY.context.cutoffMonth) ?? 0;
      const previousMonth = currentYearTotals.get(trendYoY.context.cutoffMonth - 1) ?? 0;
      if (Math.abs(previousMonth) > 0) {
        momPct = ((currentMonth - previousMonth) / previousMonth) * 100;
      }
    }

    return {
      brandName: brand.name,
      sharePct,
      coveragePct,
      yoyPct,
      momPct,
      variance: brand.variance,
    };
  });

  const brandBudgetUnderRowsRaw = brandPerformanceRows
    .filter((row) => row.variance < 0)
    .map((row) => ({ brandName: row.brandName, value: row.variance }))
    .sort((a, b) => a.value - b.value);
  const brandBudgetOverRowsRaw = brandPerformanceRows
    .filter((row) => row.variance > 0)
    .map((row) => ({ brandName: row.brandName, value: row.variance }))
    .sort((a, b) => b.value - a.value);

  const totalBudgetUnderAbs = brandBudgetUnderRowsRaw.reduce((sum, row) => sum + Math.abs(row.value), 0);
  const totalBudgetOver = brandBudgetOverRowsRaw.reduce((sum, row) => sum + row.value, 0);

  const brandBudgetUnderRows: BrandContributionRow[] = brandBudgetUnderRowsRaw.map((row) => ({
    brandName: row.brandName,
    value: row.value,
    contributionPct: totalBudgetUnderAbs > 0 ? (Math.abs(row.value) / totalBudgetUnderAbs) * 100 : 0,
  }));
  const brandBudgetOverRows: BrandContributionRow[] = brandBudgetOverRowsRaw.map((row) => ({
    brandName: row.brandName,
    value: row.value,
    contributionPct: totalBudgetOver > 0 ? (row.value / totalBudgetOver) * 100 : 0,
  }));

  const brandYtdDeltaRaw = brandPerformanceRows
    .map((row) => {
      const byYear = brandTimeline.get(row.brandName) ?? new Map<number, Map<number, number>>();
      const currentYearTotals =
        trendYoY.context.analysisYear !== null ? byYear.get(trendYoY.context.analysisYear) : undefined;
      const lyYearTotals = trendYoY.context.lyYear !== null ? byYear.get(trendYoY.context.lyYear) : undefined;
      const currentYtd = currentYearTotals ? [...currentYearTotals.values()].reduce((sum, value) => sum + value, 0) : 0;
      const lyYtd = lyYearTotals ? [...lyYearTotals.values()].reduce((sum, value) => sum + value, 0) : 0;
      return {
        brandName: row.brandName,
        delta: currentYtd - lyYtd,
      };
    })
    .filter((row) => row.delta !== 0);

  const brandYtdGrowthRaw = brandYtdDeltaRaw
    .filter((row) => row.delta > 0)
    .sort((a, b) => b.delta - a.delta);
  const brandYtdDeclineRaw = brandYtdDeltaRaw
    .filter((row) => row.delta < 0)
    .sort((a, b) => a.delta - b.delta);

  const totalYtdGrowth = brandYtdGrowthRaw.reduce((sum, row) => sum + row.delta, 0);
  const totalYtdDeclineAbs = brandYtdDeclineRaw.reduce((sum, row) => sum + Math.abs(row.delta), 0);

  const brandYtdGrowthRows: BrandContributionRow[] = brandYtdGrowthRaw.map((row) => ({
    brandName: row.brandName,
    value: row.delta,
    contributionPct: totalYtdGrowth > 0 ? (row.delta / totalYtdGrowth) * 100 : 0,
  }));
  const brandYtdDeclineRows: BrandContributionRow[] = brandYtdDeclineRaw.map((row) => ({
    brandName: row.brandName,
    value: row.delta,
    contributionPct: totalYtdDeclineAbs > 0 ? (Math.abs(row.delta) / totalYtdDeclineAbs) * 100 : 0,
  }));

  const classifyBrandSegment = (row: BrandPerformanceRow) => {
    const coverageGood = (row.coveragePct ?? 0) >= 1;
    const yoyGood = (row.yoyPct ?? -Infinity) >= 0;
    const momGood = (row.momPct ?? -Infinity) >= 0;

    if (coverageGood && yoyGood && momGood) return 'scale_up';
    if (coverageGood && (!yoyGood || !momGood)) return 'defend_momentum';
    if (!coverageGood && yoyGood) return 'monetize_growth';
    return 'turnaround';
  };

  const scoreBySegment = (row: BrandPerformanceRow, segment: ReturnType<typeof classifyBrandSegment>) => {
    if (segment === 'scale_up') {
      return row.sharePct + Math.max(0, row.yoyPct ?? 0) * 0.6 + Math.max(0, row.momPct ?? 0) * 0.4;
    }
    if (segment === 'defend_momentum') {
      return row.sharePct + Math.abs(Math.min(0, row.yoyPct ?? 0)) * 0.6 + Math.abs(Math.min(0, row.momPct ?? 0)) * 0.4;
    }
    if (segment === 'monetize_growth') {
      return row.sharePct + Math.max(0, row.yoyPct ?? 0) * 0.7 + Math.abs(Math.min(0, (row.coveragePct ?? 1) - 1)) * 120;
    }
    return row.sharePct + Math.abs(Math.min(0, row.yoyPct ?? 0)) + Math.abs(Math.min(0, (row.coveragePct ?? 1) - 1)) * 140;
  };

  const segmentBuckets = {
    scale_up: brandPerformanceRows
      .filter((row) => classifyBrandSegment(row) === 'scale_up')
      .sort((a, b) => scoreBySegment(b, 'scale_up') - scoreBySegment(a, 'scale_up'))
      .slice(0, 3),
    defend_momentum: brandPerformanceRows
      .filter((row) => classifyBrandSegment(row) === 'defend_momentum')
      .sort((a, b) => scoreBySegment(b, 'defend_momentum') - scoreBySegment(a, 'defend_momentum'))
      .slice(0, 3),
    monetize_growth: brandPerformanceRows
      .filter((row) => classifyBrandSegment(row) === 'monetize_growth')
      .sort((a, b) => scoreBySegment(b, 'monetize_growth') - scoreBySegment(a, 'monetize_growth'))
      .slice(0, 3),
    turnaround: brandPerformanceRows
      .filter((row) => classifyBrandSegment(row) === 'turnaround')
      .sort((a, b) => scoreBySegment(b, 'turnaround') - scoreBySegment(a, 'turnaround'))
      .slice(0, 3),
  };

  const totalChannelActual = budgetChannelPerformance.reduce((sum, row) => sum + row.actualValue, 0);

  const channelBrandContrib = new Map<string, Map<string, number>>();
  const analysisYear = trendYoY.context.analysisYear;
  const cutoffMonth = trendYoY.context.cutoffMonth;
  for (const row of productDetails) {
    const period = parsePeriodMonth(row.periodMonth);
    if (analysisYear && cutoffMonth && period) {
      if (period.year !== analysisYear || period.month > cutoffMonth) {
        continue;
      }
    }
    const channelKey = row.channel || 'Unknown Channel';
    const brandName =
      productMetaById.get(row.productId)?.brandName || 'Unclassified Brand';
    const byBrand = channelBrandContrib.get(channelKey) ?? new Map<string, number>();
    byBrand.set(brandName, (byBrand.get(brandName) ?? 0) + row.actualValue);
    channelBrandContrib.set(channelKey, byBrand);
  }

  const channelTopBrands = new Map<string, string[]>();
  for (const [channelName, byBrand] of channelBrandContrib.entries()) {
    const topBrands = [...byBrand.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([brand]) => brand);
    channelTopBrands.set(channelName, topBrands);
  }

  const channelPerformance = budgetChannelPerformance
    .map((row) => {
      const budgetValue = row.budgetValue;
      const coveragePct = budgetValue > 0 ? row.actualValue / budgetValue : null;
      const variance = row.varianceValue;
      const sharePct = totalChannelActual > 0 ? (row.actualValue / totalChannelActual) * 100 : 0;
      return {
        channel: row.label,
        actualValue: row.actualValue,
        budgetValue,
        coveragePct,
        variance,
        sharePct,
        topBrands: channelTopBrands.get(row.label) ?? [],
      };
    })
    .sort((a, b) => b.sharePct - a.sharePct);

  const channelImprove = channelPerformance
    .filter((row) => (row.coveragePct ?? 1) < 1 || (row.variance ?? 0) < 0)
    .slice(0, 4);
  const channelWorking = channelPerformance
    .filter((row) => (row.coveragePct ?? 0) >= 1 && (row.variance ?? 0) >= 0)
    .slice(0, 4);

  const buDirectorWatchlist = [...buDirectorAll]
    .sort((a, b) => {
      const coverageA = a.coveragePct ?? 1;
      const coverageB = b.coveragePct ?? 1;
      return coverageA - coverageB || b.sharePct - a.sharePct;
    })
    .slice(0, 3);

  const brandWatchlist = [...brandPerformanceRows]
    .map((row) => {
      const coverageRisk = (row.coveragePct ?? 1) < 1 ? (1 - (row.coveragePct ?? 1)) * 100 : 0;
      const yoyRisk = row.yoyPct !== null && row.yoyPct < 0 ? Math.abs(row.yoyPct) : 0;
      const momRisk = row.momPct !== null && row.momPct < 0 ? Math.abs(row.momPct) : 0;
      const riskScore = coverageRisk * 1.2 + yoyRisk + momRisk * 0.7 + row.sharePct * 0.2;
      return {
        owner: row.brandName,
        sharePct: row.sharePct,
        coveragePct: row.coveragePct,
        variance: row.variance,
        riskScore,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 3);

  const channelWatchlist = [...channelPerformance]
    .sort((a, b) => {
      const coverageA = a.coveragePct ?? 1;
      const coverageB = b.coveragePct ?? 1;
      return coverageA - coverageB || b.sharePct - a.sharePct;
    })
    .slice(0, 3);

  const buDirectorImproveDisplay = buDirectorImprove.length > 0 ? buDirectorImprove.slice(0, 3) : buDirectorWatchlist;
  const brandOwnerImproveDisplay = brandOwnerImprove.length > 0 ? brandOwnerImprove.slice(0, 3) : brandWatchlist;
  const channelImproveDisplay = channelImprove.length > 0 ? channelImprove.slice(0, 3) : channelWatchlist;
  const isWatchlistMode = buDirectorImprove.length === 0 && brandOwnerImprove.length === 0 && channelImprove.length === 0;
  const scorecardPriorities =
    viewMode === 'insights'
      ? await getSalesInternalScorecardPriorities({
          metricMode,
          seeds: scoredIssues.slice(0, 10).map((row) => ({
            level: row.level,
            item: row.item,
            sharePct: row.sharePct,
            signalPct: row.signalPct,
            coveragePct: row.coveragePct,
            score: row.score,
            reason: row.summary,
            action: row.action,
          })),
        })
      : null;
  const dedupedScorecardPriorities = (scorecardPriorities?.priorities ?? []).filter((item, index, array) => {
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const titleCore = normalize(item.title.split(':').slice(-1)[0] ?? item.title);
    const actionCore = normalize(item.action);
    return (
      index ===
      array.findIndex((candidate) => {
        const candidateTitleCore = normalize(candidate.title.split(':').slice(-1)[0] ?? candidate.title);
        const candidateActionCore = normalize(candidate.action);
        return candidateTitleCore === titleCore || candidateActionCore === actionCore;
      })
    );
  });

  return (
    <section className="space-y-4 pb-8">
      <SectionHeader
        eyebrow="Executive"
        title="Sales Internal"
        description="Executive insights for normalized sales from STG and consolidated in MART."
      />
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
          <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Report Period</span>
          <span className="font-semibold text-slate-900">{formatPeriodTag(reportPeriodTag)}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
          <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Source As Of</span>
          <span className="font-semibold text-slate-900">{formatPeriodTag(sourceAsOfTag)}</span>
        </span>
      </div>

      <div className="space-y-4 pr-1">
        <SalesInternalKpiCards dualKpisYoY={dualKpisYoY} budgetDualKpis={budgetDualKpis} metricMode={metricMode} />

        <div className="sticky top-0 z-30 rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.12)] backdrop-blur-md">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <SalesInternalFilterBar
                options={filterOptions}
                selected={{
                  periodMonth: contextFilters.periodMonth,
                  bu: contextFilters.bu,
                  channel: contextFilters.channel,
                  distributionChannel: contextFilters.distributionChannel,
                  salesGroup: metricFilters.salesGroup,
                }}
              />
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
              {(['insights', 'scorecard', 'dashboard'] as SalesInternalViewMode[]).map((mode) => {
                const active = viewMode === mode;
                return (
                  <Link
                    key={mode}
                    href={modeHref(mode, params)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                      active
                        ? 'bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.35)]'
                        : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {mode}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {viewMode === 'insights' ? (
          <div className="space-y-4">
            <article className="rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-[0_14px_40px_rgba(15,23,42,0.30)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Executive Narrative</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{insightsModel!.headline}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                      insightsModel!.source === 'openai_enhanced'
                        ? 'border-cyan-300 bg-cyan-50 text-cyan-800'
                        : 'border-slate-300 bg-slate-100 text-slate-700'
                    }`}
                  >
                    {insightsModel!.source === 'openai_enhanced' ? 'AI Enhanced' : 'Deterministic'}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${signal.tone}`}>
                    {formatPct(dualKpisYoY.netSales.deltaPct)}
                  </span>
                </div>
              </div>
              <p className="mt-3 max-w-3xl text-sm text-slate-200">{insightsModel!.summary}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-[14px] border border-slate-700 bg-slate-800/80 p-3">
                  <p className="text-xs text-slate-300">Net Sales YoY</p>
                  <p className={`mt-1 inline-flex rounded-full border px-2 py-1 text-sm font-semibold ${growthTone(dualKpisYoY.netSales.deltaPct)}`}>
                    {formatPct(dualKpisYoY.netSales.deltaPct)}
                  </p>
                </div>
                <div className="rounded-[14px] border border-slate-700 bg-slate-800/80 p-3">
                  <p className="text-xs text-slate-300">Units YoY</p>
                  <p className={`mt-1 inline-flex rounded-full border px-2 py-1 text-sm font-semibold ${growthTone(dualKpisYoY.units.deltaPct)}`}>
                    {formatPct(dualKpisYoY.units.deltaPct)}
                  </p>
                </div>
                <div className="rounded-[14px] border border-slate-700 bg-slate-800/80 p-3">
                  <p className="text-xs text-slate-300">Monthly Momentum</p>
                  <p className={`mt-1 inline-flex rounded-full border px-2 py-1 text-sm font-semibold ${growthTone(trendMomentum)}`}>
                    {formatPct(trendMomentum)}
                  </p>
                </div>
                <div className="rounded-[14px] border border-slate-700 bg-slate-800/80 p-3">
                  <p className="text-xs text-slate-300">YTD Window</p>
                  <p className="mt-1 text-sm font-semibold">
                    {trendYoY.context.analysisYear && trendYoY.context.cutoffMonth
                      ? `${trendYoY.context.analysisYear} M${trendYoY.context.cutoffMonth}`
                      : 'No data'}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.10)]">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Budget Signal</p>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <div className="rounded-[12px] border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-xs text-slate-500">Actual YTD</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatSalesMetric(selectedActualYtd, metricMode)}</p>
                </div>
                <div className="rounded-[12px] border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-xs text-slate-500">Budget YTD</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatSalesMetric(selectedBudgetYtd, metricMode)}</p>
                </div>
                <div className="rounded-[12px] border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-xs text-slate-500">Variance</p>
                  <p className={`mt-1 text-sm font-semibold ${selectedVarianceYtd >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatSalesMetric(selectedVarianceYtd, metricMode)}
                  </p>
                </div>
                <div className="rounded-[12px] border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-xs text-slate-500">Variance %</p>
                  <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-sm font-semibold ${growthTone(
                    selectedVariancePctYtd === null ? null : selectedVariancePctYtd * 100,
                  )}`}>
                    {formatPct(selectedVariancePctYtd === null ? null : selectedVariancePctYtd * 100)}
                  </p>
                </div>
              </div>
            </article>

            <div className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.10)]">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Executive Focus</p>
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  {insightsModel!.facts.slice(0, 3).map((fact) => (
                    <div key={fact.title} className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{fact.title}</p>
                      <p className="mt-1 text-sm text-slate-700">{fact.message}</p>
                      <p className="mt-2 text-xs text-slate-500">{fact.evidence[0] ?? ''}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.10)]">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Decision Clarity</p>
                <div className="mt-3 space-y-3">
                  {dedupedScorecardPriorities.slice(0, 2).map((item) => (
                    <div key={item.title} className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-700">
                        <span className="font-semibold text-slate-800">What happened:</span> {item.why}
                      </p>
                      <p className="mt-1 text-xs text-slate-700">
                        <span className="font-semibold text-slate-800">Why it matters:</span> {item.opportunity}
                      </p>
                      <p className="mt-1 text-xs text-slate-700">
                        <span className="font-semibold text-slate-800">What to do next:</span> {item.action}
                      </p>
                    </div>
                  ))}

                  <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Budget Performance</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div className="rounded-[10px] border border-rose-200 bg-rose-50/70 p-2">
                        <p className="text-xs font-semibold text-rose-900">Brands Driving Budget Gap</p>
                        <div className="mt-1 space-y-1">
                          {brandBudgetUnderRows.slice(0, 4).map((row) => (
                            <p key={`budget-under-${row.brandName}`} className="text-xs text-slate-700">
                              <span className="font-semibold text-rose-800">{row.brandName}</span>: {row.contributionPct.toFixed(1)}% of gap ({formatSalesMetric(row.value, metricMode)})
                            </p>
                          ))}
                          {brandBudgetUnderRows.length === 0 ? <p className="text-xs text-slate-500">No under-budget brands in current filters.</p> : null}
                        </div>
                      </div>
                      <div className="rounded-[10px] border border-emerald-200 bg-emerald-50/70 p-2">
                        <p className="text-xs font-semibold text-emerald-900">Brands Driving Budget Delivery</p>
                        <div className="mt-1 space-y-1">
                          {brandBudgetOverRows.slice(0, 4).map((row) => (
                            <p key={`budget-over-${row.brandName}`} className="text-xs text-slate-700">
                              <span className="font-semibold text-emerald-800">{row.brandName}</span>: {row.contributionPct.toFixed(1)}% of positive variance (+{formatSalesMetric(row.value, metricMode)})
                            </p>
                          ))}
                          {brandBudgetOverRows.length === 0 ? <p className="text-xs text-slate-500">No over-budget brands in current filters.</p> : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">YTD Growth Contribution</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div className="rounded-[10px] border border-rose-200 bg-rose-50/70 p-2">
                        <p className="text-xs font-semibold text-rose-900">Brands Pulling YTD Down</p>
                        <div className="mt-1 space-y-1">
                          {brandYtdDeclineRows.slice(0, 4).map((row) => (
                            <p key={`ytd-down-${row.brandName}`} className="text-xs text-slate-700">
                              <span className="font-semibold text-rose-800">{row.brandName}</span>: {row.contributionPct.toFixed(1)}% of decline ({formatSalesMetric(row.value, metricMode)})
                            </p>
                          ))}
                          {brandYtdDeclineRows.length === 0 ? <p className="text-xs text-slate-500">No negative YTD contributors in current filters.</p> : null}
                        </div>
                      </div>
                      <div className="rounded-[10px] border border-emerald-200 bg-emerald-50/70 p-2">
                        <p className="text-xs font-semibold text-emerald-900">Brands Pulling YTD Up</p>
                        <div className="mt-1 space-y-1">
                          {brandYtdGrowthRows.slice(0, 4).map((row) => (
                            <p key={`ytd-up-${row.brandName}`} className="text-xs text-slate-700">
                              <span className="font-semibold text-emerald-800">{row.brandName}</span>: {row.contributionPct.toFixed(1)}% of growth (+{formatSalesMetric(row.value, metricMode)})
                            </p>
                          ))}
                          {brandYtdGrowthRows.length === 0 ? <p className="text-xs text-slate-500">No positive YTD contributors in current filters.</p> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.10)] xl:col-span-2">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Channel Diagnostic</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Under Pressure</p>
                    {channelImprove.slice(0, 3).map((row) => (
                      <div key={`ins-channel-bad-${row.channel}`} className="rounded-[12px] border border-rose-200 bg-rose-50/70 p-3">
                        <p className="text-xs font-semibold text-rose-900">{row.channel}</p>
                        <p className="mt-1 text-xs text-slate-700">
                          Budget Coverage {formatBudgetCoverage(row.coveragePct)} | Share {row.sharePct.toFixed(1)}% | Variance vs Budget {row.variance === null ? 'N/A' : formatSalesMetric(row.variance, metricMode)}
                        </p>
                        <p className="mt-1 text-xs text-slate-700">
                          Impact mainly by brands: {(row.topBrands.length > 0 ? row.topBrands : ['Unclassified Brand']).join(', ')}.
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Outperforming</p>
                    {channelWorking.slice(0, 3).map((row) => (
                      <div key={`ins-channel-good-${row.channel}`} className="rounded-[12px] border border-emerald-200 bg-emerald-50/70 p-3">
                        <p className="text-xs font-semibold text-emerald-900">{row.channel}</p>
                        <p className="mt-1 text-xs text-slate-700">
                          Budget Coverage {formatBudgetCoverage(row.coveragePct)} | Share {row.sharePct.toFixed(1)}% | Variance vs Budget {row.variance === null ? 'N/A' : formatSalesMetric(row.variance, metricMode)}
                        </p>
                        <p className="mt-1 text-xs text-slate-700">
                          Growth is mainly driven by: {(row.topBrands.length > 0 ? row.topBrands : ['Unclassified Brand']).join(', ')}.
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.10)] xl:col-span-2">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Risk And Opportunity Radar</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[14px] border border-rose-200 bg-rose-50/70 p-3 text-sm text-rose-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em]">Primary Risk</p>
                    <p className="mt-1">
                      {top3Share >= 55
                        ? `High concentration risk: Top 3 products represent ${top3Share.toFixed(1)}% of portfolio mix (current filters).`
                        : 'Concentration is controlled, but monitor the top products closely.'}
                    </p>
                  </div>
                  <div className="rounded-[14px] border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em]">Primary Opportunity</p>
                    <p className="mt-1">
                      Expand execution in <span className="font-semibold">{topChannel?.label ?? '-'}</span> and replicate best mix in{' '}
                      <span className="font-semibold">{topBu?.label ?? '-'}</span>.
                    </p>
                  </div>
                  <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Priority Actions</p>
                    <ul className="mt-2 space-y-1">
                      {insightsModel!.actions.map((action) => (
                        <li key={action}>- {action}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            </div>

            <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Action Plan Priorities</p>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                      scorecardPriorities!.source === 'openai_enhanced'
                        ? 'border-cyan-300 bg-cyan-50 text-cyan-800'
                        : 'border-slate-300 bg-slate-100 text-slate-700'
                    }`}
                  >
                    {scorecardPriorities!.source === 'openai_enhanced' ? 'AI Enhanced' : 'Deterministic'}
                  </span>
                  <p className={`rounded-full border px-2 py-1 text-xs font-semibold ${growthTone(
                    selectedVariancePctYtd === null ? null : selectedVariancePctYtd * 100,
                  )}`}>
                    Total Budget Gap {formatPct(selectedVariancePctYtd === null ? null : selectedVariancePctYtd * 100)}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {dedupedScorecardPriorities.map((item, index) => (
                  <div key={item.title} className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Priority {index + 1} · {item.title}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{item.action}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.why}</p>
                    <p className="mt-1 text-xs font-medium text-emerald-700">Opportunity: {item.opportunity}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        ) : null}

        {viewMode === 'scorecard' ? (
          <div className="space-y-4">
            <article className="rounded-[24px] border border-indigo-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-indigo-700">Brand Performance Map</p>
                <p className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                  YTD Growth + Coverage + MoM
                </p>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-4">
                <div className="rounded-[14px] border border-emerald-200 bg-emerald-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Scale Up</p>
                  <p className="mt-1 text-xs text-emerald-900">Strong on growth, coverage and momentum.</p>
                  <div className="mt-2 space-y-2">
                    {segmentBuckets.scale_up.map((row) => (
                      <div key={`seg-scale-${row.brandName}`} className="rounded-[10px] border border-emerald-200 bg-white/80 p-2">
                        <p className="text-xs font-semibold text-emerald-900">{row.brandName}</p>
                        <p className="mt-1 text-xs text-slate-700">
                          YoY {formatPct(row.yoyPct)} | Cov {formatBudgetCoverage(row.coveragePct)} | MoM {formatPct(row.momPct)}
                        </p>
                        <p className="mt-1 text-xs text-emerald-800">Message: scale investment and protect this execution model.</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[14px] border border-amber-200 bg-amber-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Defend Momentum</p>
                  <p className="mt-1 text-xs text-amber-900">Coverage is solid but trend needs stabilization.</p>
                  <div className="mt-2 space-y-2">
                    {segmentBuckets.defend_momentum.map((row) => (
                      <div key={`seg-defend-${row.brandName}`} className="rounded-[10px] border border-amber-200 bg-white/80 p-2">
                        <p className="text-xs font-semibold text-amber-900">{row.brandName}</p>
                        <p className="mt-1 text-xs text-slate-700">
                          YoY {formatPct(row.yoyPct)} | Cov {formatBudgetCoverage(row.coveragePct)} | MoM {formatPct(row.momPct)}
                        </p>
                        <p className="mt-1 text-xs text-amber-800">Message: protect baseline and recover short-term trajectory.</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[14px] border border-cyan-200 bg-cyan-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">Monetize Growth</p>
                  <p className="mt-1 text-xs text-cyan-900">Demand is growing but budget capture is still low.</p>
                  <div className="mt-2 space-y-2">
                    {segmentBuckets.monetize_growth.map((row) => (
                      <div key={`seg-monetize-${row.brandName}`} className="rounded-[10px] border border-cyan-200 bg-white/80 p-2">
                        <p className="text-xs font-semibold text-cyan-900">{row.brandName}</p>
                        <p className="mt-1 text-xs text-slate-700">
                          YoY {formatPct(row.yoyPct)} | Cov {formatBudgetCoverage(row.coveragePct)} | MoM {formatPct(row.momPct)}
                        </p>
                        <p className="mt-1 text-xs text-cyan-800">Message: convert demand into budget delivery through mix and channel focus.</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[14px] border border-rose-200 bg-rose-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Turnaround</p>
                  <p className="mt-1 text-xs text-rose-900">Gap on coverage with weak growth signals.</p>
                  <div className="mt-2 space-y-2">
                    {segmentBuckets.turnaround.map((row) => (
                      <div key={`seg-turn-${row.brandName}`} className="rounded-[10px] border border-rose-200 bg-white/80 p-2">
                        <p className="text-xs font-semibold text-rose-900">{row.brandName}</p>
                        <p className="mt-1 text-xs text-slate-700">
                          YoY {formatPct(row.yoyPct)} | Cov {formatBudgetCoverage(row.coveragePct)} | MoM {formatPct(row.momPct)}
                        </p>
                        <p className="mt-1 text-xs text-rose-800">Message: activate immediate recovery plan with weekly executive tracking.</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <div className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-[24px] border border-emerald-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
              <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">What Is Working</p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Business Director Brief</p>
                  <div className="mt-2 space-y-2">
                    {buDirectorWorking.slice(0, 3).map((row) => (
                      <div key={`bu-win-${row.owner}`} className="rounded-[12px] border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                        <p className="text-xs font-semibold text-emerald-900">{row.owner}</p>
                        <p className="mt-1 text-xs text-slate-700">
                          Budget Coverage {formatBudgetCoverage(row.coveragePct)} (Gap {formatPct(row.coveragePct === null ? null : (row.coveragePct - 1) * 100)}) | Share {row.sharePct.toFixed(1)}% | Variance vs Budget {formatSalesMetric(row.variance, metricMode)}
                        </p>
                        <p className="mt-1 text-xs font-medium text-emerald-800">
                          Message: excellent BU performance, mainly driven by{' '}
                          {(buTopWinningBrands.get(row.owner) ?? ['its top performing brands'])
                            .slice(0, 3)
                            .join(', ')}
                          .
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Brand Owner Brief</p>
                  <div className="mt-2 space-y-2">
                    {brandOwnerWorking.slice(0, 3).map((row) => (
                      <div key={`brand-win-${row.owner}`} className="rounded-[12px] border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                        <p className="text-xs font-semibold text-emerald-900">{row.owner}</p>
                        <p className="mt-1 text-xs text-slate-700">
                          Budget Coverage {formatBudgetCoverage(row.coveragePct)} (Gap {formatPct(row.coveragePct === null ? null : (row.coveragePct - 1) * 100)}) | Share {row.sharePct.toFixed(1)}% | Variance vs Budget {formatSalesMetric(row.variance, metricMode)}
                        </p>
                        <p className="mt-1 text-xs font-medium text-emerald-800">
                          Message: excellent performance driven by{' '}
                          {(brandTopBudgetWinningSkus.get(row.owner) ?? brandTopLyWinningSkus.get(row.owner) ?? ['top-performing SKUs'])
                            .slice(0, 3)
                            .join(', ')}
                          .
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Channel Brief</p>
                  <div className="mt-2 space-y-2">
                    {channelWorking.slice(0, 3).map((row) => (
                      <div key={`sc-channel-good-${row.channel}`} className="rounded-[12px] border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                        <p className="text-xs font-semibold text-emerald-900">{row.channel}</p>
                        <p className="mt-1 text-xs text-slate-700">
                          Budget Coverage {formatBudgetCoverage(row.coveragePct)} | Share {row.sharePct.toFixed(1)}% | Variance vs Budget {row.variance === null ? 'N/A' : formatSalesMetric(row.variance, metricMode)}
                        </p>
                        <p className="mt-1 text-xs font-medium text-emerald-800">
                          Message: excellent execution in this channel, mainly driven by {(row.topBrands.length > 0 ? row.topBrands : ['Unclassified Brand']).join(', ')}.
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-[24px] border border-rose-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
              <p className="text-xs uppercase tracking-[0.16em] text-rose-700">{isWatchlistMode ? 'Watchlist Priorities' : 'What Needs To Improve'}</p>
              {isWatchlistMode ? (
                <p className="mt-2 text-xs text-slate-500">
                  Watchlist mode: no negative budget gaps detected; showing early risk signals by coverage and trend.
                </p>
              ) : null}
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Business Director Brief</p>
                  <div className="mt-2 space-y-2">
                    {buDirectorImproveDisplay.map((row) => {
                      const underTarget = isUnderTarget(row.coveragePct, row.variance);
                      return (
                      <div key={`bu-imp-${row.owner}`} className="rounded-[12px] border border-rose-200 bg-rose-50/70 px-3 py-2">
                        <p className="text-xs font-semibold text-rose-900">{row.owner}</p>
                        <p className="mt-1 text-xs text-slate-700">
                          Budget Coverage {formatBudgetCoverage(row.coveragePct)} (Gap {formatPct(row.coveragePct === null ? null : (row.coveragePct - 1) * 100)}) | Share {row.sharePct.toFixed(1)}% | Variance vs Budget {formatSalesMetric(row.variance, metricMode)}
                        </p>
                        <p className="mt-1 text-xs font-medium text-rose-800">
                          {underTarget
                            ? 'Message: recover this BU first, because it is meaningful in weight and currently under target.'
                            : 'Message: no hard budget gap, but monitor this BU as an early-warning watchlist priority.'}
                        </p>
                        <p className="mt-1 text-xs text-slate-700">
                          {underTarget ? (
                            <>
                              How: prioritize your attention on{' '}
                              {(buTopGapBrands.get(row.owner) ?? ['the top gap brands'])
                                .slice(0, 3)
                                .join(', ')}
                              ; then rebalance channel mix toward high-conversion channels and run a weekly recovery check on coverage and variance.
                            </>
                          ) : (
                            <>
                              How: keep weekly tracking on coverage and momentum; if MoM weakens, trigger action on{' '}
                              {(buTopGapBrands.get(row.owner) ?? buTopWinningBrands.get(row.owner) ?? ['the most sensitive brands'])
                                .slice(0, 3)
                                .join(', ')}
                              .
                            </>
                          )}
                        </p>
                      </div>
                    );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Brand Owner Brief</p>
                  <div className="mt-2 space-y-2">
                    {brandOwnerImproveDisplay.map((row) => {
                      const underTarget = isUnderTarget(row.coveragePct, row.variance);
                      return (
                      <div key={`brand-imp-${row.owner}`} className="rounded-[12px] border border-rose-200 bg-rose-50/70 px-3 py-2">
                        <p className="text-xs font-semibold text-rose-900">{row.owner}</p>
                        <p className="mt-1 text-xs text-slate-700">
                          Budget Coverage {formatBudgetCoverage(row.coveragePct)} (Gap {formatPct(row.coveragePct === null ? null : (row.coveragePct - 1) * 100)}) | Share {row.sharePct.toFixed(1)}% | Variance vs Budget {formatSalesMetric(row.variance, metricMode)}
                        </p>
                        <p className="mt-1 text-xs font-medium text-rose-800">
                          {underTarget
                            ? 'Message: fix this brand trajectory now; it is pulling down consolidated YTD delivery.'
                            : 'Message: no hard budget gap, but keep this brand under close watch for trend deterioration.'}
                        </p>
                        <p className="mt-1 text-xs text-slate-700">
                          {underTarget ? (
                            <>
                              How: prioritize these SKUs for budget recovery:{' '}
                              {(brandTopBudgetGapSkus.get(row.owner) ?? ['the top gap SKUs'])
                                .slice(0, 3)
                                .join(', ')}
                              . Then validate LY recovery on{' '}
                              {(brandTopLyGapSkus.get(row.owner) ?? ['the same SKUs with highest LY gap'])
                                .slice(0, 3)
                                .join(', ')}
                              .
                            </>
                          ) : (
                            <>
                              How: defend the current run rate in{' '}
                              {(brandTopBudgetWinningSkus.get(row.owner) ?? brandTopLyWinningSkus.get(row.owner) ?? ['the most relevant SKUs'])
                                .slice(0, 3)
                                .join(', ')}
                              , and monitor weekly MoM changes.
                            </>
                          )}
                        </p>
                      </div>
                    );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Channel Brief</p>
                  <div className="mt-2 space-y-2">
                    {channelImproveDisplay.map((row) => {
                      const underTarget = isUnderTarget(row.coveragePct, row.variance);
                      return (
                      <div key={`sc-channel-bad-${row.channel}`} className="rounded-[12px] border border-rose-200 bg-rose-50/70 px-3 py-2">
                        <p className="text-xs font-semibold text-rose-900">{row.channel}</p>
                        <p className="mt-1 text-xs text-slate-700">
                          Budget Coverage {formatBudgetCoverage(row.coveragePct)} | Share {row.sharePct.toFixed(1)}% | Variance vs Budget {row.variance === null ? 'N/A' : formatSalesMetric(row.variance, metricMode)}
                        </p>
                        <p className="mt-1 text-xs font-medium text-rose-800">
                          {underTarget
                            ? `Message: this channel is under target, mainly impacted by ${(row.topBrands.length > 0 ? row.topBrands : ['Unclassified Brand']).join(', ')}.`
                            : `Message: this channel is currently above target, but remains a watchlist area due to relative momentum risk in ${(row.topBrands.length > 0 ? row.topBrands : ['Unclassified Brand']).join(', ')}.`}
                        </p>
                      </div>
                    );
                    })}
                  </div>
                </div>
              </div>
            </article>
            </div>
          </div>
        ) : null}

      </div>
    </section>
  );
}


