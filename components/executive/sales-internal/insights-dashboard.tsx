'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, Sparkles, Target, Trophy } from 'lucide-react';
import { formatSalesMetric } from '@/lib/format/sales-metric';
import type {
  SalesInternalBudgetBreakdownRow,
  SalesInternalBudgetMonthlyRow,
  SalesInternalBudgetProductVarianceRow,
  SalesInternalBreakdownRow,
  SalesInternalProductRow,
  SalesMetricMode,
  SalesInternalTopProductRow,
  SalesInternalTrendYoY,
} from '@/types/sales-internal';

type SalesInternalInsightsDashboardProps = {
  channelBreakdown: SalesInternalBreakdownRow[];
  buBreakdown: SalesInternalBreakdownRow[];
  topProducts: SalesInternalTopProductRow[];
  productDetails: SalesInternalProductRow[];
  metricMode: SalesMetricMode;
  trendYoY: SalesInternalTrendYoY;
  budgetProductTotals: SalesInternalBudgetProductVarianceRow[];
  budgetChannelBreakdown: SalesInternalBudgetBreakdownRow[];
  budgetMonthly: SalesInternalBudgetMonthlyRow[];
  budgetComparable: boolean;
};

const PIE_COLORS = ['#0f172a', '#f97316', '#0ea5e9', '#16a34a', '#a855f7', '#eab308'];

type DriverTab = 'channel' | 'distribution' | 'businessUnit' | 'portfolio' | 'brand' | 'sku';

type DriverRow = {
  key: string;
  label: string;
  subtitle: string;
  actualValue: number;
  lyValue: number | null;
  deltaValue: number | null;
  deltaPct: number | null;
  budgetValue: number | null;
  varianceVsBudget: number | null;
  coveragePct: number | null;
  productId?: string;
};

type ProductMeta = {
  canonicalProductName: string;
  brandName: string | null;
  portfolioName: string | null;
  businessUnitName: string | null;
};

function normalizeLabel(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : 'Unknown';
}

function formatDeltaPct(value: number | null) {
  if (value === null) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatBudgetCoveragePct(value: number | null) {
  if (value === null) return 'N/A';
  return `${(value * 100).toFixed(0)}%`;
}

function parsePeriod(dateString: string) {
  const [yearRaw, monthRaw] = dateString.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month) return null;
  return { year, month };
}

function monthLabel(month: number) {
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return labels[month - 1] ?? String(month);
}

function formatAxisMetric(value: number, metricMode: SalesMetricMode) {
  if (metricMode === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function getDriverKeyForRow(
  row: SalesInternalProductRow,
  tab: DriverTab,
  metadataByProduct: Map<string, ProductMeta>,
) {
  if (tab === 'channel') return normalizeLabel(row.channel);
  if (tab === 'distribution') return normalizeLabel(row.distributionChannelName || row.distributionChannel);
  if (tab === 'sku') return row.productId;
  if (tab === 'businessUnit') {
    const metadata = metadataByProduct.get(row.productId);
    return normalizeLabel(metadata?.businessUnitName || row.bu);
  }

  const metadata = metadataByProduct.get(row.productId);
  if (tab === 'portfolio') return normalizeLabel(metadata?.portfolioName);
  return normalizeLabel(metadata?.brandName);
}

export function SalesInternalInsightsDashboard({
  channelBreakdown,
  buBreakdown,
  topProducts,
  productDetails,
  metricMode,
  trendYoY,
  budgetProductTotals,
  budgetChannelBreakdown,
  budgetMonthly,
  budgetComparable,
}: SalesInternalInsightsDashboardProps) {
  const [activeTab, setActiveTab] = useState<DriverTab>('channel');
  const [selectedZoom, setSelectedZoom] = useState<{ tab: DriverTab; key: string } | null>(null);

  const metadataByProduct = useMemo(() => {
    const map = new Map<string, ProductMeta>();
    for (const item of topProducts) {
      map.set(item.productId, {
        canonicalProductName: item.canonicalProductName,
        brandName: item.brandName,
        portfolioName: item.portfolioName,
        businessUnitName: item.businessUnitName,
      });
    }
    return map;
  }, [topProducts]);

  const budgetByProduct = useMemo(() => {
    const map = new Map<string, SalesInternalBudgetProductVarianceRow>();
    for (const row of budgetProductTotals) {
      map.set(row.productId, row);
    }
    return map;
  }, [budgetProductTotals]);

  const trendGeneralSeries = useMemo(() => {
    const analysisYear = trendYoY.context.analysisYear;
    const cutoffMonth = trendYoY.context.cutoffMonth;
    if (!analysisYear || !cutoffMonth) {
      return trendYoY.points.map((point) => ({
        ...point,
        budgetValue: null as number | null,
        budgetRunRate: null as number | null,
      }));
    }

    const budgetByMonth = new Map<number, number>();
    for (const row of budgetMonthly) {
      const period = parsePeriod(row.periodMonth);
      if (!period) continue;
      if (period.year !== analysisYear) continue;
      if (period.month > cutoffMonth) continue;
      budgetByMonth.set(period.month, (budgetByMonth.get(period.month) ?? 0) + row.budgetValue);
    }

    const totalBudget = [...budgetByMonth.values()].reduce((sum, value) => sum + value, 0);
    const budgetRunRate = cutoffMonth > 0 ? totalBudget / cutoffMonth : null;

    return trendYoY.points.map((point) => ({
      ...point,
      budgetValue: budgetByMonth.get(point.month) ?? 0,
      budgetRunRate,
    }));
  }, [budgetMonthly, trendYoY.context.analysisYear, trendYoY.context.cutoffMonth, trendYoY.points]);

  const driverRows = useMemo<DriverRow[]>(() => {
    if (!trendYoY.context.analysisYear || !trendYoY.context.cutoffMonth || !trendYoY.context.lyYear) {
      const grouped = new Map<string, DriverRow>();
      for (const row of productDetails) {
        const key = getDriverKeyForRow(row, activeTab, metadataByProduct);
        const existing = grouped.get(key);
        if (!existing) {
          grouped.set(key, {
            key,
            label: activeTab === 'sku' ? row.canonicalProductName || row.productId : key,
            subtitle:
              activeTab === 'channel'
                ? 'Channel'
                : activeTab === 'distribution'
                  ? 'Distribution'
                  : activeTab === 'businessUnit'
                    ? 'Business Unit'
                    : activeTab === 'portfolio'
                      ? 'Portfolio'
                      : activeTab === 'brand'
                        ? 'Brand'
                        : row.productId,
            actualValue: row.actualValue,
            lyValue: null,
            deltaValue: null,
            deltaPct: null,
            budgetValue: null,
            varianceVsBudget: null,
            coveragePct: null,
            productId: activeTab === 'sku' ? row.productId : undefined,
          });
        } else {
          existing.actualValue += row.actualValue;
        }
      }
      return [...grouped.values()].sort((a, b) => b.actualValue - a.actualValue).slice(0, 10);
    }

    const analysisYear = trendYoY.context.analysisYear;
    const lyYear = trendYoY.context.lyYear;
    const cutoffMonth = trendYoY.context.cutoffMonth;
    const grouped = new Map<string, DriverRow>();

    for (const row of productDetails) {
      const period = parsePeriod(row.periodMonth);
      if (!period) continue;
      if (period.month > cutoffMonth) continue;
      if (period.year !== analysisYear && period.year !== lyYear) continue;

      const key = getDriverKeyForRow(row, activeTab, metadataByProduct);
      const existing = grouped.get(key);

      if (!existing) {
        const base: DriverRow = {
          key,
          label:
            activeTab === 'sku'
              ? row.canonicalProductName || row.productId
              : key,
          subtitle:
            activeTab === 'channel'
              ? 'Channel'
              : activeTab === 'distribution'
                ? 'Distribution'
                : activeTab === 'businessUnit'
                  ? 'Business Unit'
                  : activeTab === 'portfolio'
                    ? 'Portfolio'
                    : activeTab === 'brand'
                      ? 'Brand'
                      : row.productId,
          actualValue: period.year === analysisYear ? row.actualValue : 0,
          lyValue: period.year === lyYear ? row.actualValue : 0,
          deltaValue: null,
          deltaPct: null,
          budgetValue: null,
          varianceVsBudget: null,
          coveragePct: null,
          productId: activeTab === 'sku' ? row.productId : undefined,
        };
        grouped.set(key, base);
      } else {
        if (period.year === analysisYear) {
          existing.actualValue += row.actualValue;
        } else if (period.year === lyYear) {
          existing.lyValue = (existing.lyValue ?? 0) + row.actualValue;
        }
      }
    }

    for (const item of grouped.values()) {
      if (!trendYoY.context.hasLyData) {
        item.lyValue = null;
        item.deltaValue = null;
        item.deltaPct = null;
        continue;
      }
      const ly = item.lyValue ?? 0;
      item.deltaValue = item.actualValue - ly;
      item.deltaPct = ly === 0 ? null : ((item.actualValue - ly) / ly) * 100;
    }

    if (budgetComparable) {
      if (activeTab === 'sku') {
        for (const item of grouped.values()) {
          if (!item.productId) continue;
          const budgetRow = budgetByProduct.get(item.productId);
          if (!budgetRow) continue;
          item.budgetValue = budgetRow.budgetValue;
          item.varianceVsBudget = item.actualValue - budgetRow.budgetValue;
          item.coveragePct =
            budgetRow.budgetValue === 0 ? null : item.actualValue / budgetRow.budgetValue;
        }
      } else if (activeTab === 'channel') {
        const budgetByChannel = new Map<string, number>();
        for (const row of budgetChannelBreakdown) {
          budgetByChannel.set(row.label, row.budgetValue);
        }
        for (const item of grouped.values()) {
          const budget = budgetByChannel.get(item.key);
          if (budget === undefined) continue;
          item.budgetValue = budget;
          item.varianceVsBudget = item.actualValue - budget;
          item.coveragePct = budget === 0 ? null : item.actualValue / budget;
        }
      } else if (activeTab === 'businessUnit') {
        const budgetByBu = new Map<string, number>();
        for (const row of budgetProductTotals) {
          const meta = metadataByProduct.get(row.productId);
          const businessUnitName = normalizeLabel(meta?.businessUnitName || row.bu);
          budgetByBu.set(
            businessUnitName,
            (budgetByBu.get(businessUnitName) ?? 0) + row.budgetValue,
          );
        }
        for (const item of grouped.values()) {
          const budget = budgetByBu.get(item.key);
          if (budget === undefined) continue;
          item.budgetValue = budget;
          item.varianceVsBudget = item.actualValue - budget;
          item.coveragePct = budget === 0 ? null : item.actualValue / budget;
        }
      } else if (activeTab === 'brand' || activeTab === 'portfolio') {
        const groupBudget = new Map<string, number>();
        for (const row of budgetProductTotals) {
          const meta = metadataByProduct.get(row.productId);
          const key =
            activeTab === 'brand'
              ? normalizeLabel(meta?.brandName)
              : normalizeLabel(meta?.portfolioName);
          groupBudget.set(key, (groupBudget.get(key) ?? 0) + row.budgetValue);
        }
        for (const item of grouped.values()) {
          const budget = groupBudget.get(item.key);
          if (budget === undefined) continue;
          item.budgetValue = budget;
          item.varianceVsBudget = item.actualValue - budget;
          item.coveragePct = budget === 0 ? null : item.actualValue / budget;
        }
      }
    }

    return [...grouped.values()].sort((a, b) => b.actualValue - a.actualValue).slice(0, 10);
  }, [activeTab, metadataByProduct, productDetails, trendYoY.context.analysisYear, trendYoY.context.cutoffMonth, trendYoY.context.lyYear, trendYoY.context.hasLyData, budgetComparable, budgetByProduct, budgetProductTotals, budgetChannelBreakdown]);

  const effectiveSelectedZoom = useMemo(() => {
    if (driverRows.length === 0) return null;
    const hasCurrent =
      selectedZoom &&
      selectedZoom.tab === activeTab &&
      driverRows.some((item) => item.key === selectedZoom.key);
    if (hasCurrent) return selectedZoom;
    return { tab: activeTab, key: driverRows[0].key };
  }, [activeTab, driverRows, selectedZoom]);

  const selectedZoomLabel = useMemo(() => {
    if (!effectiveSelectedZoom || effectiveSelectedZoom.tab !== activeTab) return null;
    return driverRows.find((row) => row.key === effectiveSelectedZoom.key)?.label ?? null;
  }, [activeTab, driverRows, effectiveSelectedZoom]);

  const selectedSeries = useMemo(() => {
    if (!effectiveSelectedZoom || effectiveSelectedZoom.tab !== activeTab) return trendGeneralSeries;
    if (!trendYoY.context.analysisYear || !trendYoY.context.lyYear || !trendYoY.context.cutoffMonth) {
      return trendGeneralSeries;
    }
    const cutoffMonth = trendYoY.context.cutoffMonth;

    const grouped = new Map<string, number>();
    const groupedLy = new Map<string, number>();
    const groupedBudget = new Map<string, number>();
    for (const row of productDetails) {
      const period = parsePeriod(row.periodMonth);
      if (!period) continue;
      const rowKey = getDriverKeyForRow(row, activeTab, metadataByProduct);
      if (rowKey !== effectiveSelectedZoom.key) continue;
      if (period.month > cutoffMonth) continue;

      if (period.year === trendYoY.context.analysisYear) {
        const key = String(period.month);
        grouped.set(key, (grouped.get(key) ?? 0) + row.actualValue);
      }
      if (period.year === trendYoY.context.lyYear) {
        const key = String(period.month);
        groupedLy.set(key, (groupedLy.get(key) ?? 0) + row.actualValue);
      }
    }

    for (const row of budgetMonthly) {
      const period = parsePeriod(row.periodMonth);
      if (!period) continue;
      if (period.year !== trendYoY.context.analysisYear) continue;
      if (period.month > cutoffMonth) continue;

      const metadata = metadataByProduct.get(row.productId);
      const rowKey =
        activeTab === 'channel'
          ? normalizeLabel(row.channel)
          : activeTab === 'distribution'
            ? null
            : activeTab === 'businessUnit'
              ? normalizeLabel(metadata?.businessUnitName || row.bu)
              : activeTab === 'portfolio'
                ? normalizeLabel(metadata?.portfolioName)
                : activeTab === 'brand'
                  ? normalizeLabel(metadata?.brandName)
                  : row.productId;
      if (!rowKey || rowKey !== effectiveSelectedZoom.key) continue;

      const key = String(period.month);
      groupedBudget.set(key, (groupedBudget.get(key) ?? 0) + row.budgetValue);
    }

    const selectedBudgetTotal = [...groupedBudget.values()].reduce((sum, value) => sum + value, 0);
    const budgetRunRate = cutoffMonth > 0 ? selectedBudgetTotal / cutoffMonth : null;

    const series = Array.from({ length: cutoffMonth }, (_, index) => {
      const month = index + 1;
      const key = String(month);
      return {
        month,
        monthLabel: monthLabel(month),
        actualValue: grouped.get(key) ?? 0,
        lyValue: trendYoY.context.hasLyData ? (groupedLy.get(key) ?? 0) : null,
        budgetValue: groupedBudget.get(key) ?? 0,
        budgetRunRate,
      };
    });

    return series.length > 0 ? series : trendGeneralSeries;
  }, [activeTab, metadataByProduct, productDetails, effectiveSelectedZoom, trendGeneralSeries, trendYoY.context.analysisYear, trendYoY.context.cutoffMonth, trendYoY.context.lyYear, trendYoY.context.hasLyData, budgetMonthly]);

  const tabTitle =
    activeTab === 'channel'
      ? 'Channel'
      : activeTab === 'distribution'
        ? 'Distribution'
        : activeTab === 'businessUnit'
          ? 'Business Unit'
          : activeTab === 'portfolio'
            ? 'Portfolio'
            : activeTab === 'brand'
              ? 'Brand'
              : 'SKUs';

  const deltaTone = (value: number | null) => {
    if (value === null) return 'text-slate-600 bg-slate-100 border-slate-200';
    return value >= 0
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : 'text-rose-700 bg-rose-50 border-rose-200';
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-white to-blue-50/40 p-4 md:p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Sales by Channel</h2>
            <Sparkles className="h-4 w-4 text-blue-700" />
          </div>
          <div className="mt-4 h-[240px] sm:h-[260px] md:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelBreakdown}>
                <defs>
                  <linearGradient id="channelGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#475569" />
                <YAxis stroke="#475569" tickFormatter={(value) => formatAxisMetric(Number(value ?? 0), metricMode)} />
                <Tooltip
                  formatter={(value) => formatSalesMetric(Number(value ?? 0), metricMode)}
                  cursor={{ fill: '#eef2ff' }}
                />
                <Bar dataKey="actualValue" fill="url(#channelGradient)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-white to-emerald-50/40 p-4 md:p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Sales by Business Unit</h2>
            <Sparkles className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-4 h-[240px] sm:h-[260px] md:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={buBreakdown} dataKey="actualValue" nameKey="label" innerRadius={60} outerRadius={98}>
                  {buBreakdown.map((item, index) => (
                    <Cell key={`${item.label}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatSalesMetric(Number(value ?? 0), metricMode)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-white to-violet-50/40 p-4 md:p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Trend General</h2>
            <Sparkles className="h-4 w-4 text-violet-700" />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {trendYoY.context.analysisYear ? `YTD ${trendYoY.context.analysisYear}` : 'No data'}
            {trendYoY.context.hasLyData && trendYoY.context.lyYear ? ` vs LY ${trendYoY.context.lyYear}` : ' (no LY)'}
          </p>
          <div className="mt-3 h-[232px] sm:h-[248px] md:h-[262px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendGeneralSeries}>
                <defs>
                  <linearGradient id="trendActualFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#ddd6fe" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="trendLyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="monthLabel" stroke="#475569" />
                <YAxis stroke="#475569" tickFormatter={(value) => formatAxisMetric(Number(value ?? 0), metricMode)} />
                <Tooltip
                  formatter={(value) => formatSalesMetric(Number(value ?? 0), metricMode)}
                  cursor={{ stroke: '#c4b5fd' }}
                />
                <Legend verticalAlign="top" height={20} iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="actualValue" stroke="#7c3aed" fill="url(#trendActualFill)" strokeWidth={2.4} />
                {trendYoY.context.hasLyData ? (
                  <Area type="monotone" dataKey="lyValue" stroke="#2563eb" fill="url(#trendLyFill)" strokeWidth={2.2} />
                ) : null}
                <Line type="monotone" name="Budget" dataKey="budgetValue" stroke="#f97316" strokeWidth={2} dot={false} />
                <Line
                  type="monotone"
                  name="Budget Run Rate"
                  dataKey="budgetRunRate"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <article className="rounded-[24px] border border-slate-200/80 bg-white p-4 md:p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Top Drivers</h2>
          </div>

          <div className="flex flex-wrap items-center gap-1">

            <button
              type="button"
              onClick={() => setActiveTab('businessUnit')}
              className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${activeTab === 'businessUnit'
                  ? 'bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.35)]'
                  : 'border border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
            >
              Business Unit
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('portfolio')}
              className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${activeTab === 'portfolio'
                  ? 'bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.35)]'
                  : 'border border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
            >
              Portfolio
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('brand')}
              className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${activeTab === 'brand'
                  ? 'bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.35)]'
                  : 'border border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
            >
              Brand
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sku')}
              className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${activeTab === 'sku'
                  ? 'bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.35)]'
                  : 'border border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
            >
              SKUs
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('channel')}
              className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${activeTab === 'channel'
                  ? 'bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.35)]'
                  : 'border border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
            >
              Channel
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('distribution')}
              className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${activeTab === 'distribution'
                  ? 'bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.35)]'
                  : 'border border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
            >
              Distribution
            </button>


          </div>

        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="space-y-2">
            {driverRows.map((item, index) => {
              const isSelected =
                effectiveSelectedZoom?.tab === activeTab && effectiveSelectedZoom?.key === item.key;
              return (
                <div
                  key={item.key}
                  className={`rounded-[12px] border bg-white px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ${
                    isSelected ? 'border-slate-900' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {index + 1}. {item.label}
                      </p>
                      <p className="text-[11px] text-slate-500">{item.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedZoom({ tab: activeTab, key: item.key })}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                        isSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <Target className="h-3 w-3" />
                      Zoom
                    </button>
                  </div>

                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px]">
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                      Actual: <span className="font-semibold text-slate-800">{formatSalesMetric(item.actualValue, metricMode)}</span>
                    </p>
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                      LY: <span className="font-semibold text-slate-800">{item.lyValue === null ? 'N/A' : formatSalesMetric(item.lyValue, metricMode)}</span>
                    </p>
                    <p className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1 font-semibold ${deltaTone(item.deltaPct)}`}>
                      {item.deltaPct !== null && item.deltaPct >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {formatDeltaPct(item.deltaPct)}
                    </p>
                    {item.budgetValue !== null ? (
                      <p
                        className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1 font-semibold ${deltaTone(
                          item.coveragePct === null ? null : (item.coveragePct - 1) * 100,
                        )}`}
                      >
                        {`Bud ${formatBudgetCoveragePct(item.coveragePct)}`}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-[16px] border border-slate-200 bg-gradient-to-br from-slate-50/90 to-white p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Enriched Drivers</p>
            <p className="mt-1 text-xs font-semibold text-slate-700">{tabTitle}</p>
            <div className="mt-2 h-[260px] sm:h-[300px] md:h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={driverRows.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    stroke="#475569"
                    tickFormatter={(value) => formatAxisMetric(Number(value ?? 0), metricMode)}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis type="category" dataKey="label" width={118} stroke="#475569" tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value) => formatSalesMetric(Number(value ?? 0), metricMode)}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar name="Actual" dataKey="actualValue" fill="#0f172a" radius={[0, 6, 6, 0]} />
                  <Bar name="LY" dataKey="lyValue" fill="#2563eb" radius={[0, 6, 6, 0]} />
                  <Bar name="Budget" dataKey="budgetValue" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[16px] border border-slate-200 bg-white/90 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Micro Trend Zoom</p>
            <p className="mt-1 text-xs font-semibold text-slate-700">{selectedZoomLabel ?? 'No selection'}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-600">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-600" />Actual</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-900" />LY</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" />Budget</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-3 border-t-2 border-amber-500 border-dashed" />Budget run rate</span>
            </div>
            <div className="mt-2 h-[220px] sm:h-[240px] md:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={selectedSeries}>
                  <defs>
                    <linearGradient id="microTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="monthLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tickFormatter={(value) => formatAxisMetric(Number(value ?? 0), metricMode)} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value) => formatSalesMetric(Number(value ?? 0), metricMode)}
                    cursor={{ stroke: '#93c5fd' }}
                  />
                  <Area type="monotone" dataKey="actualValue" stroke="#2563eb" fill="url(#microTrendFill)" strokeWidth={2} />
                  {trendYoY.context.hasLyData ? (
                    <Area type="monotone" dataKey="lyValue" stroke="#0f172a" fillOpacity={0} strokeWidth={2} />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="budgetValue"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="budgetRunRate"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
