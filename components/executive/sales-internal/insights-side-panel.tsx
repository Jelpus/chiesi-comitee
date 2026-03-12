import { ArrowUpRight, BriefcaseBusiness, Lightbulb, Target } from 'lucide-react';
import { formatSalesMetric } from '@/lib/format/sales-metric';
import type {
  SalesInternalBreakdownRow,
  SalesInternalDualKpisYoY,
  SalesInternalKpis,
  SalesMetricMode,
  SalesInternalTopProductRow,
} from '@/types/sales-internal';

type SalesInternalInsightsSidePanelProps = {
  kpis: SalesInternalKpis;
  channelBreakdown: SalesInternalBreakdownRow[];
  buBreakdown: SalesInternalBreakdownRow[];
  topProducts: SalesInternalTopProductRow[];
  metricMode: SalesMetricMode;
  dualKpisYoY: SalesInternalDualKpisYoY;
};

function formatPct(value: number | null) {
  if (value === null) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function growthClass(value: number | null) {
  if (value === null) return 'text-slate-600 bg-slate-100 border-slate-200';
  if (value >= 0) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
}

export function SalesInternalInsightsSidePanel({
  kpis,
  channelBreakdown,
  buBreakdown,
  topProducts,
  metricMode,
  dualKpisYoY,
}: SalesInternalInsightsSidePanelProps) {
  const topChannel = channelBreakdown[0];
  const topBu = buBreakdown[0];
  const topProduct = topProducts[0];
  const top3Value = topProducts.slice(0, 3).reduce((sum, item) => sum + item.actualValue, 0);
  const top3Share = kpis.totalActualValue > 0 ? (top3Value / kpis.totalActualValue) * 100 : 0;

  return (
    <aside className="sticky top-4 space-y-4 rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_34px_rgba(15,23,42,0.10)]">
      <header className="rounded-[16px] border border-slate-200/70 bg-slate-50/70 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Insights Panel</p>
        <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          {formatSalesMetric(kpis.totalActualValue, metricMode)}
        </p>
        <p className="mt-1 text-xs text-slate-600">Valor total del corte seleccionado.</p>
      </header>

      <section className="rounded-[18px] border border-slate-900/70 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow-[0_12px_30px_rgba(15,23,42,0.30)]">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-300" />
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">Executive Insights</h3>
        </div>

        <div className="mt-3 space-y-2.5">
          <div className="rounded-[12px] border border-slate-700 bg-slate-800/80 p-3">
            <p className="text-[11px] text-slate-300">Canal lider</p>
            <p className="mt-1 text-sm font-semibold">{topChannel?.label ?? '-'}</p>
            <p className="mt-1 text-xs text-slate-300">
              {formatSalesMetric(topChannel?.actualValue ?? 0, metricMode)}
            </p>
          </div>

          <div className="rounded-[12px] border border-slate-700 bg-slate-800/80 p-3">
            <p className="text-[11px] text-slate-300">Net Sales Growth</p>
            <p className={`mt-1 inline-flex rounded-full border px-2 py-1 text-sm font-semibold ${growthClass(dualKpisYoY.netSales.deltaPct)}`}>
              {formatPct(dualKpisYoY.netSales.deltaPct)}
            </p>
          </div>

          <div className="rounded-[12px] border border-slate-700 bg-slate-800/80 p-3">
            <p className="text-[11px] text-slate-300">Units Growth</p>
            <p className={`mt-1 inline-flex rounded-full border px-2 py-1 text-sm font-semibold ${growthClass(dualKpisYoY.units.deltaPct)}`}>
              {formatPct(dualKpisYoY.units.deltaPct)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[16px] border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-slate-700" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Executive Focus</h3>
        </div>
        <div className="mt-3 space-y-2 text-xs text-slate-700">
          <p className="rounded-[10px] border border-slate-200 bg-white px-2.5 py-2">
            Concentracion Top 3: <span className="font-semibold text-slate-900">{top3Share.toFixed(1)}%</span>
          </p>
          <p className="rounded-[10px] border border-slate-200 bg-white px-2.5 py-2">
            Foco de crecimiento: acelerar <span className="font-semibold text-slate-900">{topBu?.label ?? '-'}</span> y proteger share en{' '}
            <span className="font-semibold text-slate-900">{topChannel?.label ?? '-'}</span>.
          </p>
          <p className="rounded-[10px] border border-slate-200 bg-white px-2.5 py-2">
            Producto ancla: <span className="font-semibold text-slate-900">{topProduct?.canonicalProductName ?? '-'}</span>.
          </p>
        </div>
      </section>

      <section className="rounded-[16px] border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="h-4 w-4 text-slate-700" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Top Products</h3>
        </div>
        <div className="mt-3 space-y-2">
          {topProducts.slice(0, 5).map((item, index) => (
            <div
              key={item.productId}
              className="flex items-center justify-between rounded-[10px] border border-slate-200 bg-slate-50/60 px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-900">
                  {index + 1}. {item.canonicalProductName}
                </p>
                <p className="text-[11px] text-slate-500">{item.productId}</p>
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-1 text-[11px] font-semibold text-slate-700">
                {formatSalesMetric(item.actualValue, metricMode)}
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
