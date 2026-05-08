import Link from 'next/link';
import type { ReactNode } from 'react';
import { MedicalDashboardTabs } from '@/components/executive/medical/medical-dashboard-tabs';
import { MedicalFieldExecutionPanelClient } from '@/components/executive/medical/medical-field-execution-panel-client';
import { SectionHeader } from '@/components/ui/section-header';
import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';
import {
  getMedicalData,
  getMedicalMslDashboardData,
  type MedicalKpiStatus,
} from '@/lib/data/medical';

export type MedicalViewMode = 'insights' | 'scorecard' | 'dashboard';

type SearchParams = {
  version?: string;
};

function modeHref(mode: MedicalViewMode, params: SearchParams) {
  const query = new URLSearchParams();
  if (params.version) query.set('version', params.version);
  const queryText = query.toString();
  return `/executive/medical/${mode}${queryText ? `?${queryText}` : ''}`;
}

function formatMonth(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function formatPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(1)}%`;
}

function formatInteger(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatResult(value: number | null, qtyUnit: string, fallbackText: string) {
  if (value == null) return fallbackText || 'N/A';
  if (qtyUnit === '%') return `${value.toFixed(1)}%`;
  if (qtyUnit.toLowerCase() === 'count' || qtyUnit.toLowerCase() === 'index') return `${Math.round(value)}`;
  return value.toFixed(1);
}

function KpiHelp({ text }: { text: string }) {
  return (
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold text-slate-500"
      title={text}
      aria-label={text}
    >
      ?
    </span>
  );
}

function KpiLabel({ children, help }: { children: ReactNode; help: string }) {
  return (
    <p className="flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
      <span>{children}</span>
      <KpiHelp text={help} />
    </p>
  );
}

function statusClasses(status: MedicalKpiStatus) {
  if (status === 'on_track') return 'border-emerald-200 bg-emerald-50/40 text-emerald-800';
  if (status === 'watch') return 'border-amber-200 bg-amber-50/40 text-amber-800';
  return 'border-rose-200 bg-rose-50/40 text-rose-800';
}

function ModeTabs({ active, params }: { active: MedicalViewMode; params: SearchParams }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(['insights', 'scorecard', 'dashboard'] as const).map((mode) => {
        const isActive = mode === active;
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

function TopCards({
  totalKpis,
  onTrack,
  healthScorePct,
  mslCoveragePct,
  mslReachPct,
}: {
  totalKpis: number;
  onTrack: number;
  healthScorePct: number | null;
  mslCoveragePct: number | null;
  mslReachPct: number | null;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <KpiLabel help="Number of Medical KPIs currently classified as on track out of all active KPI targets in this reporting cut.">
          KPIs On Track
        </KpiLabel>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {onTrack}/{totalKpis}
        </p>
        <p className="mt-1 text-xs text-slate-600">Current cut status</p>
      </article>
      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <KpiLabel help="YTD MSL interactions divided by the visit target for the selected Medical Salesforce cut.">
          MSL Visit Coverage
        </KpiLabel>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatPercent(mslCoveragePct)}</p>
        <p className="mt-1 text-xs text-slate-600">Reach YTD {formatPercent(mslReachPct)}</p>
      </article>
      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <KpiLabel help="Weighted KPI health: on-track KPIs count fully and watch KPIs count half, divided by total KPIs.">
          Health Score
        </KpiLabel>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatPercent(healthScorePct)}</p>
        <p className="mt-1 text-xs text-slate-600">((On Track*1) + (Watch*0.5)) / Total</p>
      </article>
    </div>
  );
}

function StatusStack({
  onTrack,
  watch,
  offTrack,
  total,
}: {
  onTrack: number;
  watch: number;
  offTrack: number;
  total: number;
}) {
  const onTrackPct = total > 0 ? (onTrack / total) * 100 : 0;
  const watchPct = total > 0 ? (watch / total) * 100 : 0;
  const offTrackPct = total > 0 ? (offTrack / total) * 100 : 0;
  const healthPct = total > 0 ? ((onTrack + watch * 0.5) / total) * 100 : null;

  return (
    <article className="rounded-[18px] border border-slate-200 bg-white p-4">
      <KpiLabel help="Distribution of Medical KPIs by on-track, watch, and off-track status.">
        Status Mix
      </KpiLabel>
      <div className="mt-4 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
        <div className="flex justify-center">
          <div
            className="relative h-40 w-40 rounded-full"
            style={{
              background: `conic-gradient(#10b981 0 ${onTrackPct}%, #f59e0b ${onTrackPct}% ${onTrackPct + watchPct}%, #f43f5e ${onTrackPct + watchPct}% 100%)`,
            }}
          >
            <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Health</p>
              <p className="text-2xl font-semibold text-slate-950">{formatPercent(healthPct)}</p>
              <p className="text-xs text-slate-500">{total} KPIs</p>
            </div>
          </div>
        </div>
        <div className="grid content-center gap-2 text-sm">
          <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-semibold text-emerald-800">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                On Track
              </span>
              <span className="text-emerald-900">{onTrack} ({formatPercent(onTrackPct)})</span>
            </div>
          </div>
          <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-semibold text-amber-800">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                Watch
              </span>
              <span className="text-amber-900">{watch} ({formatPercent(watchPct)})</span>
            </div>
          </div>
          <div className="rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-semibold text-rose-800">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Off Track
              </span>
              <span className="text-rose-900">{offTrack} ({formatPercent(offTrackPct)})</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

type MedicalViewProps = {
  viewMode: MedicalViewMode;
  searchParams?: SearchParams;
};

export async function MedicalView({ viewMode, searchParams = {} }: MedicalViewProps) {
  const versions = await getReportingVersions({
    statuses: searchParams.version ? ['draft', 'ready_to_show', 'closed'] : ['ready_to_show', 'closed'],
  });
  if (versions.length === 0) {
    return (
      <section className="space-y-4 pb-8">
        <SectionHeader
          eyebrow="Executive"
          title="Medical"
          description="Target-vs-result control tower for medical execution and MSL field coverage."
          actions={<ModeTabs active={viewMode} params={{}} />}
        />
        <div className="rounded-[18px] border border-slate-200 bg-white p-8 text-sm text-slate-600">
          No published Executive version is available.
        </div>
      </section>
    );
  }
  const selectedVersion =
    versions.find((version) => version.reportingVersionId === searchParams.version) ?? versions[0];

  const [data, dashboardData] = await Promise.all([
    getMedicalData(selectedVersion.reportingVersionId, selectedVersion.periodMonth),
    getMedicalMslDashboardData(selectedVersion.reportingVersionId, selectedVersion.periodMonth),
  ]);
  const mslSummaryYtd = dashboardData?.summary.ytd ?? null;
  const mslYtdRows = (dashboardData?.rows ?? []).filter((row) => row.periodScope === 'YTD');
  const mslTopCoverage = [...mslYtdRows]
    .filter((row) => row.coveragePct != null)
    .sort((a, b) => (b.coveragePct ?? 0) - (a.coveragePct ?? 0))
    .slice(0, 3);
  const mslLowReach = [...mslYtdRows]
    .filter((row) => row.reachPct != null)
    .sort((a, b) => (a.reachPct ?? 0) - (b.reachPct ?? 0))
    .slice(0, 3);
  const mslLowCoverage = [...mslYtdRows]
    .filter((row) => row.coveragePct != null)
    .sort((a, b) => (a.coveragePct ?? 0) - (b.coveragePct ?? 0))
    .slice(0, 3);
  const hasData = data.scores.length > 0;
  const working = data.scores.filter((item) => item.status === 'on_track');
  const needsImprove = data.scores.filter((item) => item.status === 'off_track');
  const watch = data.scores.filter((item) => item.status === 'watch');
  const topRisks = [...needsImprove]
    .sort((a, b) => (a.coveragePct ?? -Infinity) - (b.coveragePct ?? -Infinity))
    .slice(0, 3);
  const quickWins = [...watch]
    .filter((item) => item.coveragePct != null)
    .sort((a, b) => (b.coveragePct ?? 0) - (a.coveragePct ?? 0))
    .slice(0, 3);
  const projectedOnTrack = data.summary.onTrack + data.summary.watch;
  const projectedHealthScorePct =
    data.summary.totalKpis > 0
      ? ((projectedOnTrack * 1 + 0 * 0.5) / data.summary.totalKpis) * 100
      : null;

  function formatGapToTarget(item: (typeof data.scores)[number]) {
    if (item.targetValue == null || item.resultNumeric == null) return 'N/A';
    const gap = item.targetValue - item.resultNumeric;
    if (!Number.isFinite(gap) || gap <= 0) return 'At target';
    if (item.qtyUnit === '%') return `+${gap.toFixed(1)}pp`;
    if (item.qtyUnit.toLowerCase() === 'count' || item.qtyUnit.toLowerCase() === 'index') {
      return `+${Math.ceil(gap)}`;
    }
    return `+${gap.toFixed(1)} ${item.qtyUnit}`.trim();
  }

  return (
    <section className="space-y-4 pb-8">
      <SectionHeader
        eyebrow="Executive"
        title="Medical"
        description="Target-vs-result control tower for medical KPI execution."
        actions={<ModeTabs active={viewMode} params={{ version: selectedVersion.reportingVersionId }} />}
      />
      <div className="flex flex-wrap items-end gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
          <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Report Period</span>
          <span className="font-semibold text-slate-900">{formatMonth(data.reportPeriodMonth)}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
          <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Source As Of</span>
          <span className="font-semibold text-slate-900">{formatMonth(viewMode === 'dashboard' ? (dashboardData?.sourceAsOfMonth ?? data.sourceAsOfMonth) : data.sourceAsOfMonth)}</span>
        </span>
      </div>

      <div className="space-y-4">
        <TopCards
          totalKpis={data.summary.totalKpis}
          onTrack={data.summary.onTrack}
          healthScorePct={data.summary.healthScorePct}
          mslCoveragePct={mslSummaryYtd?.coveragePct ?? null}
          mslReachPct={mslSummaryYtd?.reachPct ?? null}
        />

        {viewMode === 'insights' && hasData ? (
          <div className="grid gap-3 xl:grid-cols-3">
            <article className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Medical Narrative</p>
              <p className="mt-2 text-sm text-slate-700">
                Current cut shows <strong>{data.summary.onTrack}</strong> KPIs on track, <strong>{data.summary.watch}</strong> on watch,
                and <strong>{data.summary.offTrack}</strong> off track, with health score at{' '}
                <strong>{formatPercent(data.summary.healthScorePct)}</strong>.
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Main attention points: {needsImprove.length > 0 ? needsImprove.map((item) => item.kpiLabel).join(', ') : 'no critical KPI in this cut'}.
              </p>
            </article>
            <article className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Read For Next Layer</p>
              <div className="mt-2 space-y-3 text-sm text-slate-700">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Top Risks This Cut</p>
                  <div className="mt-1 space-y-1.5">
                    {topRisks.length === 0 ? (
                      <p className="text-slate-600">No critical KPI in this cut.</p>
                    ) : (
                      topRisks.map((item) => (
                        <p key={`risk-${item.kpiLabel}-${item.kpiName}`}>
                          <span className="font-semibold text-slate-900">{item.kpiLabel}</span>: {formatPercent(item.coveragePct)} coverage, gap {formatGapToTarget(item)}.
                        </p>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Quick Wins</p>
                  <div className="mt-1 space-y-1.5">
                    {quickWins.length === 0 ? (
                      <p className="text-slate-600">No watch KPI close to threshold.</p>
                    ) : (
                      quickWins.map((item) => (
                        <p key={`quick-${item.kpiLabel}-${item.kpiName}`}>
                          <span className="font-semibold text-slate-900">{item.kpiLabel}</span>: needs {formatGapToTarget(item)} to move on track.
                        </p>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Management Focus (Next 30 Days)</p>
                  <p className="mt-1">
                    Recover top off-track KPIs, convert watchlist items to on-track, and enforce owner/date comments on every update cycle.
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Projection</p>
                  <p className="mt-1">
                    If all watch KPIs move on-track, health score improves from{' '}
                    <span className="font-semibold text-slate-900">{formatPercent(data.summary.healthScorePct)}</span> to{' '}
                    <span className="font-semibold text-slate-900">{formatPercent(projectedHealthScorePct)}</span>.
                  </p>
                </div>
              </div>
            </article>
            <article className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Medical Visit Strategy Narrative</p>
              <div className="mt-2 space-y-2 text-sm text-slate-700">
                <p>
                  YTD MLS execution is running at <strong>{formatPercent(mslSummaryYtd?.coveragePct ?? null)}</strong> coverage
                  and <strong>{formatPercent(mslSummaryYtd?.reachPct ?? null)}</strong> reach across{' '}
                  <strong>{formatInteger(mslSummaryYtd?.totalMls ?? 0)}</strong> MLS.
                </p>
                <p>
                  Best coverage momentum: {mslTopCoverage.length > 0
                    ? mslTopCoverage.map((row) => `${row.mlsCode} (${formatPercent(row.coveragePct)})`).join(', ')
                    : 'insufficient MLS data'}.
                </p>
                <p>
                  Reach focus territories: {mslLowReach.length > 0
                    ? mslLowReach.map((row) => `${row.mlsCode} (${formatPercent(row.reachPct)})`).join(', ')
                    : 'insufficient MLS data'}.
                </p>
                <p>
                  Priority: improve unique-client reach on low-reach MLS while sustaining target attainment on high-coverage MLS.
                </p>
              </div>
            </article>
          </div>
        ) : null}

        {viewMode === 'scorecard' && hasData ? (
          <div className="grid gap-3 xl:grid-cols-2">
            <article className="rounded-[18px] border border-emerald-200 bg-emerald-50/40 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-emerald-800">What Is Working</p>
              <div className="mt-2 space-y-2">
                <div className="rounded-[10px] border border-emerald-200 bg-white px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">Medical Field Execution (YTD)</p>
                  <p className="text-xs text-slate-700">
                    Coverage {formatPercent(mslSummaryYtd?.coveragePct ?? null)} | Reach {formatPercent(mslSummaryYtd?.reachPct ?? null)} | MLS {formatInteger(mslSummaryYtd?.totalMls ?? 0)}
                  </p>
                </div>
                {mslTopCoverage.map((row) => (
                  <div key={`working-mls-${row.mlsCode}`} className="rounded-[10px] border border-emerald-200 bg-white px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{row.mlsCode}{row.mlsName ? ` - ${row.mlsName}` : ''}</p>
                    <p className="text-xs text-slate-700">
                      Coverage {formatPercent(row.coveragePct)} | Interactions {formatInteger(row.interactions)} | Target {formatInteger(row.target)}
                    </p>
                  </div>
                ))}
                {working.length > 0 ? (
                  working.map((item) => (
                    <div key={`${item.kpiLabel}-${item.kpiName}`} className="rounded-[10px] border border-emerald-200 bg-white px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{item.kpiLabel}</p>
                      <p className="text-xs text-slate-700">
                        Coverage {formatPercent(item.coveragePct)} | Result {formatResult(item.resultNumeric, item.qtyUnit, item.resultText)} | Target {item.targetText}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-700">No KPIs on track in this cut.</p>
                )}
              </div>
            </article>

            <article className="rounded-[18px] border border-rose-200 bg-rose-50/40 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-rose-800">What Needs To Improve</p>
              <div className="mt-2 space-y-2">
                {mslLowReach.map((row) => (
                  <div key={`improve-reach-${row.mlsCode}`} className="rounded-[10px] border border-rose-200 bg-white px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{row.mlsCode}{row.mlsName ? ` - ${row.mlsName}` : ''}</p>
                    <p className="text-xs text-slate-700">
                      Reach {formatPercent(row.reachPct)} | Unique Reached {formatInteger(row.uniqueClientsReached)} / Clients {formatInteger(row.clients)}
                    </p>
                  </div>
                ))}
                {mslLowCoverage.map((row) => (
                  <div key={`improve-cov-${row.mlsCode}`} className="rounded-[10px] border border-rose-200 bg-white px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{row.mlsCode}{row.mlsName ? ` - ${row.mlsName}` : ''}</p>
                    <p className="text-xs text-slate-700">
                      Coverage {formatPercent(row.coveragePct)} | Interactions {formatInteger(row.interactions)} / Target {formatInteger(row.target)}
                    </p>
                  </div>
                ))}
                {needsImprove.length > 0 ? (
                  needsImprove.map((item) => (
                    <div key={`${item.kpiLabel}-${item.kpiName}`} className="rounded-[10px] border border-rose-200 bg-white px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{item.kpiLabel}</p>
                      <p className="text-xs text-slate-700">
                        Coverage {formatPercent(item.coveragePct)} | Result {formatResult(item.resultNumeric, item.qtyUnit, item.resultText)} | Target {item.targetText}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-700">No off-track KPIs in this cut.</p>
                )}
              </div>
            </article>

            <article className="rounded-[18px] border border-amber-200 bg-amber-50/40 p-4 xl:col-span-2">
              <p className="text-xs uppercase tracking-[0.14em] text-amber-800">Action Plan Priorities</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                <li>Focus remediation first on off-track KPIs with the largest coverage gap.</li>
                <li>Close watch KPIs with clear owner/action/date in the next form submission.</li>
                <li>Review target realism only through centralized governance process.</li>
              </ul>
            </article>
          </div>
        ) : null}

        {viewMode === 'dashboard' ? (
          <MedicalDashboardTabs
            targetsContent={
              <div className="space-y-3">
                <div className="grid gap-3 xl:grid-cols-2">
                  <StatusStack
                    onTrack={data.summary.onTrack}
                    watch={data.summary.watch}
                    offTrack={data.summary.offTrack}
                    total={data.summary.totalKpis}
                  />
                  <article className="rounded-[18px] border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">KPI Coverage</p>
                    <div className="mt-3 space-y-2">
                      {data.scores.map((item) => {
                        const coverage = item.coveragePct ?? 0;
                        const width = Math.max(0, Math.min(coverage, 140));
                        return (
                          <div key={`coverage-${item.kpiLabel}-${item.kpiName}`}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-700">{item.kpiLabel}</span>
                              <span className="text-slate-500">{formatPercent(item.coveragePct)}</span>
                            </div>
                            <div className="h-3 w-full overflow-hidden rounded-full border border-slate-200">
                              <div
                                className={`h-full ${item.status === 'on_track' ? 'bg-emerald-500' : item.status === 'watch' ? 'bg-amber-400' : 'bg-rose-500'}`}
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                </div>

                <article className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
                  <div className="overflow-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          <th className="px-4 py-3">KPI</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Unit</th>
                          <th className="px-4 py-3">Target</th>
                          <th className="px-4 py-3">Result</th>
                          <th className="px-4 py-3">Coverage</th>
                          <th className="px-4 py-3">Comment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.scores.map((item) => (
                          <tr key={`${item.kpiLabel}-${item.kpiName}`}>
                            <td className="px-4 py-3 font-semibold text-slate-900">{item.kpiLabel}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${statusClasses(item.status)}`}
                              >
                                {item.statusLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{item.qtyUnit}</td>
                            <td className="px-4 py-3 text-slate-700">{item.targetText}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {formatResult(item.resultNumeric, item.qtyUnit, item.resultText)}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{formatPercent(item.coveragePct)}</td>
                            <td className="px-4 py-3">
                              {item.comment && item.comment.trim() ? (
                                <span
                                  className="inline-flex cursor-help rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700"
                                  title={item.comment}
                                >
                                  Comment
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                        {data.scores.length === 0 ? (
                          <tr>
                            <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                              No Medical submissions found for this period. Use `/forms/medical`.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>
            }
            mslContent={<MedicalFieldExecutionPanelClient data={dashboardData} />}
          />
        ) : null}

        {!hasData ? (
          <article className="rounded-[18px] border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-700">
              No Medical submissions found for this cut. Load data from <strong>/forms/medical</strong> and refresh.
            </p>
          </article>
        ) : null}
      </div>
    </section>
  );
}
