import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { PrivateSellOutBrandKpiGrid } from '@/components/executive/business-excellence/private-sell-out-brand-kpi-grid';
import { PrivateMarketGroupCharts } from '@/components/executive/business-excellence/private-market-group-charts';
import { PublicMarketGroupAnalysis } from '@/components/executive/business-excellence/public-market-group-analysis';
import { SectionHeader } from '@/components/ui/section-header';
import {
  getBusinessExcellenceAuditSources,
  getBusinessExcellenceLatestPeriod,
  getBusinessExcellencePrivateDddDimensionRanking,
  getBusinessExcellencePrivateBrandSpecialtySignals,
  getBusinessExcellenceBusinessUnitChannelRows,
  getBusinessExcellencePrivateChannelPerformance,
  getBusinessExcellencePublicMarketOverview,
  getBusinessExcellencePublicMarketChartPoints,
  getBusinessExcellencePublicDimensionRankingRows,
  getBusinessExcellencePublicMarketTopProducts,
  getBusinessExcellencePrivateManagers,
  getBusinessExcellencePrivateMarketChartPoints,
  getBusinessExcellencePrivatePrescriptionDimensionRanking,
  getBusinessExcellencePrivateWeeklyBenchmark,
  getBusinessExcellencePrivatePrescriptionsOverview,
  getBusinessExcellencePrivateSellOutMartRows,
  getBusinessExcellencePrivateSellOutMartSummary,
  getBusinessExcellencePrivateSellOutMartRowsByBrand,
  getBusinessExcellencePrivateProducts,
  getBusinessExcellencePrivateSellOutOverview,
  getBusinessExcellencePrivateTerritories,
} from '@/lib/data/business-excellence';
import { formatSalesMetric } from '@/lib/format/sales-metric';
import type {
  BusinessExcellenceAuditSource,
  BusinessExcellencePrivateDddDimensionRankingRow,
  BusinessExcellencePrivateBrandSpecialtySignal,
  BusinessExcellencePrivateChannelPerformance,
  BusinessExcellencePrivateManagerRow,
  BusinessExcellencePrivateMarketChartPoint,
  BusinessExcellencePrivatePrescriptionDimensionRankingRow,
  BusinessExcellencePrivatePrescriptionsOverview,
  BusinessExcellencePrivateWeeklyBenchmark,
  BusinessExcellencePrivateSellOutMartRow,
  BusinessExcellencePrivateSellOutMartSummary,
  BusinessExcellenceBusinessUnitChannelRow,
  BusinessExcellencePrivateProductRow,
  BusinessExcellencePrivateSellOutFilters,
  BusinessExcellencePrivateSellOutOverview,
  BusinessExcellencePrivateTerritoryRow,
  BusinessExcellencePublicMarketOverview,
  BusinessExcellencePublicDimensionRankingRow,
  BusinessExcellencePublicMarketChartPoint,
  BusinessExcellencePublicMarketTopProductRow,
} from '@/types/business-excellence';

export type BusinessExcellenceViewMode = 'insights' | 'scorecard' | 'dashboard' 

type SearchParams = {
  version?: string;
  pmmPeriodMonth?: string;
  pmmMarketGroup?: string;
  pmmManager?: string;
  pmmTerritory?: string;
  dashboardTab?: string;
  publicView?: string;
  marketView?: string;
  marketChannel?: string;
};

const sourceTables = [
  {
    name: 'Sell Out Privado',
    tableId: 'chiesi-committee.chiesi_committee_stg.vw_business_excellence_pmm_enriched',
    note: 'Vista enriquecida para el primer grupo de analisis, lista para leer mercado, manager, territorio y producto Chiesi.',
  },
  {
    name: 'Private Prescriptions',
    tableId: 'chiesi-committee.chiesi_committee_stg.vw_business_excellence_closeup_enriched',
    note: 'Main view for private prescriptions, specialty, market group, and product metadata.',
  },
  {
    name: 'Budget Sell Out',
    tableId: 'chiesi-committee.chiesi_committee_stg.vw_business_excellence_budget_sell_out_enriched',
    note: 'Capa presupuestaria enriquecida para contraste vs BDG cuando la corrida tenga filas vigentes.',
  },
];

const mappingTables = [
  'chiesi-committee.chiesi_committee_admin.pmm_product_mapping',
  'chiesi-committee.chiesi_committee_admin.closeup_product_mapping',
  'chiesi-committee.chiesi_committee_admin.sell_out_product_mapping',
  'chiesi-committee.chiesi_committee_admin.reporting_versions',
];

function getPrivateSellOutFilters(params: SearchParams): BusinessExcellencePrivateSellOutFilters {
  return {
    periodMonth: params.pmmPeriodMonth,
    marketGroup: params.pmmMarketGroup,
    manager: params.pmmManager,
    territory: params.pmmTerritory,
  };
}

function modeHref(mode: Exclude<BusinessExcellenceViewMode, 'landing'>, params: SearchParams) {
  const query = new URLSearchParams();
  if (params.version) query.set('version', params.version);
  const queryText = query.toString();
  return `/executive/business-excellence/${mode}${queryText ? `?${queryText}` : ''}`;
}

function dashboardTabHref(tab: 'market' | 'private' | 'public', params: SearchParams) {
  const query = new URLSearchParams();
  if (params.version) query.set('version', params.version);
  query.set('dashboardTab', tab);
  if (tab === 'public' && (params.publicView === 'mth' || params.publicView === 'ytd')) {
    query.set('publicView', params.publicView);
  }
  if (tab === 'market' && (params.marketView === 'mth' || params.marketView === 'ytd')) {
    query.set('marketView', params.marketView);
  }
  if (tab === 'market' && (params.marketChannel === 'private' || params.marketChannel === 'public' || params.marketChannel === 'total')) {
    query.set('marketChannel', params.marketChannel);
  }
  return `/executive/business-excellence/dashboard?${query.toString()}`;
}

function publicViewHref(view: 'ytd' | 'mth', params: SearchParams) {
  const query = new URLSearchParams();
  if (params.version) query.set('version', params.version);
  query.set('dashboardTab', 'public');
  query.set('publicView', view);
  return `/executive/business-excellence/dashboard?${query.toString()}`;
}

function marketViewHref(view: 'ytd' | 'mth', params: SearchParams) {
  const query = new URLSearchParams();
  if (params.version) query.set('version', params.version);
  query.set('dashboardTab', 'market');
  query.set('marketView', view);
  if (params.marketChannel === 'private' || params.marketChannel === 'public' || params.marketChannel === 'total') {
    query.set('marketChannel', params.marketChannel);
  }
  return `/executive/business-excellence/dashboard?${query.toString()}`;
}

function marketChannelHref(channel: 'total' | 'private' | 'public', params: SearchParams) {
  const query = new URLSearchParams();
  if (params.version) query.set('version', params.version);
  query.set('dashboardTab', 'market');
  query.set('marketChannel', channel);
  if (params.marketView === 'mth' || params.marketView === 'ytd') {
    query.set('marketView', params.marketView);
  }
  return `/executive/business-excellence/dashboard?${query.toString()}`;
}

function formatPeriod(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function formatPeriodTag(value: string | null | undefined) {
  if (!value) return 'N/A';
  const raw = String(value).trim();
  if (!raw) return 'N/A';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00Z`) : new Date(raw);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function resolveHeaderAuditContext(rows: BusinessExcellenceAuditSource[]) {
  const reportPeriodMonth =
    rows.map((row) => row.reportPeriodMonth).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const sourceAsOfMonth =
    rows.map((row) => row.sourceAsOfMonth).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  return { reportPeriodMonth, sourceAsOfMonth };
}

function resolveDddSourceAsOfMonth(rows: BusinessExcellenceAuditSource[]) {
  const dddRow = rows.find((row) => row.sourceKey === 'pmm');
  if (dddRow?.sourceAsOfMonth) return dddRow.sourceAsOfMonth;
  return null;
}

function formatShortPeriod(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(date).toUpperCase();
}

function formatRecetas(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercentNumber(value: number | null, digits = 0) {
  if (value === null) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

function formatIndex(value: number | null) {
  if (value === null) return 'N/A';
  return value.toFixed(0);
}

function heatTone(value: number | null, type: 'growth' | 'coverage' | 'share' | 'index') {
  if (value === null) return 'bg-slate-100 text-slate-500';
  if (type === 'coverage') {
    if (value >= 100) return 'bg-emerald-200/70 text-emerald-950';
    if (value >= 85) return 'bg-amber-200/70 text-amber-950';
    return 'bg-rose-200/70 text-rose-950';
  }
  if (type === 'index') {
    if (value >= 105) return 'bg-emerald-200/70 text-emerald-950';
    if (value >= 95) return 'bg-amber-200/70 text-amber-950';
    return 'bg-rose-200/70 text-rose-950';
  }
  if (type === 'share') {
    if (value >= 15) return 'bg-emerald-200/70 text-emerald-950';
    if (value >= 5) return 'bg-amber-200/70 text-amber-950';
    return 'bg-rose-200/70 text-rose-950';
  }
  if (value >= 0) return 'bg-emerald-200/70 text-emerald-950';
  if (value >= -5) return 'bg-amber-200/70 text-amber-950';
  return 'bg-rose-200/70 text-rose-950';
}

function cardTone(tone: 'emerald' | 'blue' | 'amber' | 'slate') {
  if (tone === 'emerald') return 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-lime-50/60';
  if (tone === 'blue') return 'border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50/60';
  if (tone === 'amber') return 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50/60';
  return 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/60';
}

function ModeTabs({ active, params }: { active: BusinessExcellenceViewMode; params: SearchParams }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(['insights', 'scorecard', 'dashboard'] as const).map((mode) => {
        const isActive = active === mode;
        return (
          <Link
            key={mode}
            href={modeHref(mode, params)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
              isActive
                ? 'bg-slate-900 text-white shadow-[0_8px_22px_rgba(15,23,42,0.35)]'
                : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
            }`}
          >
            {mode}
          </Link>
        );
      })}
    </div>
  );
}

function LandingContent() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Aligned Sources</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Business Excellence</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          The dashboard now uses enriched views for Private Sell Out, Private Prescriptions, and Budget Sell Out.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sourceTables.map((table) => (
            <div key={table.tableId} className="rounded-[16px] border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{table.name}</p>
              <p className="mt-2 font-mono text-xs text-slate-800">{table.tableId}</p>
              <p className="mt-2 text-sm text-slate-600">{table.note}</p>
            </div>
          ))}
        </div>
      </article>

      <div className="space-y-4">
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Mappings And Metadata</p>
          <div className="mt-3 space-y-2">
            {mappingTables.map((tableId) => (
              <div key={tableId} className="rounded-[14px] border border-slate-200 bg-slate-50/70 px-3 py-2">
                <p className="font-mono text-xs text-slate-800">{tableId}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[24px] border border-cyan-200/80 bg-cyan-50/70 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-800">Dashboard Focus</p>
          <p className="mt-2 text-sm text-cyan-950">
            Mercados, productos Chiesi, managers, territorios y comparativos mensuales sobre fuentes enriquecidas.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/executive/business-excellence/dashboard"
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white"
            >
              Open Dashboard
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
        {description ? <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function HeroMetricCard({
  eyebrow,
  title,
  value,
  helper,
  tone,
}: {
  eyebrow: string;
  title: string;
  value: string;
  helper: string;
  tone: 'emerald' | 'blue' | 'amber' | 'slate';
}) {
  return (
    <article className={`rounded-[20px] border p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)] ${cardTone(tone)}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{title}</p>
      <p className="mt-2 text-sm text-slate-600">{helper}</p>
    </article>
  );
}

function FieldForceCoverageCard() {
  return (
    <article className={`rounded-[20px] border p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)] ${cardTone('slate')}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Field Force Coverage</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">47%</p>
      <p className="mt-1 text-sm font-medium text-slate-700">IE - MTH 105 | Q 81</p>
      <p className="mt-2 text-sm text-slate-600">HCP's impact</p>
    </article>
  );
}

function TopListTable({
  title,
  rows,
  valueLabel,
  secondaryLabel,
  renderPrimary,
  renderSecondary,
}: {
  title: string;
  rows: Array<{ label: string; primary: number; secondary?: number | null }>;
  valueLabel: string;
  secondaryLabel?: string;
  renderPrimary: (value: number) => string;
  renderSecondary?: (value: number | null | undefined) => string;
}) {
  return (
    <article className="rounded-[20px] border border-slate-200 bg-slate-50/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">{title}</p>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{valueLabel}</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-[15px]">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
              <th className="pb-2 font-medium">Label</th>
              <th className="pb-2 font-medium text-right">{valueLabel}</th>
              {secondaryLabel ? <th className="pb-2 font-medium text-right">{secondaryLabel}</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-slate-100 last:border-b-0">
                <td className="py-2.5 font-medium text-slate-900">{row.label}</td>
                <td className="py-2.5 text-right font-semibold text-slate-900">{renderPrimary(row.primary)}</td>
                {secondaryLabel ? (
                  <td className="py-2.5 text-right text-slate-700">
                    {renderSecondary ? renderSecondary(row.secondary) : compactNumber(row.secondary ?? 0)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function DashboardTopCards({
  martSummary,
  overview,
  prescriptionsOverview,
  publicOverview,
}: {
  martSummary: BusinessExcellencePrivateSellOutMartSummary | null;
  overview: {
    ytdNetSales: number;
    ytdUnits: number;
  };
  prescriptionsOverview: BusinessExcellencePrivatePrescriptionsOverview | null;
  publicOverview: BusinessExcellencePublicMarketOverview | null;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article className={`rounded-[20px] border p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)] ${cardTone('blue')}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total Private Sellout YTD</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Net Sales</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              {formatSalesMetric(martSummary?.ytdNetSales ?? overview.ytdNetSales, 'currency')}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Units</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              {formatSalesMetric(martSummary?.ytdUnits ?? overview.ytdUnits, 'units')}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">Chiesi Porfolio performance Private Market Sellout</p>
      </article>

      <article className={`rounded-[20px] border p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)] ${cardTone('amber')}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total Private Prescriptions YTD</p>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Prescriptions</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            {formatRecetas(prescriptionsOverview?.ytdRecetas ?? 0)}
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-600">Chiesi Portfolio performance Private Market Prescriptions</p>
      </article>

      <article className={`rounded-[20px] border p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)] ${cardTone('emerald')}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total Public Sell Out YTD</p>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Units</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            {formatSalesMetric(publicOverview?.ytdPieces ?? 0, 'units')}
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-600">Public market mapped products performance</p>
      </article>

      <FieldForceCoverageCard />
    </div>
  );
}

function AuditSourcesPanel({ rows }: { rows: BusinessExcellenceAuditSource[] }) {
  return (
    <SectionCard
      eyebrow="Audit Context"
      title="Reporting Version Scope"
      description="La lectura del dashboard sigue la version seleccionada en Executive Home y expone periodo de reporte y fecha de actualizacion por fuente."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.sourceKey} className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{row.sourceLabel}</p>
            <div className="mt-3 space-y-2 text-base text-slate-700">
              <p>Reporting Version: {row.reportingVersionId}</p>
              <p>Report Period: {row.reportPeriodMonth ? formatPeriod(row.reportPeriodMonth) : 'N/A'}</p>
              <p>Source As Of: {row.sourceAsOfMonth ? formatPeriod(row.sourceAsOfMonth) : 'N/A'}</p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function SellOutPrivadoPanel({
  overview,
  sourceAsOfMonth,
  martSummary,
  martRows,
  chartPoints,
  dddRankingRows,
  prescriptionRankingRows,
  weeklyBenchmark,
  selectedFilters,
}: {
  overview: BusinessExcellencePrivateSellOutOverview;
  sourceAsOfMonth: string | null;
  martSummary: BusinessExcellencePrivateSellOutMartSummary | null;
  martRows: BusinessExcellencePrivateSellOutMartRow[];
  chartPoints: BusinessExcellencePrivateMarketChartPoint[];
  dddRankingRows: BusinessExcellencePrivateDddDimensionRankingRow[];
  prescriptionRankingRows: BusinessExcellencePrivatePrescriptionDimensionRankingRow[];
  weeklyBenchmark: BusinessExcellencePrivateWeeklyBenchmark | null;
  selectedFilters: BusinessExcellencePrivateSellOutFilters;
}) {
  return (
    <SectionCard
      eyebrow="Private Sell Out"
      title="Private Sell Out"
      description="Audit sources aligned view of Private Sell Out performance: Auidit Soruces DDD and Closeup"
    >
      <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4 text-base text-slate-700">
        <p>
          <span className="font-medium text-slate-900">Report Period:</span>{' '}
          {overview.reportPeriodMonth ? formatPeriod(overview.reportPeriodMonth) : 'N/A'}
        </p>
        <p className="mt-1">
          <span className="font-medium text-slate-900">Source As Of:</span>{' '}
          {sourceAsOfMonth ? formatPeriod(sourceAsOfMonth) : 'N/A'}
        </p>
      </div>

      {martSummary ? (
        <div className="mt-4 rounded-[18px] border border-indigo-200 bg-indigo-50/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Analytical Base (Mart)</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <div className="rounded-[14px] border border-indigo-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">YTD Units</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">{formatSalesMetric(martSummary.ytdUnits, 'units')}</p>
              <p className="mt-1 text-sm text-slate-600">MTH: {formatSalesMetric(martSummary.mthUnits, 'units')}</p>
            </div>
            <div className="rounded-[14px] border border-indigo-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">YTD Net Sales</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">{formatSalesMetric(martSummary.ytdNetSales, 'currency')}</p>
              <p className="mt-1 text-sm text-slate-600">MTH: {formatSalesMetric(martSummary.mthNetSales, 'currency')}</p>
            </div>
            <div className="rounded-[14px] border border-indigo-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">YTD Rx</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">{formatRecetas(martSummary.ytdRx)}</p>
              <p className="mt-1 text-sm text-slate-600">MTH: {formatRecetas(martSummary.mthRx)}</p>
            </div>
          </div>
        </div>
      ) : null}

      {martRows.length > 0 ? <PrivateSellOutBrandKpiGrid rows={martRows} /> : null}

      {chartPoints.length > 0 ? (
        <PrivateMarketGroupCharts
          rows={chartPoints}
          dddRankingRows={dddRankingRows}
          prescriptionRankingRows={prescriptionRankingRows}
          weeklyBenchmark={weeklyBenchmark}
          initialMarketGroup={selectedFilters.marketGroup}
        />
      ) : null}
    </SectionCard>
  );
}

function DashboardPerformanceTabs({
  active,
  params,
}: {
  active: 'market' | 'private' | 'public';
  params: SearchParams;
}) {
  const items = [
    { key: 'market', label: 'Market Performance' },
    { key: 'private', label: 'Private Performance' },
    { key: 'public', label: 'Public Performance' },
  ] as const;
  return (
    <div className="rounded-[16px] border border-slate-200 bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={dashboardTabHref(item.key, params)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                isActive ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function PublicPerformancePanel({
  overview,
  topProducts,
  chartRows,
  rankingRows,
  error,
  reportPeriodMonth,
  sourceAsOfMonth,
  activeView,
  params,
}: {
  overview: BusinessExcellencePublicMarketOverview | null;
  topProducts: BusinessExcellencePublicMarketTopProductRow[];
  chartRows: BusinessExcellencePublicMarketChartPoint[];
  rankingRows: BusinessExcellencePublicDimensionRankingRow[];
  error: string | null;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  activeView: 'ytd' | 'mth';
  params: SearchParams;
}) {
  const displayRows = topProducts
    .map((row) => {
      const units = activeView === 'ytd' ? row.ytdPieces : row.mthPieces;
      const budgetUnits = activeView === 'ytd' ? row.ytdBudgetUnits : row.mthBudgetUnits;
      const growthPct = activeView === 'ytd' ? row.ytdGrowthPct : row.mthGrowthPct;
      const msPct = activeView === 'ytd' ? row.ytdMsPct : row.mthMsPct;
      const evolutionIndex = activeView === 'ytd' ? row.ytdEvolutionIndex : row.mthEvolutionIndex;
      const coveragePct = activeView === 'ytd' ? row.ytdCoverageVsBudgetPct : row.mthCoverageVsBudgetPct;
      return {
        label: `${row.marketGroup ?? 'No Market'} - ${row.brandName}`,
        units,
        budgetUnits,
        growthPct,
        msPct,
        evolutionIndex,
        coveragePct,
      };
    });
  const triplesRows = topProducts.filter(
    (row) => isTriplesDoseMarketGroup(row.marketGroup) && isTrimbowBrand(row.brandName),
  );
  const triplesSyntheticRow =
    triplesRows.length > 0
      ? (() => {
          const units = triplesRows.reduce(
            (sum, row) => sum + (activeView === 'ytd' ? row.ytdPieces : row.mthPieces),
            0,
          );
          const unitsPy = triplesRows.reduce(
            (sum, row) => sum + (activeView === 'ytd' ? row.ytdPiecesPy : row.mthPiecesPy),
            0,
          );
          const budgetUnits = triplesRows.reduce(
            (sum, row) => sum + (activeView === 'ytd' ? row.ytdBudgetUnits : row.mthBudgetUnits),
            0,
          );
          return {
            label: `${TRIPLES_TOTAL_TRIMBOW_LABEL} - Trimbow`,
            units,
            budgetUnits,
            growthPct: unitsPy > 0 ? ((units - unitsPy) / unitsPy) * 100 : null,
            msPct: null,
            evolutionIndex: null,
            coveragePct: budgetUnits > 0 ? (units / budgetUnits) * 100 : null,
          };
        })()
      : null;
  const sortedDisplayRows = (triplesSyntheticRow ? [...displayRows, triplesSyntheticRow] : displayRows)
    .sort((a, b) => b.units - a.units);

  return (
    <SectionCard
      eyebrow="Public Performance"
      title="Public Market"
      description="Base analitica en GOB360 (PC/SC) con enriquecimiento de CLAVE mapping y metadata de producto."
    >
      {error ? (
        <div className="rounded-[12px] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Public data note: {error}
        </div>
      ) : null}

      <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4 text-base text-slate-700">
        <p>
          <span className="font-medium text-slate-900">Report Period:</span>{' '}
          {reportPeriodMonth ? formatPeriod(reportPeriodMonth) : overview?.latestDate ? formatPeriod(overview.latestDate) : 'N/A'}
        </p>
        <p className="mt-1">
          <span className="font-medium text-slate-900">Source As Of:</span>{' '}
          {sourceAsOfMonth ? formatPeriod(sourceAsOfMonth) : overview?.latestDate ? formatPeriod(overview.latestDate) : 'N/A'}
        </p>
      </div>

      <div className="mt-4 rounded-[18px] border border-indigo-200 bg-indigo-50/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Analytical Base (Public)</p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div className="rounded-[14px] border border-indigo-200 bg-white p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">YTD Pieces</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">
              {new Intl.NumberFormat('en-US').format(overview?.ytdPieces ?? 0)}
            </p>
            <p className="mt-1 text-sm text-slate-600">Growth vs PY: {formatPercentNumber(overview?.ytdGrowthPct ?? null, 1)}</p>
          </div>
          <div className="rounded-[14px] border border-indigo-200 bg-white p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">MTH Pieces</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">
              {new Intl.NumberFormat('en-US').format(overview?.mthPieces ?? 0)}
            </p>
            <p className="mt-1 text-sm text-slate-600">Growth vs PY: {formatPercentNumber(overview?.mthGrowthPct ?? null, 1)}</p>
          </div>
          <div className="rounded-[14px] border border-indigo-200 bg-white p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">YTD Active CLUE</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">
              {new Intl.NumberFormat('en-US').format(overview?.cluesActive ?? 0)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              CLUE Coverage: {new Intl.NumberFormat('en-US').format(overview?.chiesiCluesActiveYtd ?? 0)}
              {' / '}
              {new Intl.NumberFormat('en-US').format(overview?.cluesTotalYtd ?? 0)}
              {overview?.chiesiClueCoveragePct === null || overview?.chiesiClueCoveragePct === undefined
                ? ''
                : ` (${overview.chiesiClueCoveragePct.toFixed(1)}%)`}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            Brand KPI Grid (Public Market)
          </p>
          <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
            <Link
              href={publicViewHref('ytd', params)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                activeView === 'ytd' ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              YTD
            </Link>
            <Link
              href={publicViewHref('mth', params)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                activeView === 'mth' ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              MTH
            </Link>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-[15px]">
            <thead>
              <tr>
                <th className="border-b border-slate-200 pb-2 text-left text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Market Group - Brand</th>
                <th className="border-b border-slate-200 pb-2 text-right text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Budget Units</th>
                <th className="border-b border-slate-200 pb-2 text-right text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Units</th>
                <th className="border-b border-slate-200 pb-2 text-right text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Growth vs PY</th>
                <th className="border-b border-slate-200 pb-2 text-right text-xs font-medium uppercase tracking-[0.14em] text-slate-500">MS% (% of market)</th>
                <th className="border-b border-slate-200 pb-2 text-right text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Evolution Index</th>
                <th className="border-b border-slate-200 pb-2 text-right text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Coverage vs Budget (%)</th>
              </tr>
            </thead>
            <tbody>
              {sortedDisplayRows.map((row) => (
                <tr key={row.label} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-2.5 text-slate-800">{row.label}</td>
                  <td className="py-2.5 text-right text-slate-900">
                    {new Intl.NumberFormat('en-US').format(row.budgetUnits)}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-900">
                    {new Intl.NumberFormat('en-US').format(row.units)}
                  </td>
                  <td className={`py-2.5 text-right font-semibold ${row.growthPct === null ? 'text-slate-500' : row.growthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatPercentNumber(row.growthPct, 1)}
                  </td>
                  <td className="py-2.5 text-right text-slate-900">
                    {row.msPct === null ? 'N/A' : `${row.msPct.toFixed(1)}%`}
                  </td>
                  <td className={`py-2.5 text-right font-semibold ${row.evolutionIndex === null ? 'text-slate-500' : row.evolutionIndex >= 100 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {row.evolutionIndex === null ? 'N/A' : row.evolutionIndex}
                  </td>
                  <td className={`py-2.5 text-right font-semibold ${row.coveragePct === null ? 'text-slate-500' : row.coveragePct >= 100 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {row.coveragePct === null ? 'N/A' : `${row.coveragePct.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
              {sortedDisplayRows.length === 0 ? (
                <tr>
                  <td className="py-2 text-slate-500" colSpan={7}>No mapped public-market rows yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <PublicMarketGroupAnalysis rows={topProducts} chartRows={chartRows} rankingRows={rankingRows} />
    </SectionCard>
  );
}

function MarketPerformancePanel({
  privateSummary,
  privateRows,
  publicOverview,
  publicRows,
  businessUnitRows,
  publicError,
  activeView,
  activeChannel,
  params,
}: {
  privateSummary: BusinessExcellencePrivateSellOutMartSummary | null;
  privateRows: BusinessExcellencePrivateSellOutMartRow[];
  publicOverview: BusinessExcellencePublicMarketOverview | null;
  publicRows: BusinessExcellencePublicMarketTopProductRow[];
  businessUnitRows: BusinessExcellenceBusinessUnitChannelRow[];
  publicError: string | null;
  activeView: 'ytd' | 'mth';
  activeChannel: 'total' | 'private' | 'public';
  params: SearchParams;
}) {
  const privateByMarket = new Map<
    string,
    {
      privateYtdUnits: number;
      privateYtdUnitsPy: number;
      privateYtdBudgetUnits: number;
      privateMthUnits: number;
      privateMthUnitsPy: number;
      privateMthBudgetUnits: number;
    }
  >();
  for (const row of privateRows) {
    const marketGroup = row.marketGroup ?? 'No Market';
    const current = privateByMarket.get(marketGroup) ?? {
      privateYtdUnits: 0,
      privateYtdUnitsPy: 0,
      privateYtdBudgetUnits: 0,
      privateMthUnits: 0,
      privateMthUnitsPy: 0,
      privateMthBudgetUnits: 0,
    };
    current.privateYtdUnits += row.ytdUnits;
    current.privateYtdUnitsPy += row.ytdUnitsPy;
    current.privateYtdBudgetUnits += row.budgetYtdUnits;
    current.privateMthUnits += row.mthUnits;
    current.privateMthUnitsPy += row.mthUnitsPy;
    current.privateMthBudgetUnits += row.budgetMthUnits;
    privateByMarket.set(marketGroup, current);
  }

  const publicByMarket = new Map(
    publicRows.map((row) => [row.marketGroup ?? 'No Market', row]),
  );
  const allMarketGroups = new Set<string>([
    ...[...privateByMarket.keys()],
    ...[...publicByMarket.keys()],
  ]);

  const marketMergeRows = [...allMarketGroups]
    .map((marketGroup) => {
      const privateValue = privateByMarket.get(marketGroup) ?? {
        privateYtdUnits: 0,
        privateYtdUnitsPy: 0,
        privateYtdBudgetUnits: 0,
        privateMthUnits: 0,
        privateMthUnitsPy: 0,
        privateMthBudgetUnits: 0,
      };
      const publicValue = publicByMarket.get(marketGroup);

      const publicYtdUnits = publicValue?.ytdPieces ?? 0;
      const publicYtdUnitsPy = publicValue?.ytdPiecesPy ?? 0;
      const publicYtdBudgetUnits = publicValue?.ytdBudgetUnits ?? 0;
      const publicMthUnits = publicValue?.mthPieces ?? 0;
      const publicMthUnitsPy = publicValue?.mthPiecesPy ?? 0;
      const publicMthBudgetUnits = publicValue?.mthBudgetUnits ?? 0;

      const totalYtdUnits = privateValue.privateYtdUnits + publicYtdUnits;
      const totalYtdUnitsPy = privateValue.privateYtdUnitsPy + publicYtdUnitsPy;
      const totalYtdBudgetUnits = privateValue.privateYtdBudgetUnits + publicYtdBudgetUnits;
      const totalMthUnits = privateValue.privateMthUnits + publicMthUnits;
      const totalMthUnitsPy = privateValue.privateMthUnitsPy + publicMthUnitsPy;
      const totalMthBudgetUnits = privateValue.privateMthBudgetUnits + publicMthBudgetUnits;

      const privateYtdGrowthPct =
        privateValue.privateYtdUnitsPy > 0
          ? ((privateValue.privateYtdUnits - privateValue.privateYtdUnitsPy) / privateValue.privateYtdUnitsPy) * 100
          : null;
      const privateMthGrowthPct =
        privateValue.privateMthUnitsPy > 0
          ? ((privateValue.privateMthUnits - privateValue.privateMthUnitsPy) / privateValue.privateMthUnitsPy) * 100
          : null;
      const totalYtdGrowthPct =
        totalYtdUnitsPy > 0 ? ((totalYtdUnits - totalYtdUnitsPy) / totalYtdUnitsPy) * 100 : null;
      const totalMthGrowthPct =
        totalMthUnitsPy > 0 ? ((totalMthUnits - totalMthUnitsPy) / totalMthUnitsPy) * 100 : null;

      return {
        marketGroup,
        privateYtdUnits: privateValue.privateYtdUnits,
        privateYtdGrowthPct,
        privateYtdBudgetUnits: privateValue.privateYtdBudgetUnits,
        privateYtdCoveragePct:
          privateValue.privateYtdBudgetUnits > 0
            ? (privateValue.privateYtdUnits / privateValue.privateYtdBudgetUnits) * 100
            : null,
        publicYtdUnits,
        publicYtdGrowthPct: publicValue?.ytdGrowthPct ?? null,
        publicYtdBudgetUnits,
        publicYtdCoveragePct: publicValue?.ytdCoverageVsBudgetPct ?? null,
        totalYtdUnits,
        totalYtdGrowthPct,
        totalYtdBudgetUnits,
        totalYtdCoveragePct:
          totalYtdBudgetUnits > 0 ? (totalYtdUnits / totalYtdBudgetUnits) * 100 : null,
        privateMthUnits: privateValue.privateMthUnits,
        privateMthGrowthPct,
        privateMthBudgetUnits: privateValue.privateMthBudgetUnits,
        privateMthCoveragePct:
          privateValue.privateMthBudgetUnits > 0
            ? (privateValue.privateMthUnits / privateValue.privateMthBudgetUnits) * 100
            : null,
        publicMthUnits,
        publicMthGrowthPct: publicValue?.mthGrowthPct ?? null,
        publicMthBudgetUnits,
        publicMthCoveragePct: publicValue?.mthCoverageVsBudgetPct ?? null,
        totalMthUnits,
        totalMthGrowthPct,
        totalMthBudgetUnits,
        totalMthCoveragePct:
          totalMthBudgetUnits > 0 ? (totalMthUnits / totalMthBudgetUnits) * 100 : null,
      };
    })
    .sort((a, b) => b.totalYtdUnits - a.totalYtdUnits);

  const buRows = businessUnitRows
    .map((row) => ({
      businessUnitName: row.businessUnitName,
      privateUnits: activeView === 'ytd' ? row.privateYtdUnits : row.privateMthUnits,
      privateBudgetUnits: activeView === 'ytd' ? row.privateYtdBudgetUnits : row.privateMthBudgetUnits,
      privateCoveragePct: activeView === 'ytd' ? row.privateYtdCoveragePct : row.privateMthCoveragePct,
      publicUnits: activeView === 'ytd' ? row.publicYtdUnits : row.publicMthUnits,
      publicBudgetUnits: activeView === 'ytd' ? row.publicYtdBudgetUnits : row.publicMthBudgetUnits,
      publicCoveragePct: activeView === 'ytd' ? row.publicYtdCoveragePct : row.publicMthCoveragePct,
      totalUnits: activeView === 'ytd' ? row.totalYtdUnits : row.totalMthUnits,
      totalBudgetUnits: activeView === 'ytd' ? row.totalYtdBudgetUnits : row.totalMthBudgetUnits,
      totalCoveragePct: activeView === 'ytd' ? row.totalYtdCoveragePct : row.totalMthCoveragePct,
      privateGrowthPct:
        (activeView === 'ytd' ? row.privateYtdUnitsPy : row.privateMthUnitsPy) > 0
          ? (((activeView === 'ytd' ? row.privateYtdUnits : row.privateMthUnits)
            - (activeView === 'ytd' ? row.privateYtdUnitsPy : row.privateMthUnitsPy))
            / (activeView === 'ytd' ? row.privateYtdUnitsPy : row.privateMthUnitsPy)) * 100
          : null,
      publicGrowthPct:
        (activeView === 'ytd' ? row.publicYtdUnitsPy : row.publicMthUnitsPy) > 0
          ? (((activeView === 'ytd' ? row.publicYtdUnits : row.publicMthUnits)
            - (activeView === 'ytd' ? row.publicYtdUnitsPy : row.publicMthUnitsPy))
            / (activeView === 'ytd' ? row.publicYtdUnitsPy : row.publicMthUnitsPy)) * 100
          : null,
      totalGrowthPct:
        (activeView === 'ytd' ? row.totalYtdUnitsPy : row.totalMthUnitsPy) > 0
          ? (((activeView === 'ytd' ? row.totalYtdUnits : row.totalMthUnits)
            - (activeView === 'ytd' ? row.totalYtdUnitsPy : row.totalMthUnitsPy))
            / (activeView === 'ytd' ? row.totalYtdUnitsPy : row.totalMthUnitsPy)) * 100
          : null,
    }))
    .sort((a, b) => b.totalUnits - a.totalUnits);

  const referenceBrandByMarket = new Map<string, { brandName: string; units: number }>();
  for (const row of privateRows) {
    const marketGroup = row.marketGroup ?? 'No Market';
    const units = activeView === 'ytd' ? row.ytdUnits : row.mthUnits;
    const current = referenceBrandByMarket.get(marketGroup);
    if (!current || units > current.units) {
      referenceBrandByMarket.set(marketGroup, { brandName: row.brandName, units });
    }
  }
  for (const row of publicRows) {
    const marketGroup = row.marketGroup ?? 'No Market';
    if (!referenceBrandByMarket.has(marketGroup)) {
      const units = activeView === 'ytd' ? row.ytdPieces : row.mthPieces;
      referenceBrandByMarket.set(marketGroup, { brandName: row.brandName, units });
    }
  }

  const marketDisplayRows = marketMergeRows
    .map((row) => {
      const referenceBrand = referenceBrandByMarket.get(row.marketGroup)?.brandName;
      if (activeChannel === 'private') {
        return {
          marketGroup: row.marketGroup,
          referenceBrand: referenceBrand ?? null,
          units: activeView === 'ytd' ? row.privateYtdUnits : row.privateMthUnits,
          growthPct: activeView === 'ytd' ? row.privateYtdGrowthPct : row.privateMthGrowthPct,
          budgetUnits: activeView === 'ytd' ? row.privateYtdBudgetUnits : row.privateMthBudgetUnits,
          coveragePct: activeView === 'ytd' ? row.privateYtdCoveragePct : row.privateMthCoveragePct,
        };
      }
      if (activeChannel === 'public') {
        return {
          marketGroup: row.marketGroup,
          referenceBrand: referenceBrand ?? null,
          units: activeView === 'ytd' ? row.publicYtdUnits : row.publicMthUnits,
          growthPct: activeView === 'ytd' ? row.publicYtdGrowthPct : row.publicMthGrowthPct,
          budgetUnits: activeView === 'ytd' ? row.publicYtdBudgetUnits : row.publicMthBudgetUnits,
          coveragePct: activeView === 'ytd' ? row.publicYtdCoveragePct : row.publicMthCoveragePct,
        };
      }
      return {
        marketGroup: row.marketGroup,
        referenceBrand: referenceBrand ?? null,
        units: activeView === 'ytd' ? row.totalYtdUnits : row.totalMthUnits,
        growthPct: activeView === 'ytd' ? row.totalYtdGrowthPct : row.totalMthGrowthPct,
        budgetUnits: activeView === 'ytd' ? row.totalYtdBudgetUnits : row.totalMthBudgetUnits,
        coveragePct: activeView === 'ytd' ? row.totalYtdCoveragePct : row.totalMthCoveragePct,
      };
    })
    .sort((a, b) => b.units - a.units);

  const triplesPrivateRows = privateRows.filter(
    (row) => isTriplesDoseMarketGroup(row.marketGroup) && isTrimbowBrand(row.brandName),
  );
  const triplesPublicRows = publicRows.filter(
    (row) => isTriplesDoseMarketGroup(row.marketGroup) && isTrimbowBrand(row.brandName),
  );
  const triplesPrivateYtdUnits = triplesPrivateRows.reduce((sum, row) => sum + row.ytdUnits, 0);
  const triplesPrivateYtdUnitsPy = triplesPrivateRows.reduce((sum, row) => sum + row.ytdUnitsPy, 0);
  const triplesPrivateYtdBudgetUnits = triplesPrivateRows.reduce((sum, row) => sum + row.budgetYtdUnits, 0);
  const triplesPrivateMthUnits = triplesPrivateRows.reduce((sum, row) => sum + row.mthUnits, 0);
  const triplesPrivateMthUnitsPy = triplesPrivateRows.reduce((sum, row) => sum + row.mthUnitsPy, 0);
  const triplesPrivateMthBudgetUnits = triplesPrivateRows.reduce((sum, row) => sum + row.budgetMthUnits, 0);
  const triplesPublicYtdUnits = triplesPublicRows.reduce((sum, row) => sum + row.ytdPieces, 0);
  const triplesPublicYtdUnitsPy = triplesPublicRows.reduce((sum, row) => sum + row.ytdPiecesPy, 0);
  const triplesPublicYtdBudgetUnits = triplesPublicRows.reduce((sum, row) => sum + row.ytdBudgetUnits, 0);
  const triplesPublicMthUnits = triplesPublicRows.reduce((sum, row) => sum + row.mthPieces, 0);
  const triplesPublicMthUnitsPy = triplesPublicRows.reduce((sum, row) => sum + row.mthPiecesPy, 0);
  const triplesPublicMthBudgetUnits = triplesPublicRows.reduce((sum, row) => sum + row.mthBudgetUnits, 0);

  const triplesTotalYtdUnits = triplesPrivateYtdUnits + triplesPublicYtdUnits;
  const triplesTotalYtdUnitsPy = triplesPrivateYtdUnitsPy + triplesPublicYtdUnitsPy;
  const triplesTotalYtdBudgetUnits = triplesPrivateYtdBudgetUnits + triplesPublicYtdBudgetUnits;
  const triplesTotalMthUnits = triplesPrivateMthUnits + triplesPublicMthUnits;
  const triplesTotalMthUnitsPy = triplesPrivateMthUnitsPy + triplesPublicMthUnitsPy;
  const triplesTotalMthBudgetUnits = triplesPrivateMthBudgetUnits + triplesPublicMthBudgetUnits;

  const triplesPrivateYtdGrowthPct =
    triplesPrivateYtdUnitsPy > 0 ? ((triplesPrivateYtdUnits - triplesPrivateYtdUnitsPy) / triplesPrivateYtdUnitsPy) * 100 : null;
  const triplesPrivateMthGrowthPct =
    triplesPrivateMthUnitsPy > 0 ? ((triplesPrivateMthUnits - triplesPrivateMthUnitsPy) / triplesPrivateMthUnitsPy) * 100 : null;
  const triplesPublicYtdGrowthPct =
    triplesPublicYtdUnitsPy > 0 ? ((triplesPublicYtdUnits - triplesPublicYtdUnitsPy) / triplesPublicYtdUnitsPy) * 100 : null;
  const triplesPublicMthGrowthPct =
    triplesPublicMthUnitsPy > 0 ? ((triplesPublicMthUnits - triplesPublicMthUnitsPy) / triplesPublicMthUnitsPy) * 100 : null;
  const triplesTotalYtdGrowthPct =
    triplesTotalYtdUnitsPy > 0 ? ((triplesTotalYtdUnits - triplesTotalYtdUnitsPy) / triplesTotalYtdUnitsPy) * 100 : null;
  const triplesTotalMthGrowthPct =
    triplesTotalMthUnitsPy > 0 ? ((triplesTotalMthUnits - triplesTotalMthUnitsPy) / triplesTotalMthUnitsPy) * 100 : null;

  const triplesSyntheticRow =
    triplesPrivateRows.length > 0 || triplesPublicRows.length > 0
      ? {
          marketGroup: TRIPLES_TOTAL_TRIMBOW_LABEL,
          referenceBrand: 'Trimbow',
          units:
            activeChannel === 'private'
              ? activeView === 'ytd'
                ? triplesPrivateYtdUnits
                : triplesPrivateMthUnits
              : activeChannel === 'public'
                ? activeView === 'ytd'
                  ? triplesPublicYtdUnits
                  : triplesPublicMthUnits
                : activeView === 'ytd'
                  ? triplesTotalYtdUnits
                  : triplesTotalMthUnits,
          growthPct:
            activeChannel === 'private'
              ? activeView === 'ytd'
                ? triplesPrivateYtdGrowthPct
                : triplesPrivateMthGrowthPct
              : activeChannel === 'public'
                ? activeView === 'ytd'
                  ? triplesPublicYtdGrowthPct
                  : triplesPublicMthGrowthPct
                : activeView === 'ytd'
                  ? triplesTotalYtdGrowthPct
                  : triplesTotalMthGrowthPct,
          budgetUnits:
            activeChannel === 'private'
              ? activeView === 'ytd'
                ? triplesPrivateYtdBudgetUnits
                : triplesPrivateMthBudgetUnits
              : activeChannel === 'public'
                ? activeView === 'ytd'
                  ? triplesPublicYtdBudgetUnits
                  : triplesPublicMthBudgetUnits
                : activeView === 'ytd'
                  ? triplesTotalYtdBudgetUnits
                  : triplesTotalMthBudgetUnits,
          coveragePct:
            activeChannel === 'private'
              ? activeView === 'ytd'
                ? (triplesPrivateYtdBudgetUnits > 0 ? (triplesPrivateYtdUnits / triplesPrivateYtdBudgetUnits) * 100 : null)
                : (triplesPrivateMthBudgetUnits > 0 ? (triplesPrivateMthUnits / triplesPrivateMthBudgetUnits) * 100 : null)
              : activeChannel === 'public'
                ? activeView === 'ytd'
                  ? (triplesPublicYtdBudgetUnits > 0 ? (triplesPublicYtdUnits / triplesPublicYtdBudgetUnits) * 100 : null)
                  : (triplesPublicMthBudgetUnits > 0 ? (triplesPublicMthUnits / triplesPublicMthBudgetUnits) * 100 : null)
                : activeView === 'ytd'
                  ? (triplesTotalYtdBudgetUnits > 0 ? (triplesTotalYtdUnits / triplesTotalYtdBudgetUnits) * 100 : null)
                  : (triplesTotalMthBudgetUnits > 0 ? (triplesTotalMthUnits / triplesTotalMthBudgetUnits) * 100 : null),
        }
      : null;

  const topMarketDisplayRows = (triplesSyntheticRow
    ? [...marketDisplayRows, triplesSyntheticRow]
    : marketDisplayRows)
    .sort((a, b) => b.units - a.units)
    .slice(0, 12);

  const buDisplayRows = buRows
    .map((row) => {
      if (activeChannel === 'private') {
        return {
          label: row.businessUnitName,
          units: row.privateUnits,
          growthPct: row.privateGrowthPct,
          budgetUnits: row.privateBudgetUnits,
          coveragePct: row.privateCoveragePct,
        };
      }
      if (activeChannel === 'public') {
        return {
          label: row.businessUnitName,
          units: row.publicUnits,
          growthPct: row.publicGrowthPct,
          budgetUnits: row.publicBudgetUnits,
          coveragePct: row.publicCoveragePct,
        };
      }
      return {
        label: row.businessUnitName,
        units: row.totalUnits,
        growthPct: row.totalGrowthPct,
        budgetUnits: row.totalBudgetUnits,
        coveragePct: row.totalCoveragePct,
      };
    })
    .sort((a, b) => b.units - a.units);


  return (
    <SectionCard
      eyebrow="Market Performance"
      title="Private + Public Units Merge"
      description="Cross-channel analysis for Business Units and Market Groups."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[12px] border border-blue-200 bg-blue-50/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-800">Private Market</p>
          <p className="mt-1 text-base text-slate-800">
            YTD Units {formatSalesMetric(privateSummary?.ytdUnits ?? 0, 'units')} | YTD Net Sales {formatSalesMetric(privateSummary?.ytdNetSales ?? 0, 'currency')} | YTD Rx {formatRecetas(privateSummary?.ytdRx ?? 0)}
          </p>
        </div>
        <div className="rounded-[12px] border border-emerald-200 bg-emerald-50/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">Public Market</p>
          <p className="mt-1 text-base text-slate-800">
            YTD Pieces {new Intl.NumberFormat('en-US').format(publicOverview?.ytdPieces ?? 0)} ({formatPercentNumber(publicOverview?.ytdGrowthPct ?? null, 1)} vs PY)
          </p>
          {publicError ? <p className="mt-1 text-sm text-amber-800">{publicError}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
          <Link
            href={marketViewHref('ytd', params)}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
              activeView === 'ytd' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            YTD
          </Link>
          <Link
            href={marketViewHref('mth', params)}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
              activeView === 'mth' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            MTH
          </Link>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
          <Link
            href={marketChannelHref('total', params)}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
              activeChannel === 'total' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Total
          </Link>
          <Link
            href={marketChannelHref('private', params)}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
              activeChannel === 'private' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Private
          </Link>
          <Link
            href={marketChannelHref('public', params)}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
              activeChannel === 'public' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Public
          </Link>
        </div>
      </div>

      <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Business Unit Performance</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full table-fixed text-[15px]">
            <colgroup>
              <col style={{ width: '38%' }} />
              <col style={{ width: '15.5%' }} />
              <col style={{ width: '15.5%' }} />
              <col style={{ width: '15.5%' }} />
              <col style={{ width: '15.5%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="border-b border-slate-200 pb-2 text-left text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Business Unit</th>
                <th className="border-b border-slate-200 pb-2 text-right text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Units</th>
                <th className="border-b border-slate-200 pb-2 text-right text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Growth</th>
                <th className="border-b border-slate-200 pb-2 text-right text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Budget</th>
                <th className="border-b border-slate-200 pb-2 text-right text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {buDisplayRows.map((row) => (
                <tr key={row.label} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-2.5 text-slate-800">
                    <p className="truncate">{row.label}</p>
                  </td>
                  <td className="py-2.5 text-right font-semibold">{new Intl.NumberFormat('en-US').format(row.units)}</td>
                  <td className={`py-2.5 text-right font-semibold ${row.growthPct === null ? 'text-slate-500' : row.growthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatPercentNumber(row.growthPct, 1)}</td>
                  <td className="py-2.5 text-right">{new Intl.NumberFormat('en-US').format(row.budgetUnits)}</td>
                  <td className={`py-2.5 text-right font-semibold ${row.coveragePct === null ? 'text-slate-500' : row.coveragePct >= 100 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {row.coveragePct === null ? 'N/A' : `${row.coveragePct.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Market Groups Performance</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full table-fixed text-[15px]">
            <colgroup>
              <col style={{ width: '38%' }} />
              <col style={{ width: '15.5%' }} />
              <col style={{ width: '15.5%' }} />
              <col style={{ width: '15.5%' }} />
              <col style={{ width: '15.5%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="border-b border-slate-200 pb-2 text-left text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Market Group</th>
                <th className="border-b border-slate-200 pb-2 text-right text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Units</th>
                <th className="border-b border-slate-200 pb-2 text-right text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Growth</th>
                <th className="border-b border-slate-200 pb-2 text-right text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Budget</th>
                <th className="border-b border-slate-200 pb-2 text-right text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {topMarketDisplayRows.map((row) => (
                <tr key={`${row.marketGroup}-${row.referenceBrand ?? 'na'}`} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-2.5 text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{row.marketGroup}</span>
                      {row.referenceBrand ? (
                        <span className="inline-flex max-w-[180px] items-center truncate rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-indigo-800">
                          {row.referenceBrand}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2.5 text-right font-semibold">{new Intl.NumberFormat('en-US').format(row.units)}</td>
                  <td className={`py-2.5 text-right font-semibold ${row.growthPct === null ? 'text-slate-500' : row.growthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatPercentNumber(row.growthPct, 1)}</td>
                  <td className="py-2.5 text-right">{new Intl.NumberFormat('en-US').format(row.budgetUnits)}</td>
                  <td className={`py-2.5 text-right font-semibold ${row.coveragePct === null ? 'text-slate-500' : row.coveragePct >= 100 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {row.coveragePct === null ? 'N/A' : `${row.coveragePct.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  );
}

type BrandSignalRow = {
  source: 'private' | 'public';
  marketGroup: string;
  brandName: string;
  sharePct: number;
  unitsGrowthPct: number | null;
  rxGrowthPct: number | null;
  rxMgSharePct: number | null;
  rxNeumoSharePct: number | null;
  coveragePct: number | null;
  ei: number | null;
  ytdUnits: number;
  ytdNetSales: number;
  ytdRx: number;
};

function toPercent(value: number | null) {
  return value === null ? null : value * 100;
}

function deriveBrandSignals(rows: BusinessExcellencePrivateSellOutMartRow[]): BrandSignalRow[] {
  return rows
    .map((row) => ({
      source: 'private' as const,
      marketGroup: row.marketGroup ?? 'No Market',
      brandName: row.brandName,
      sharePct: toPercent(row.msYtdUnitsPct) ?? 0,
      unitsGrowthPct: toPercent(row.growthVsPyYtdUnitsPct),
      rxGrowthPct: toPercent(row.growthVsPyYtdRxPct),
      rxMgSharePct: toPercent(row.ytdRxMgRatio),
      rxNeumoSharePct: toPercent(row.ytdRxNeumoRatio),
      coveragePct: row.budgetYtdUnits > 0 ? (row.ytdUnits / row.budgetYtdUnits) * 100 : null,
      ei: row.eiYtdUnits,
      ytdUnits: row.ytdUnits,
      ytdNetSales: row.ytdNetSales,
      ytdRx: row.ytdRx,
    }))
    .sort((a, b) => b.sharePct - a.sharePct);
}

function derivePublicBrandSignals(rows: BusinessExcellencePublicMarketTopProductRow[]): BrandSignalRow[] {
  return rows
    .map((row) => ({
      source: 'public' as const,
      marketGroup: row.marketGroup ?? 'No Market',
      brandName: row.brandName,
      sharePct: row.ytdMsPct ?? 0,
      unitsGrowthPct: row.ytdGrowthPct ?? null,
      rxGrowthPct: null,
      rxMgSharePct: null,
      rxNeumoSharePct: null,
      coveragePct: row.ytdCoverageVsBudgetPct ?? null,
      ei: row.ytdEvolutionIndex ?? null,
      ytdUnits: row.ytdPieces ?? 0,
      ytdNetSales: 0,
      ytdRx: 0,
    }))
    .sort((a, b) => b.sharePct - a.sharePct);
}

function formatBudgetCoverage(value: number | null) {
  if (value === null) return 'N/A';
  return `${value.toFixed(1)}%`;
}

function formatRatioText(value: number | null) {
  return value === null ? 'N/A' : `${value.toFixed(1)}%`;
}

const TRIPLES_TOTAL_TRIMBOW_LABEL = 'Triples - Total Trimbow';

function normalizeMarketText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isTriplesDoseMarketGroup(marketGroup: string | null | undefined) {
  const normalized = normalizeMarketText(marketGroup);
  if (!normalized.includes('triples')) return false;
  return normalized.includes('media dosis') || normalized.includes('dosis alta');
}

function isTrimbowBrand(brandName: string | null | undefined) {
  const normalized = normalizeMarketText(brandName);
  return normalized.includes('trimbow');
}

type SpecialtySummary = {
  dominant: string | null;
  topGrow: string | null;
  topGrowPct: number | null;
  topDecline: string | null;
  topDeclinePct: number | null;
};

function specialtyKey(marketGroup: string, brandName: string) {
  return `${marketGroup}|||${brandName}`;
}

function getRxDriverLabel(row: BrandSignalRow, specialtySummary?: SpecialtySummary) {
  if (specialtySummary?.dominant) return specialtySummary.dominant;
  const rxGrowth = row.rxGrowthPct ?? 0;
  if (rxGrowth >= 0) return 'Balanced specialty mix';
  return 'Specialty mix under pressure';
}

function buildRxAction(row: BrandSignalRow, specialtySummary?: SpecialtySummary) {
  const rxGrowth = row.rxGrowthPct ?? 0;
  const coverage = row.coveragePct ?? 0;
  const topGrow = specialtySummary?.topGrow;
  const topGrowPct = specialtySummary?.topGrowPct ?? null;
  const topDecline = specialtySummary?.topDecline;
  const topDeclinePct = specialtySummary?.topDeclinePct ?? null;

  if (rxGrowth < 0 && topDecline && topDeclinePct !== null) {
    return `Recover prescription performance in ${topDecline} (${topDeclinePct.toFixed(1)}% vs PY) with focused field cadence and account follow-up.`;
  }
  if (rxGrowth > 0 && topGrow && topGrowPct !== null) {
    return `Scale momentum in ${topGrow} (+${topGrowPct.toFixed(1)}% vs PY) and replicate winning coverage patterns.`;
  }
  if (coverage < 100 && rxGrowth >= 0) {
    return 'Convert Rx growth into sellout by tightening execution and closing the budget coverage gap.';
  }
  return 'Stabilize specialty contribution and improve execution in top-potential territories.';
}

function buildSpecialtySummaryMap(
  specialtySignals: BusinessExcellencePrivateBrandSpecialtySignal[],
) {
  const grouped = new Map<string, BusinessExcellencePrivateBrandSpecialtySignal[]>();
  for (const signal of specialtySignals) {
    const key = specialtyKey(signal.marketGroup, signal.brandName);
    const list = grouped.get(key);
    if (list) {
      list.push(signal);
    } else {
      grouped.set(key, [signal]);
    }
  }

  const summaryMap = new Map<string, SpecialtySummary>();
  grouped.forEach((list, key) => {
    const dominant = [...list].sort((a, b) => b.ytdRx - a.ytdRx)[0] ?? null;
    const growthCandidates = list.filter((item) => item.growthVsPyPct !== null);
    const topGrow = [...growthCandidates].sort((a, b) => (b.growthVsPyPct ?? -999) - (a.growthVsPyPct ?? -999))[0] ?? null;
    const topDecline = [...growthCandidates].sort((a, b) => (a.growthVsPyPct ?? 999) - (b.growthVsPyPct ?? 999))[0] ?? null;

    summaryMap.set(key, {
      dominant: dominant?.specialty ?? null,
      topGrow: topGrow?.specialty ?? null,
      topGrowPct: topGrow?.growthVsPyPct ?? null,
      topDecline: topDecline?.specialty ?? null,
      topDeclinePct: topDecline?.growthVsPyPct ?? null,
    });
  });

  return summaryMap;
}

function isRinitisRinoclenil(row: BrandSignalRow) {
  const brand = row.brandName.toLowerCase();
  return brand.includes('rinoclenil');
}

function ensureIncluded(
  rows: BrandSignalRow[],
  candidate: BrandSignalRow | undefined,
  limit: number,
) {
  if (!candidate) return rows.slice(0, limit);
  const exists = rows.some(
    (item) => item.marketGroup === candidate.marketGroup && item.brandName === candidate.brandName,
  );
  if (exists) return rows.slice(0, limit);
  return [candidate, ...rows].slice(0, limit);
}

function formatWowText(value: number | null | undefined) {
  if (value === null || value === undefined) return 'N/A';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

type PerformanceBucket = 'scaleUp' | 'defendMomentum' | 'monetizeGrowth' | 'turnaround';

function getPerformanceBucket(row: BrandSignalRow): PerformanceBucket {
  const growth = row.unitsGrowthPct;
  const coverage = row.coveragePct;
  const ei = row.ei;

  if (growth === null || ei === null) {
    return coverage !== null && coverage >= 100 ? 'defendMomentum' : 'monetizeGrowth';
  }
  if (growth >= 0 && coverage !== null && coverage >= 100 && ei >= 100) return 'scaleUp';
  if (coverage !== null && coverage >= 100 && (growth < 0 || ei < 100)) return 'defendMomentum';
  if (growth < 0 && (coverage === null || coverage < 100)) return 'turnaround';
  return 'monetizeGrowth';
}

function InsightsPanel({
  channelPerformance,
  martRows,
  publicOverview,
  publicRows,
  businessUnitRows,
  publicError,
}: {
  channelPerformance: BusinessExcellencePrivateChannelPerformance | null;
  martRows: BusinessExcellencePrivateSellOutMartRow[];
  publicOverview: BusinessExcellencePublicMarketOverview | null;
  publicRows: BusinessExcellencePublicMarketTopProductRow[];
  businessUnitRows: BusinessExcellenceBusinessUnitChannelRow[];
  publicError: string | null;
}) {
  const unitsTrend = channelPerformance?.ytdUnitsGrowthPct ?? null;
  const netSalesTrend = channelPerformance?.ytdNetSalesGrowthPct ?? null;
  const rxTrend = channelPerformance?.ytdRxGrowthPct ?? null;
  const ytdCoverage = channelPerformance?.ytdCoverageVsBudgetPct ?? null;
  const publicYtdUnitsTotal = publicRows.reduce((sum, row) => sum + (row.ytdPieces ?? 0), 0);
  const publicYtdBudgetTotal = publicRows.reduce((sum, row) => sum + (row.ytdBudgetUnits ?? 0), 0);
  const publicYtdBudgetCoveragePct =
    publicYtdBudgetTotal > 0 ? (publicYtdUnitsTotal / publicYtdBudgetTotal) * 100 : null;
  const privateByMarket = new Map<
    string,
    { marketGroup: string; ytdUnits: number; ytdUnitsPy: number; budgetYtdUnits: number }
  >();
  for (const row of martRows) {
    const key = row.marketGroup ?? 'No Market';
    const current = privateByMarket.get(key) ?? {
      marketGroup: key,
      ytdUnits: 0,
      ytdUnitsPy: 0,
      budgetYtdUnits: 0,
    };
    current.ytdUnits += row.ytdUnits;
    current.ytdUnitsPy += row.ytdUnitsPy;
    current.budgetYtdUnits += row.budgetYtdUnits;
    privateByMarket.set(key, current);
  }
  const privateMarketRows = [...privateByMarket.values()].map((row) => ({
    ...row,
    growthPct:
      row.ytdUnitsPy > 0 ? ((row.ytdUnits - row.ytdUnitsPy) / row.ytdUnitsPy) * 100 : null,
    coveragePct:
      row.budgetYtdUnits > 0 ? (row.ytdUnits / row.budgetYtdUnits) * 100 : null,
  }));
  const topPrivateByGrowth = [...privateMarketRows]
    .filter((row) => (row.growthPct ?? -999) > 0)
    .sort((a, b) => (b.growthPct ?? -999) - (a.growthPct ?? -999))
    .slice(0, 2)
    .map((row) => row.marketGroup);
  const topPrivateByCoverage = [...privateMarketRows]
    .filter((row) => (row.coveragePct ?? 0) >= 100)
    .sort((a, b) => (b.coveragePct ?? -999) - (a.coveragePct ?? -999))
    .slice(0, 2)
    .map((row) => row.marketGroup);
  const topPublicByGrowth = [...publicRows]
    .filter((row) => (row.ytdGrowthPct ?? -999) > 0)
    .sort((a, b) => (b.ytdGrowthPct ?? -999) - (a.ytdGrowthPct ?? -999))
    .slice(0, 2);
  const topPublicByCoverage = [...publicRows]
    .filter((row) => (row.ytdCoverageVsBudgetPct ?? 0) >= 100)
    .sort((a, b) => (b.ytdCoverageVsBudgetPct ?? -999) - (a.ytdCoverageVsBudgetPct ?? -999))
    .slice(0, 2);
  const buildPublicMarketLabel = (row: BusinessExcellencePublicMarketTopProductRow) =>
    `${row.marketGroup ?? 'No Market'} - ${row.brandName}`;
  const growthHighlights = topPublicByGrowth.map(buildPublicMarketLabel);
  const coverageHighlights = topPublicByCoverage.map(buildPublicMarketLabel);
  const buHighlights = [...businessUnitRows]
    .filter((row) => row.totalYtdUnits > 0)
    .map((row) => ({
      businessUnitName: row.businessUnitName,
      totalGrowthPct:
        row.totalYtdUnitsPy > 0 ? ((row.totalYtdUnits - row.totalYtdUnitsPy) / row.totalYtdUnitsPy) * 100 : null,
      totalCoveragePct: row.totalYtdCoveragePct,
      privateCoveragePct: row.privateYtdCoveragePct,
      publicCoveragePct: row.publicYtdCoveragePct,
    }));
  const topBuGrowth = [...buHighlights]
    .filter((row) => (row.totalGrowthPct ?? -999) > 0)
    .sort((a, b) => (b.totalGrowthPct ?? -999) - (a.totalGrowthPct ?? -999))
    .slice(0, 2);
  const topBuCoverage = [...buHighlights]
    .filter((row) => (row.totalCoveragePct ?? 0) >= 100)
    .sort((a, b) => (b.totalCoveragePct ?? -999) - (a.totalCoveragePct ?? -999))
    .slice(0, 2);
  const buUnderPressure = [...buHighlights]
    .filter((row) => (row.totalGrowthPct ?? 0) < 0 || (row.totalCoveragePct ?? 0) < 100)
    .sort((a, b) => (a.totalGrowthPct ?? 999) - (b.totalGrowthPct ?? 999))
    .slice(0, 2);
  const privateMarketAgg = new Map<string, { ytdUnits: number; ytdUnitsPy: number; ytdBudgetUnits: number }>();
  for (const row of martRows) {
    const marketGroup = row.marketGroup ?? 'No Market';
    const current = privateMarketAgg.get(marketGroup) ?? { ytdUnits: 0, ytdUnitsPy: 0, ytdBudgetUnits: 0 };
    current.ytdUnits += row.ytdUnits;
    current.ytdUnitsPy += row.ytdUnitsPy;
    current.ytdBudgetUnits += row.budgetYtdUnits;
    privateMarketAgg.set(marketGroup, current);
  }
  const privateBridgeRows = [...privateMarketAgg.entries()].map(([marketGroup, row]) => ({
    marketGroup,
    deltaVsPyUnits: row.ytdUnits - row.ytdUnitsPy,
    deltaVsBudgetUnits: row.ytdUnits - row.ytdBudgetUnits,
  }));

  const publicMarketAgg = new Map<string, { ytdUnits: number; ytdUnitsPy: number; ytdBudgetUnits: number }>();
  for (const row of publicRows) {
    const marketGroup = row.marketGroup ?? 'No Market';
    const current = publicMarketAgg.get(marketGroup) ?? { ytdUnits: 0, ytdUnitsPy: 0, ytdBudgetUnits: 0 };
    current.ytdUnits += row.ytdPieces;
    current.ytdUnitsPy += row.ytdPiecesPy;
    current.ytdBudgetUnits += row.ytdBudgetUnits;
    publicMarketAgg.set(marketGroup, current);
  }
  const publicBridgeRows = [...publicMarketAgg.entries()].map(([marketGroup, row]) => ({
    marketGroup,
    deltaVsPyUnits: row.ytdUnits - row.ytdUnitsPy,
    deltaVsBudgetUnits: row.ytdUnits - row.ytdBudgetUnits,
  }));

  const topPositiveVsPyPrivate = [...privateBridgeRows].sort((a, b) => b.deltaVsPyUnits - a.deltaVsPyUnits)[0] ?? null;
  const topNegativeVsPyPrivate = [...privateBridgeRows].sort((a, b) => a.deltaVsPyUnits - b.deltaVsPyUnits)[0] ?? null;
  const topPositiveVsBudgetPrivate = [...privateBridgeRows].sort((a, b) => b.deltaVsBudgetUnits - a.deltaVsBudgetUnits)[0] ?? null;
  const topNegativeVsBudgetPrivate = [...privateBridgeRows].sort((a, b) => a.deltaVsBudgetUnits - b.deltaVsBudgetUnits)[0] ?? null;

  const topPositiveVsPyPublic = [...publicBridgeRows].sort((a, b) => b.deltaVsPyUnits - a.deltaVsPyUnits)[0] ?? null;
  const topNegativeVsPyPublic = [...publicBridgeRows].sort((a, b) => a.deltaVsPyUnits - b.deltaVsPyUnits)[0] ?? null;
  const topPositiveVsBudgetPublic = [...publicBridgeRows].sort((a, b) => b.deltaVsBudgetUnits - a.deltaVsBudgetUnits)[0] ?? null;
  const topNegativeVsBudgetPublic = [...publicBridgeRows].sort((a, b) => a.deltaVsBudgetUnits - b.deltaVsBudgetUnits)[0] ?? null;

  return (
    <div className="space-y-4">
      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Business Units Narrative</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Top Business Units</p>
            {topBuGrowth.length === 0 && topBuCoverage.length === 0 ? (
              <p className="mt-1 text-sm text-slate-800">No clear BU outperformance in this YTD cut.</p>
            ) : (
              <div className="mt-1 space-y-1 text-sm text-slate-800">
                {topBuGrowth.length > 0 ? (
                  <p>
                    Growth leaders: {topBuGrowth.map((row) => `${row.businessUnitName} (${formatPercentNumber(row.totalGrowthPct, 1)})`).join(', ')}.
                  </p>
                ) : null}
                {topBuCoverage.length > 0 ? (
                  <p>
                    Coverage leaders: {topBuCoverage.map((row) => `${row.businessUnitName} (${row.totalCoveragePct === null ? 'N/A' : `${row.totalCoveragePct.toFixed(1)}%`})`).join(', ')}.
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Priority Risks</p>
            {buUnderPressure.length === 0 ? (
              <p className="mt-1 text-sm text-slate-800">No BU-level pressure signals detected.</p>
            ) : (
              <div className="mt-1 space-y-1 text-sm text-slate-800">
                {buUnderPressure.map((row) => (
                  <p key={row.businessUnitName}>
                    {row.businessUnitName}: growth {formatPercentNumber(row.totalGrowthPct, 1)} | coverage {row.totalCoveragePct === null ? 'N/A' : `${row.totalCoveragePct.toFixed(1)}%`}.
                  </p>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Cross-Channel Priority</p>
            <p className="mt-1 text-sm text-slate-800">
              Prioritize the business units where growth, coverage and channel mix diverge, then execute recovery actions in the largest market groups.
            </p>
          </div>
        </div>
      </article>

      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Private Channel Narrative</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Commercial Pulse</p>
            <p className="mt-1 text-sm text-slate-800">
              YTD Units are {formatPercentNumber(unitsTrend, 1)} vs PY and Net Sales are {formatPercentNumber(netSalesTrend, 1)} vs PY.
            </p>
          </div>
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Medical Pull-Through</p>
            <p className="mt-1 text-sm text-slate-800">
              YTD Rx trend stands at {formatPercentNumber(rxTrend, 1)} vs PY, with current coverage vs budget at {formatBudgetCoverage(ytdCoverage)}.
            </p>
          </div>
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Market Group Contribution</p>
            {topPrivateByGrowth.length === 0 && topPrivateByCoverage.length === 0 ? (
              <p className="mt-1 text-sm text-slate-800">
                No private market-group outperformance was detected in the current YTD cut.
              </p>
            ) : (
              <div className="mt-1 space-y-1 text-sm text-slate-800">
                {topPrivateByGrowth.length > 0 ? (
                  <p>Top YTD growth markets: {topPrivateByGrowth.join(', ')}.</p>
                ) : null}
                {topPrivateByCoverage.length > 0 ? (
                  <p>Top YTD budget coverage markets: {topPrivateByCoverage.join(', ')}.</p>
                ) : null}
                <ul className="space-y-0.5">
                  <li>
                    + vs PY: {topPositiveVsPyPrivate ? `${topPositiveVsPyPrivate.marketGroup} (${new Intl.NumberFormat('en-US').format(topPositiveVsPyPrivate.deltaVsPyUnits)} units)` : 'N/A'}.
                  </li>
                  <li>
                    - vs PY: {topNegativeVsPyPrivate ? `${topNegativeVsPyPrivate.marketGroup} (${new Intl.NumberFormat('en-US').format(topNegativeVsPyPrivate.deltaVsPyUnits)} units)` : 'N/A'}.
                  </li>
                  <li>
                    + vs Budget: {topPositiveVsBudgetPrivate ? `${topPositiveVsBudgetPrivate.marketGroup} (${new Intl.NumberFormat('en-US').format(topPositiveVsBudgetPrivate.deltaVsBudgetUnits)} units)` : 'N/A'}.
                  </li>
                  <li>
                    - vs Budget: {topNegativeVsBudgetPrivate ? `${topNegativeVsBudgetPrivate.marketGroup} (${new Intl.NumberFormat('en-US').format(topNegativeVsBudgetPrivate.deltaVsBudgetUnits)} units)` : 'N/A'}.
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </article>

      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Public Channel Narrative</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Commercial Pulse</p>
            <p className="mt-1 text-sm text-slate-800">
              YTD Units are {formatPercentNumber(publicOverview?.ytdGrowthPct ?? null, 1)} vs PY and MTH Units are {formatPercentNumber(publicOverview?.mthGrowthPct ?? null, 1)} vs PY.
            </p>
          </div>
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Access & Coverage</p>
            <p className="mt-1 text-sm text-slate-800">
              CLUE Coverage stands at {publicOverview?.chiesiClueCoveragePct === null || publicOverview?.chiesiClueCoveragePct === undefined ? 'N/A' : `${publicOverview.chiesiClueCoveragePct.toFixed(1)}%`} and total public budget coverage is {formatBudgetCoverage(publicYtdBudgetCoveragePct)}.
            </p>
          </div>
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Market Group Contribution</p>
            {growthHighlights.length === 0 && coverageHighlights.length === 0 ? (
              <p className="mt-1 text-sm text-slate-800">
                No public market-group outperformance was detected in the current YTD cut.
              </p>
            ) : (
              <div className="mt-1 space-y-1 text-sm text-slate-800">
                {growthHighlights.length > 0 ? (
                  <p>Top YTD growth markets: {growthHighlights.join(', ')}.</p>
                ) : null}
                {coverageHighlights.length > 0 ? (
                  <p>Top YTD budget coverage markets: {coverageHighlights.join(', ')}.</p>
                ) : null}
                <ul className="space-y-0.5">
                  <li>
                    + vs PY: {topPositiveVsPyPublic ? `${topPositiveVsPyPublic.marketGroup} (${new Intl.NumberFormat('en-US').format(topPositiveVsPyPublic.deltaVsPyUnits)} units)` : 'N/A'}.
                  </li>
                  <li>
                    - vs PY: {topNegativeVsPyPublic ? `${topNegativeVsPyPublic.marketGroup} (${new Intl.NumberFormat('en-US').format(topNegativeVsPyPublic.deltaVsPyUnits)} units)` : 'N/A'}.
                  </li>
                  <li>
                    + vs Budget: {topPositiveVsBudgetPublic ? `${topPositiveVsBudgetPublic.marketGroup} (${new Intl.NumberFormat('en-US').format(topPositiveVsBudgetPublic.deltaVsBudgetUnits)} units)` : 'N/A'}.
                  </li>
                  <li>
                    - vs Budget: {topNegativeVsBudgetPublic ? `${topNegativeVsBudgetPublic.marketGroup} (${new Intl.NumberFormat('en-US').format(topNegativeVsBudgetPublic.deltaVsBudgetUnits)} units)` : 'N/A'}.
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
        {publicError ? (
          <p className="mt-3 text-xs text-amber-700">Public data note: {publicError}</p>
        ) : null}
      </article>

    </div>
  );
}

function ScorecardInsightsPanel({
  martRows,
  specialtySignals,
  weeklyBenchmark,
  channelPerformance,
  publicOverview,
  publicRows,
}: {
  martRows: BusinessExcellencePrivateSellOutMartRow[];
  specialtySignals: BusinessExcellencePrivateBrandSpecialtySignal[];
  weeklyBenchmark: BusinessExcellencePrivateWeeklyBenchmark | null;
  channelPerformance: BusinessExcellencePrivateChannelPerformance | null;
  publicOverview: BusinessExcellencePublicMarketOverview | null;
  publicRows: BusinessExcellencePublicMarketTopProductRow[];
}) {
  const privateSignals = deriveBrandSignals(martRows);
  const publicSignalsForMap = derivePublicBrandSignals(publicRows);
  const signals = [...privateSignals, ...publicSignalsForMap]
    .sort((a, b) => b.sharePct - a.sharePct);
  const specialtySummaryMap = buildSpecialtySummaryMap(specialtySignals);
  const weeklyScope: 'all' | 'chiesi' =
    (weeklyBenchmark?.totals ?? []).some((row) => row.scope === 'chiesi') ? 'chiesi' : 'all';
  const weeklyTotalsByMarket = new Map(
    (weeklyBenchmark?.totals ?? [])
      .filter((row) => row.scope === weeklyScope)
      .map((row) => [row.marketGroup, row]),
  );
  const improvingWeeklyMarkets = [...weeklyTotalsByMarket.values()]
    .filter((row) => (row.wowGrowthPct ?? -999) > 0)
    .sort((a, b) => (b.wowGrowthPct ?? -999) - (a.wowGrowthPct ?? -999));
  const pressuredWeeklyMarkets = [...weeklyTotalsByMarket.values()]
    .filter((row) => (row.wowGrowthPct ?? 999) < 0)
    .sort((a, b) => (a.wowGrowthPct ?? 999) - (b.wowGrowthPct ?? 999));
  const rinitisRinoclenil = privateSignals.find(isRinitisRinoclenil);
  const rxWorkingBrands = privateSignals
    .filter((row) => (row.rxGrowthPct ?? -999) > 0)
    .sort((a, b) => (b.rxGrowthPct ?? -999) - (a.rxGrowthPct ?? -999))
    .slice(0, 4);
  const rxImproveBrands = privateSignals
    .filter((row) => (row.rxGrowthPct ?? 0) < 0)
    .sort((a, b) => b.sharePct - a.sharePct)
    .slice(0, 4);
  const rxWorkingWithAnchor =
    rinitisRinoclenil && (rinitisRinoclenil.rxGrowthPct ?? 0) >= 0
      ? ensureIncluded(rxWorkingBrands, rinitisRinoclenil, 4)
      : rxWorkingBrands;
  const rxImproveWithAnchor =
    rinitisRinoclenil && (rinitisRinoclenil.rxGrowthPct ?? 0) < 0
      ? ensureIncluded(rxImproveBrands, rinitisRinoclenil, 4)
      : rxImproveBrands;
  const scaleUpBase = signals.filter((row) => getPerformanceBucket(row) === 'scaleUp').slice(0, 6);
  const defendMomentumBase = signals.filter((row) => getPerformanceBucket(row) === 'defendMomentum').slice(0, 6);
  const monetizeGrowthBase = signals.filter((row) => getPerformanceBucket(row) === 'monetizeGrowth').slice(0, 6);
  const turnaroundBase = signals.filter((row) => getPerformanceBucket(row) === 'turnaround').slice(0, 6);

  const scaleUp = rinitisRinoclenil && getPerformanceBucket(rinitisRinoclenil) === 'scaleUp'
    ? ensureIncluded(scaleUpBase, rinitisRinoclenil, 6)
    : scaleUpBase;
  const defendMomentum = rinitisRinoclenil && getPerformanceBucket(rinitisRinoclenil) === 'defendMomentum'
    ? ensureIncluded(defendMomentumBase, rinitisRinoclenil, 6)
    : defendMomentumBase;
  const monetizeGrowth = rinitisRinoclenil && getPerformanceBucket(rinitisRinoclenil) === 'monetizeGrowth'
    ? ensureIncluded(monetizeGrowthBase, rinitisRinoclenil, 6)
    : monetizeGrowthBase;
  const turnaround = rinitisRinoclenil && getPerformanceBucket(rinitisRinoclenil) === 'turnaround'
    ? ensureIncluded(turnaroundBase, rinitisRinoclenil, 6)
    : turnaroundBase;

  const priorityList = [...turnaround, ...defendMomentum]
    .sort((a, b) => b.sharePct - a.sharePct)
    .slice(0, 5);
  const priorityWithAnchor = ensureIncluded(priorityList, rinitisRinoclenil, 5);
  const publicWorking = [...publicRows]
    .filter((row) => (row.ytdGrowthPct ?? -999) > 0)
    .sort((a, b) => (b.ytdGrowthPct ?? -999) - (a.ytdGrowthPct ?? -999))
    .slice(0, 3);
  const publicImprove = [...publicRows]
    .filter((row) => (row.ytdGrowthPct ?? 0) <= 0 || (row.ytdCoverageVsBudgetPct ?? 0) < 100)
    .sort((a, b) => (a.ytdGrowthPct ?? 999) - (b.ytdGrowthPct ?? 999))
    .slice(0, 3);
  const publicYtdUnitsTotal = publicRows.reduce((sum, row) => sum + (row.ytdPieces ?? 0), 0);
  const publicYtdBudgetTotal = publicRows.reduce((sum, row) => sum + (row.ytdBudgetUnits ?? 0), 0);
  const publicYtdBudgetCoveragePct =
    publicYtdBudgetTotal > 0 ? (publicYtdUnitsTotal / publicYtdBudgetTotal) * 100 : null;

  return (
    <div className="space-y-4">
      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Channel Performance Map</p>
          <p className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
            Private vs Public
          </p>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className="relative rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <span className="absolute right-3 top-3 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-blue-800">PVT</span>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Private Market</p>
            <p className="mt-1 text-xs text-slate-700">
              YTD Units {formatSalesMetric(channelPerformance?.ytdUnits ?? 0, 'units')} ({formatPercentNumber(channelPerformance?.ytdUnitsGrowthPct ?? null, 1)} vs PY)
            </p>
            <p className="mt-1 text-xs text-slate-700">
              YTD Net Sales {formatSalesMetric(channelPerformance?.ytdNetSales ?? 0, 'currency')} ({formatPercentNumber(channelPerformance?.ytdNetSalesGrowthPct ?? null, 1)} vs PY)
            </p>
            <p className="mt-1 text-xs text-slate-700">
              YTD Rx {formatRecetas(channelPerformance?.ytdRx ?? 0)} ({formatPercentNumber(channelPerformance?.ytdRxGrowthPct ?? null, 1)} vs PY)
            </p>
            <p className="mt-1 text-xs text-slate-700">
              Coverage vs Budget: {formatBudgetCoverage(channelPerformance?.ytdCoverageVsBudgetPct ?? null)} | Visited Units: {formatRatioText(channelPerformance?.ytdVisitedUnitsRatio === null || channelPerformance?.ytdVisitedUnitsRatio === undefined ? null : channelPerformance.ytdVisitedUnitsRatio * 100)}
            </p>
            {improvingWeeklyMarkets[0] ? (
              <p className="mt-1 text-xs text-slate-700">
                Weekly highlight: {improvingWeeklyMarkets[0].marketGroup} is up {formatWowText(improvingWeeklyMarkets[0].wowGrowthPct)} WoW.
              </p>
            ) : null}
            {pressuredWeeklyMarkets[0] ? (
              <p className="mt-1 text-xs text-slate-700">
                Weekly pressure: {pressuredWeeklyMarkets[0].marketGroup} is down {formatWowText(pressuredWeeklyMarkets[0].wowGrowthPct)} WoW.
              </p>
            ) : null}
          </div>
          <div className="relative rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <span className="absolute right-3 top-3 inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">PUB</span>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Public Market</p>
            <p className="mt-1 text-xs text-slate-700">
              YTD Units {formatSalesMetric(publicOverview?.ytdPieces ?? 0, 'units')} ({formatPercentNumber(publicOverview?.ytdGrowthPct ?? null, 1)} vs PY)
            </p>
            <p className="mt-1 text-xs text-slate-700">
              MTH Units {formatSalesMetric(publicOverview?.mthPieces ?? 0, 'units')} ({formatPercentNumber(publicOverview?.mthGrowthPct ?? null, 1)} vs PY)
            </p>
            <p className="mt-1 text-xs text-slate-700">
              CLUE Coverage: {new Intl.NumberFormat('en-US').format(publicOverview?.chiesiCluesActiveYtd ?? 0)}
              {' / '}
              {new Intl.NumberFormat('en-US').format(publicOverview?.cluesTotalYtd ?? 0)}
              {publicOverview?.chiesiClueCoveragePct === null || publicOverview?.chiesiClueCoveragePct === undefined
                ? ''
                : ` (${publicOverview.chiesiClueCoveragePct.toFixed(1)}%)`}
            </p>
            <p className="mt-1 text-xs text-slate-700">
              Total Public Budget Coverage (YTD): {formatBudgetCoverage(publicYtdBudgetCoveragePct)}
            </p>
          </div>
        </div>
      </article>

      <article className="rounded-[24px] border border-indigo-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-indigo-700">Brand Performance Map</p>
          <p className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
            YTD Growth + Coverage + EI
          </p>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-4">
          {[
            { title: 'Scale Up', tone: 'emerald', rows: scaleUp, note: 'Strong growth, above budget and EI >= 100.' },
            { title: 'Defend Momentum', tone: 'amber', rows: defendMomentum, note: 'Coverage ok, but trend/EI needs correction.' },
            { title: 'Monetize Growth', tone: 'cyan', rows: monetizeGrowth, note: 'Growth exists but budget conversion is low.' },
            { title: 'Turnaround', tone: 'rose', rows: turnaround, note: 'Below budget and negative growth.' },
          ].map((bucket) => (
            <div
              key={bucket.title}
              className={`rounded-[14px] border p-3 ${
                bucket.tone === 'emerald'
                  ? 'border-emerald-200 bg-emerald-50/70'
                  : bucket.tone === 'amber'
                    ? 'border-amber-200 bg-amber-50/70'
                    : bucket.tone === 'cyan'
                      ? 'border-cyan-200 bg-cyan-50/70'
                      : 'border-rose-200 bg-rose-50/70'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">{bucket.title}</p>
              <p className="mt-1 text-xs text-slate-700">{bucket.note}</p>
              <div className="mt-2 space-y-2">
                {bucket.rows.length === 0 ? (
                  <p className="text-xs text-slate-500">No brands in this segment.</p>
                ) : (
                  bucket.rows.map((row) => (
                    <div key={`${bucket.title}-${row.marketGroup}-${row.brandName}`} className="rounded-[10px] border border-white/70 bg-white/80 p-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] ${
                            row.source === 'private'
                              ? 'border-blue-200 bg-blue-50 text-blue-800'
                              : 'border-slate-300 bg-slate-50 text-slate-700'
                          }`}
                        >
                          {row.source === 'private' ? 'PVT' : 'PUB'}
                        </span>
                        <p className="text-xs font-semibold text-slate-900">{row.marketGroup} - {row.brandName}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-700">
                        Growth {formatPercentNumber(row.unitsGrowthPct, 1)} | Coverage {formatBudgetCoverage(row.coveragePct)} | EI {formatIndex(row.ei)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </article>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[24px] border border-emerald-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">What Is Working</p>
          <div className="mt-3 space-y-2">
            {rxWorkingWithAnchor.map((row) => {
              const specialtySummary = specialtySummaryMap.get(specialtyKey(row.marketGroup, row.brandName));
              const weeklyMarket = weeklyTotalsByMarket.get(row.marketGroup);
              return (
                <div key={`wk-${row.marketGroup}-${row.brandName}`} className="rounded-[12px] border border-emerald-200 bg-emerald-50/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-blue-800">PVT</span>
                    <p className="text-xs font-semibold text-emerald-900">{row.marketGroup} - {row.brandName}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-700">
                    Growth {formatPercentNumber(row.unitsGrowthPct, 1)} | Coverage {formatBudgetCoverage(row.coveragePct)} | EI {formatIndex(row.ei)}
                  </p>
                  <p className="mt-1 text-xs text-slate-700">
                    Rx {formatRecetas(row.ytdRx)} | Rx Growth {formatPercentNumber(row.rxGrowthPct, 1)} | Driver: {getRxDriverLabel(row, specialtySummary)} (MG {formatRatioText(row.rxMgSharePct)} / Neumo {formatRatioText(row.rxNeumoSharePct)})
                  </p>
                  {specialtySummary?.topGrow && specialtySummary.topGrowPct !== null ? (
                    <p className="mt-1 text-xs text-slate-700">
                      Best specialty trend: {specialtySummary.topGrow} ({specialtySummary.topGrowPct > 0 ? '+' : ''}{specialtySummary.topGrowPct.toFixed(1)}% vs PY)
                    </p>
                  ) : null}
                  {weeklyMarket?.wowGrowthPct !== null && weeklyMarket?.wowGrowthPct !== undefined ? (
                    <p className="mt-1 text-xs text-slate-700">
                      Weekly market WoW: {formatWowText(weeklyMarket.wowGrowthPct)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-700">
                    Action to scale: {buildRxAction(row, specialtySummary)}
                  </p>
                </div>
              );
            })}
            {publicWorking.map((row) => (
              <div key={`pub-w-${row.marketGroup ?? 'No Market'}`} className="rounded-[12px] border border-emerald-200 bg-emerald-50/60 p-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">PUB</span>
                  <p className="text-xs font-semibold text-emerald-900">{row.marketGroup ?? 'No Market'} - {row.brandName}</p>
                </div>
                <p className="mt-1 text-xs text-slate-700">
                  Growth {formatPercentNumber(row.ytdGrowthPct, 1)} | MS {row.ytdMsPct === null ? 'N/A' : `${row.ytdMsPct.toFixed(1)}%`} | EI {formatIndex(row.ytdEvolutionIndex)}
                </p>
              </div>
            ))}
            {rxWorkingWithAnchor.length === 0 && publicWorking.length === 0 ? (
              <p className="text-sm text-slate-600">No positive signals detected in current cut.</p>
            ) : null}
          </div>
        </article>

        <article className="rounded-[24px] border border-rose-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <p className="text-xs uppercase tracking-[0.16em] text-rose-700">What Needs To Improve</p>
          <div className="mt-3 space-y-2">
            {rxImproveWithAnchor.map((row) => {
              const specialtySummary = specialtySummaryMap.get(specialtyKey(row.marketGroup, row.brandName));
              const weeklyMarket = weeklyTotalsByMarket.get(row.marketGroup);
              return (
                <div key={`imp-${row.marketGroup}-${row.brandName}`} className="rounded-[12px] border border-rose-200 bg-rose-50/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-blue-800">PVT</span>
                    <p className="text-xs font-semibold text-rose-900">{row.marketGroup} - {row.brandName}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-700">
                    Growth {formatPercentNumber(row.unitsGrowthPct, 1)} | Coverage {formatBudgetCoverage(row.coveragePct)} | EI {formatIndex(row.ei)}
                  </p>
                  <p className="mt-1 text-xs text-slate-700">
                    Rx {formatRecetas(row.ytdRx)} | Rx Growth {formatPercentNumber(row.rxGrowthPct, 1)} | MG {formatRatioText(row.rxMgSharePct)} | Neumo {formatRatioText(row.rxNeumoSharePct)}
                  </p>
                  {specialtySummary?.topDecline && specialtySummary.topDeclinePct !== null ? (
                    <p className="mt-1 text-xs text-slate-700">
                      Weakest specialty trend: {specialtySummary.topDecline} ({specialtySummary.topDeclinePct > 0 ? '+' : ''}{specialtySummary.topDeclinePct.toFixed(1)}% vs PY)
                    </p>
                  ) : null}
                  {weeklyMarket?.wowGrowthPct !== null && weeklyMarket?.wowGrowthPct !== undefined ? (
                    <p className="mt-1 text-xs text-slate-700">
                      Weekly market WoW: {formatWowText(weeklyMarket.wowGrowthPct)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-700">
                    Action to recover: {buildRxAction(row, specialtySummary)}
                  </p>
                </div>
              );
            })}
            {publicImprove.map((row) => (
              <div key={`pub-i-${row.marketGroup ?? 'No Market'}`} className="rounded-[12px] border border-rose-200 bg-rose-50/60 p-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">PUB</span>
                  <p className="text-xs font-semibold text-rose-900">{row.marketGroup ?? 'No Market'} - {row.brandName}</p>
                </div>
                <p className="mt-1 text-xs text-slate-700">
                  Growth {formatPercentNumber(row.ytdGrowthPct, 1)} | Coverage {row.ytdCoverageVsBudgetPct === null ? 'N/A' : `${row.ytdCoverageVsBudgetPct.toFixed(1)}%`} | EI {formatIndex(row.ytdEvolutionIndex)}
                </p>
              </div>
            ))}
            {rxImproveWithAnchor.length === 0 && publicImprove.length === 0 ? (
              <p className="text-sm text-slate-600">No pressured signals detected in current cut.</p>
            ) : null}
          </div>
        </article>
      </div>

      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Action Plan Priorities</p>
        <p className="mt-1 text-xs text-slate-600">
          Weekly momentum ({weeklyScope === 'chiesi' ? 'Chiesi scope' : 'All market'}): {improvingWeeklyMarkets.length} markets growing WoW, {pressuredWeeklyMarkets.length} declining.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {priorityWithAnchor.map((row, index) => (
            (() => {
              const specialtySummary = specialtySummaryMap.get(specialtyKey(row.marketGroup, row.brandName));
              const weeklyMarket = weeklyTotalsByMarket.get(row.marketGroup);
              return (
            <div key={`${row.marketGroup}-${row.brandName}`} className="rounded-[12px] border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Priority {index + 1}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{row.marketGroup} - {row.brandName}</p>
              <p className="mt-1 text-xs text-slate-700">
                Share {row.sharePct.toFixed(1)}% | Growth {formatPercentNumber(row.unitsGrowthPct, 1)} | Coverage {formatBudgetCoverage(row.coveragePct)}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Rx lens: {formatPercentNumber(row.rxGrowthPct, 1)} vs PY | MG {formatRatioText(row.rxMgSharePct)} | Neumo {formatRatioText(row.rxNeumoSharePct)} | Driver {getRxDriverLabel(row, specialtySummary)}.
              </p>
              {weeklyMarket?.wowGrowthPct !== null && weeklyMarket?.wowGrowthPct !== undefined ? (
                <p className="mt-1 text-xs text-slate-600">
                  Weekly market WoW: {formatWowText(weeklyMarket.wowGrowthPct)}.
                </p>
              ) : null}
              <p className="mt-1 text-xs text-slate-600">
                Focus action: {buildRxAction(row, specialtySummary)}
              </p>
            </div>
              );
            })()
          ))}
        </div>
      </article>
    </div>
  );
}

const getCachedLatestPeriod = unstable_cache(
  async (reportingVersionId: string) => getBusinessExcellenceLatestPeriod(reportingVersionId),
  ['business-excellence-latest-period-v1'],
  { revalidate: 60 },
);

const getCachedPrivateSellOutData = unstable_cache(
  async (
    reportingVersionId: string,
    periodMonth?: string,
    marketGroup?: string,
    manager?: string,
    territory?: string,
  ) => {
    const filters = { periodMonth, marketGroup, manager, territory };
    const [
      overview,
      martSummary,
      martRows,
      rinoclenilRows,
      chartPoints,
      weeklyBenchmark,
      channelPerformance,
      dddRankingRows,
      prescriptionRankingRows,
      specialtySignals,
      managerRows,
      territoryRows,
      productRows,
    ] = await Promise.all([
      getBusinessExcellencePrivateSellOutOverview(reportingVersionId, filters),
      getBusinessExcellencePrivateSellOutMartSummary(reportingVersionId, marketGroup),
      getBusinessExcellencePrivateSellOutMartRows(reportingVersionId, marketGroup, 500),
      getBusinessExcellencePrivateSellOutMartRowsByBrand(reportingVersionId, 'rinoclenil', marketGroup),
      getBusinessExcellencePrivateMarketChartPoints(reportingVersionId),
      getBusinessExcellencePrivateWeeklyBenchmark(reportingVersionId),
      getBusinessExcellencePrivateChannelPerformance(reportingVersionId),
      getBusinessExcellencePrivateDddDimensionRanking(reportingVersionId, 30),
      getBusinessExcellencePrivatePrescriptionDimensionRanking(reportingVersionId, 30),
      getBusinessExcellencePrivateBrandSpecialtySignals(reportingVersionId),
      getBusinessExcellencePrivateManagers(reportingVersionId, filters, 8),
      getBusinessExcellencePrivateTerritories(reportingVersionId, filters, 8),
      getBusinessExcellencePrivateProducts(reportingVersionId, filters, 8),
    ]);

    const mergedMartRows = [...martRows, ...rinoclenilRows];
    const dedupedMartRows = Array.from(
      new Map(
        mergedMartRows.map((row) => [`${row.marketGroup ?? 'No Market'}|||${row.brandName}`, row]),
      ).values(),
    );

    return {
      overview,
      martSummary,
      martRows: dedupedMartRows,
      chartPoints,
      weeklyBenchmark,
      channelPerformance,
      dddRankingRows,
      prescriptionRankingRows,
      specialtySignals,
      managerRows,
      territoryRows,
      productRows,
    };
  },
  ['business-excellence-private-sell-out-v13'],
  { revalidate: 45 },
);

const getCachedAuditSources = unstable_cache(
  async (reportingVersionId: string) => getBusinessExcellenceAuditSources(reportingVersionId),
  ['business-excellence-audit-sources-v1'],
  { revalidate: 45 },
);

const getCachedPrivatePrescriptionsOverview = unstable_cache(
  async (reportingVersionId: string) => getBusinessExcellencePrivatePrescriptionsOverview(reportingVersionId),
  ['business-excellence-private-prescriptions-overview-v1'],
  { revalidate: 45 },
);

const getCachedPublicMarketData = unstable_cache(
  async (reportingVersionId: string) => {
    try {
      const [overview, topProducts, chartRows, rankingRows] = await Promise.all([
        getBusinessExcellencePublicMarketOverview(reportingVersionId || undefined),
        getBusinessExcellencePublicMarketTopProducts(500, reportingVersionId || undefined),
        getBusinessExcellencePublicMarketChartPoints(reportingVersionId || undefined),
        getBusinessExcellencePublicDimensionRankingRows(reportingVersionId || undefined),
      ]);
      const scFallbackNote =
        overview?.scSourceIsFallback
          ? `SC source for cutoff month unavailable; using SC from ${overview.scSourceMonth ?? 'previous available month'} projected into cutoff month.`
          : null;
      return {
        overview,
        topProducts,
        chartRows,
        rankingRows,
        error: scFallbackNote as string | null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load public market data.';
      return {
        overview: null as BusinessExcellencePublicMarketOverview | null,
        topProducts: [] as BusinessExcellencePublicMarketTopProductRow[],
        chartRows: [] as BusinessExcellencePublicMarketChartPoint[],
        rankingRows: [] as BusinessExcellencePublicDimensionRankingRow[],
        error: message,
      };
    }
  },
  ['business-excellence-public-market-v5'],
  { revalidate: 120 },
);

const getCachedBusinessUnitChannelRows = unstable_cache(
  async (reportingVersionId: string) => getBusinessExcellenceBusinessUnitChannelRows(reportingVersionId || undefined),
  ['business-excellence-bu-channel-v1'],
  { revalidate: 120 },
);

export async function BusinessExcellenceView({
  viewMode,
  searchParams = {},
}: {
  viewMode: BusinessExcellenceViewMode;
  searchParams?: SearchParams;
}) {
  const selectedReportingVersionId = searchParams.version ?? '';
  const activeDashboardTab: 'market' | 'private' | 'public' =
    searchParams.dashboardTab === 'market' ||
    searchParams.dashboardTab === 'private' ||
    searchParams.dashboardTab === 'public'
      ? searchParams.dashboardTab
      : 'market';
  const latestPeriod = await getCachedLatestPeriod(selectedReportingVersionId);
  if (!latestPeriod) {
    return (
      <section className="space-y-4 pb-8">
        <SectionHeader
          eyebrow="Executive"
          title="Business Excellence"
          description="No hay datos disponibles todavia para las vistas enriquecidas."
          actions={<ModeTabs active={viewMode} params={searchParams} />}
        />
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
            <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Report Period</span>
            <span className="font-semibold text-slate-900">N/A</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
            <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Source As Of</span>
            <span className="font-semibold text-slate-900">N/A</span>
          </span>
        </div>
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <p className="text-sm text-slate-600">
            Primero asegurate de que existan filas en `vw_business_excellence_pmm_enriched` o
            `vw_business_excellence_closeup_enriched`.
          </p>
        </article>
      </section>
    );
  }

  const privateSellOutFilters = getPrivateSellOutFilters(searchParams);
  const activePublicView: 'ytd' | 'mth' = searchParams.publicView === 'mth' ? 'mth' : 'ytd';
  const activeMarketView: 'ytd' | 'mth' = searchParams.marketView === 'mth' ? 'mth' : 'ytd';
  const activeMarketChannel: 'total' | 'private' | 'public' =
    searchParams.marketChannel === 'private' || searchParams.marketChannel === 'public'
      ? searchParams.marketChannel
      : 'total';
  const [privatePrescriptionsOverview, privateSellOutData, auditSources] = await Promise.all([
    getCachedPrivatePrescriptionsOverview(selectedReportingVersionId),
    getCachedPrivateSellOutData(
      selectedReportingVersionId,
      privateSellOutFilters.periodMonth,
      privateSellOutFilters.marketGroup,
      privateSellOutFilters.manager,
      privateSellOutFilters.territory,
    ),
    getCachedAuditSources(selectedReportingVersionId),
  ]);
  const [publicMarketData, businessUnitChannelRows] = await Promise.all([
    getCachedPublicMarketData(selectedReportingVersionId),
    getCachedBusinessUnitChannelRows(selectedReportingVersionId),
  ]);
  const auditHeader = resolveHeaderAuditContext(auditSources);
  const dddSourceAsOfMonth = resolveDddSourceAsOfMonth(auditSources);
  const headerReportPeriod =
    privateSellOutData.overview?.reportPeriodMonth ?? auditHeader.reportPeriodMonth ?? latestPeriod;
  const headerSourceAsOf =
    dddSourceAsOfMonth ??
    privateSellOutData.overview?.sourceAsOfMonth ??
    auditHeader.sourceAsOfMonth ??
    latestPeriod;

  return (
    <section className="space-y-4 pb-8">
      <SectionHeader
        eyebrow="Executive"
        title="Business Excellence"
        description={`Private Sell Out control tower sobre ${formatPeriod(latestPeriod)} con vistas para dashboard, insights y scorecard.`}
        actions={<ModeTabs active={viewMode} params={searchParams} />}
      />
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
          <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Report Period</span>
          <span className="font-semibold text-slate-900">{formatPeriodTag(headerReportPeriod)}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
          <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Source As Of</span>
          <span className="font-semibold text-slate-900">{formatPeriodTag(headerSourceAsOf)}</span>
        </span>
      </div>

      {privateSellOutData.overview ? (
        <DashboardTopCards
          martSummary={privateSellOutData.martSummary}
          overview={privateSellOutData.overview}
          prescriptionsOverview={privatePrescriptionsOverview}
          publicOverview={publicMarketData?.overview ?? null}
        />
      ) : null}

      {viewMode === 'dashboard' && privateSellOutData.overview ? (
        <>
          <DashboardPerformanceTabs active={activeDashboardTab} params={searchParams} />
          {activeDashboardTab === 'private' ? (
            <SellOutPrivadoPanel
              overview={privateSellOutData.overview}
              sourceAsOfMonth={headerSourceAsOf}
              martSummary={privateSellOutData.martSummary}
              martRows={privateSellOutData.martRows}
              chartPoints={privateSellOutData.chartPoints}
              dddRankingRows={privateSellOutData.dddRankingRows}
              prescriptionRankingRows={privateSellOutData.prescriptionRankingRows}
              weeklyBenchmark={privateSellOutData.weeklyBenchmark}
              selectedFilters={privateSellOutFilters}
            />
          ) : null}
          {activeDashboardTab === 'public' ? (
            <PublicPerformancePanel
              overview={publicMarketData?.overview ?? null}
              topProducts={publicMarketData?.topProducts ?? []}
              chartRows={publicMarketData?.chartRows ?? []}
              rankingRows={publicMarketData?.rankingRows ?? []}
              error={publicMarketData?.error ?? null}
              reportPeriodMonth={privateSellOutData.overview.reportPeriodMonth}
              sourceAsOfMonth={headerSourceAsOf}
              activeView={activePublicView}
              params={searchParams}
            />
          ) : null}
          {activeDashboardTab === 'market' ? (
            <MarketPerformancePanel
              privateSummary={privateSellOutData.martSummary}
              privateRows={privateSellOutData.martRows}
              publicOverview={publicMarketData?.overview ?? null}
              publicRows={publicMarketData?.topProducts ?? []}
              businessUnitRows={businessUnitChannelRows}
              publicError={publicMarketData?.error ?? null}
              activeView={activeMarketView}
              activeChannel={activeMarketChannel}
              params={searchParams}
            />
          ) : null}
        </>
      ) : null}

      {viewMode === 'insights' ? (
        <InsightsPanel
          channelPerformance={privateSellOutData.channelPerformance}
          martRows={privateSellOutData.martRows}
          publicOverview={publicMarketData?.overview ?? null}
          publicRows={publicMarketData?.topProducts ?? []}
          businessUnitRows={businessUnitChannelRows}
          publicError={publicMarketData?.error ?? null}
        />
      ) : null}

      {viewMode === 'scorecard' ? (
        <ScorecardInsightsPanel
          martRows={privateSellOutData.martRows}
          specialtySignals={privateSellOutData.specialtySignals}
          weeklyBenchmark={privateSellOutData.weeklyBenchmark}
          channelPerformance={privateSellOutData.channelPerformance}
          publicOverview={publicMarketData?.overview ?? null}
          publicRows={publicMarketData?.topProducts ?? []}
        />
      ) : null}

      <AuditSourcesPanel rows={auditSources} />
    </section>
  );
}
