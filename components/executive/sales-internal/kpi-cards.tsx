import { Activity, Target, TrendingUp } from 'lucide-react';
import { formatSalesMetric } from '@/lib/format/sales-metric';
import type { SalesInternalBudgetDualKpis, SalesInternalDualKpisYoY, SalesMetricMode } from '@/types/sales-internal';

type SalesInternalKpiCardsProps = {
  dualKpisYoY: SalesInternalDualKpisYoY;
  budgetDualKpis: SalesInternalBudgetDualKpis;
  metricMode: SalesMetricMode;
};

type CardVariant = 'value' | 'units';

function formatDeltaPct(value: number | null) {
  if (value === null) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatCoveragePct(value: number | null) {
  if (value === null) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

function formatDeltaValue(value: number | null, mode: SalesMetricMode) {
  if (value === null) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatSalesMetric(Math.abs(value), mode)}`;
}

function trendTone(value: number | null) {
  if (value === null) return 'text-slate-600 bg-slate-100 border-slate-200';
  if (value >= 0) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
}

function coverageTone(value: number | null) {
  if (value === null) return 'text-slate-600 bg-slate-100 border-slate-200';
  if (value >= 1) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
}

function cardTheme(variant: CardVariant, active: boolean) {
  if (variant === 'value') {
    return {
      icon: Activity,
      iconTone: active ? 'text-blue-700 bg-blue-100 border-blue-200' : 'text-slate-500 bg-slate-100 border-slate-200',
      shell: active
        ? 'border-blue-300/90 bg-gradient-to-br from-blue-50 via-white to-indigo-50/40 shadow-[0_14px_34px_rgba(37,99,235,0.16)]'
        : 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/50 shadow-[0_10px_24px_rgba(15,23,42,0.08)]',
      glow: 'bg-blue-300/35',
    };
  }

  return {
    icon: Activity,
    iconTone: active ? 'text-cyan-700 bg-cyan-100 border-cyan-200' : 'text-slate-500 bg-slate-100 border-slate-200',
    shell: active
      ? 'border-cyan-300/90 bg-gradient-to-br from-cyan-50 via-white to-sky-50/40 shadow-[0_14px_34px_rgba(8,145,178,0.16)]'
      : 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/50 shadow-[0_10px_24px_rgba(15,23,42,0.08)]',
    glow: 'bg-cyan-300/35',
  };
}

type MetricHeroCardProps = {
  title: string;
  actual: number;
  ly: number | null;
  deltaPct: number | null;
  deltaValue: number | null;
  budget: number;
  variance: number | null;
  coveragePct: number | null;
  mode: SalesMetricMode;
  active: boolean;
  variant: CardVariant;
};

function MetricHeroCard({
  title,
  actual,
  ly,
  deltaPct,
  deltaValue,
  budget,
  variance,
  coveragePct,
  mode,
  active,
  variant,
}: MetricHeroCardProps) {
  const theme = cardTheme(variant, active);
  const Icon = theme.icon;

  return (
    <article className={`relative overflow-hidden rounded-[20px] border p-4 md:p-5 ${theme.shell}`}>
      <div className={`pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl ${theme.glow}`} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            {formatSalesMetric(actual, mode)}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${trendTone(deltaPct)}`}>
            <TrendingUp className="h-3 w-3" />
            YoY {formatDeltaPct(deltaPct)}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${coverageTone(coveragePct)}`}>
            <Target className="h-3 w-3" />
            Cov {formatCoveragePct(coveragePct)}
          </span>
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${theme.iconTone}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200/90 bg-white/90 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">vs Last Year</p>
          <p className="mt-1 text-xs text-slate-700">LY: <span className="font-semibold text-slate-900">{ly === null ? 'N/A' : formatSalesMetric(ly, mode)}</span></p>
          <p className="mt-0.5 text-xs text-slate-700">Delta: <span className="font-semibold text-slate-900">{formatDeltaValue(deltaValue, mode)}</span></p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white/90 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">vs Budget</p>
          <p className="mt-1 text-xs text-slate-700">Budget: <span className="font-semibold text-slate-900">{formatSalesMetric(budget, mode)}</span></p>
          <p className="mt-0.5 text-xs text-slate-700">Var: <span className="font-semibold text-slate-900">{formatDeltaValue(variance, mode)}</span></p>
        </div>
      </div>
    </article>
  );
}

export function SalesInternalKpiCards({ dualKpisYoY, budgetDualKpis, metricMode }: SalesInternalKpiCardsProps) {
  const netBudget = budgetDualKpis.netSales.budget;
  const netActual = dualKpisYoY.netSales.actual;
  const netCoveragePct = netBudget === 0 ? null : netActual / netBudget;
  const netVariance = netActual - netBudget;

  const unitsBudget = budgetDualKpis.units.budget;
  const unitsActual = dualKpisYoY.units.actual;
  const unitsCoveragePct = unitsBudget === 0 ? null : unitsActual / unitsBudget;
  const unitsVariance = unitsActual - unitsBudget;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <MetricHeroCard
        title="Actual Value (Net Sales)"
        actual={netActual}
        ly={dualKpisYoY.netSales.ly}
        deltaPct={dualKpisYoY.netSales.deltaPct}
        deltaValue={dualKpisYoY.netSales.delta}
        budget={netBudget}
        variance={netVariance}
        coveragePct={netCoveragePct}
        mode="currency"
        active={metricMode === 'currency'}
        variant="value"
      />

      <MetricHeroCard
        title="Actual Units"
        actual={unitsActual}
        ly={dualKpisYoY.units.ly}
        deltaPct={dualKpisYoY.units.deltaPct}
        deltaValue={dualKpisYoY.units.delta}
        budget={unitsBudget}
        variance={unitsVariance}
        coveragePct={unitsCoveragePct}
        mode="units"
        active={metricMode === 'units'}
        variant="units"
      />
    </div>
  );
}
