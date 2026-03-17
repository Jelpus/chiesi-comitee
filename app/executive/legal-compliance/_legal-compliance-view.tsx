import Link from 'next/link';
import { SectionHeader } from '@/components/ui/section-header';
import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';
import { getLegalComplianceData, type LegalComplianceStatus } from '@/lib/data/legal-compliance';

export type LegalComplianceViewMode = 'insights' | 'scorecard' | 'dashboard';
type SearchParams = { version?: string };

function modeHref(mode: LegalComplianceViewMode, params: SearchParams) {
  const query = new URLSearchParams();
  if (params.version) query.set('version', params.version);
  const queryText = query.toString();
  return `/executive/legal-compliance/${mode}${queryText ? `?${queryText}` : ''}`;
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

function formatInt(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatCurrency(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function statusClasses(status: LegalComplianceStatus) {
  if (status === 'on_track') return 'border-emerald-200 bg-emerald-50/40 text-emerald-800';
  if (status === 'watch') return 'border-amber-200 bg-amber-50/40 text-amber-800';
  return 'border-rose-200 bg-rose-50/40 text-rose-800';
}

function coverageDotClass(status: LegalComplianceStatus) {
  if (status === 'on_track') return 'bg-emerald-500';
  if (status === 'watch') return 'bg-amber-400';
  return 'bg-rose-500';
}

function isLawsuitKpi(item: { kpiName: string; kpiLabel: string }) {
  const normalizedName = item.kpiName.toLowerCase();
  const normalizedLabel = item.kpiLabel.toLowerCase();
  return normalizedName.includes('juicios') || normalizedLabel.includes('lawsuit');
}

function ModeTabs({ active, params }: { active: LegalComplianceViewMode; params: SearchParams }) {
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

type LegalComplianceViewProps = { viewMode: LegalComplianceViewMode; searchParams?: SearchParams };

export async function LegalComplianceView({ viewMode, searchParams = {} }: LegalComplianceViewProps) {
  const versions = await getReportingVersions();
  if (versions.length === 0) throw new Error('No reporting versions found.');
  const selectedVersion =
    versions.find((version) => version.reportingVersionId === searchParams.version) ?? versions[0];
  const data = await getLegalComplianceData(selectedVersion.reportingVersionId, selectedVersion.periodMonth);

  const hasData = data.scores.length > 0;
  const working = data.scores.filter((item) => item.status === 'on_track');
  const needsImprove = data.scores.filter((item) => item.status === 'off_track');
  const watch = data.scores.filter((item) => item.status === 'watch');
  const topRisks = [...needsImprove]
    .sort((a, b) => (a.coveragePct ?? -Infinity) - (b.coveragePct ?? -Infinity))
    .slice(0, 3);
  const quickWinsFromWatch = [...watch]
    .filter((item) => item.coveragePct != null)
    .sort((a, b) => (b.coveragePct ?? 0) - (a.coveragePct ?? 0));
  const quickWinsFromOffTrack = [...needsImprove]
    .filter((item) => item.coveragePct != null)
    .sort((a, b) => (b.coveragePct ?? 0) - (a.coveragePct ?? 0));
  const quickWins = (quickWinsFromWatch.length > 0 ? quickWinsFromWatch : quickWinsFromOffTrack).slice(0, 3);
  const hasWatchQuickWins = quickWinsFromWatch.length > 0;
  const currentHealthPoints = data.summary.onTrack * 1 + data.summary.watch * 0.5;
  const projectedOnTrack = data.summary.onTrack + data.summary.watch;
  const projectedHealthPct =
    data.summary.totalKpis > 0
      ? ((projectedOnTrack * 1 + 0 * 0.5) / data.summary.totalKpis) * 100
      : null;
  const recoverableCount = Math.min(2, needsImprove.length);
  const projectedHealthFromRecoveryPct =
    data.summary.totalKpis > 0
      ? ((currentHealthPoints + recoverableCount * 0.5) / data.summary.totalKpis) * 100
      : null;

  function formatGapToTarget(item: (typeof data.scores)[number]) {
    const objective = item.objectiveCount ?? 0;
    const current = item.currentCount ?? 0;
    const gap = objective - current;
    if (gap <= 0) return 'At target';
    return `+${formatInt(gap)}`;
  }

  return (
    <section className="space-y-4 pb-8">
      <SectionHeader
        eyebrow="Executive"
        title="Legal & Compliance"
        description="Target-vs-result control tower for legal risk and compliance execution."
        actions={<ModeTabs active={viewMode} params={{ version: selectedVersion.reportingVersionId }} />}
      />

      <div className="flex flex-wrap items-end gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
          <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Report Period</span>
          <span className="font-semibold text-slate-900">{formatMonth(data.reportPeriodMonth)}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
          <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Source As Of</span>
          <span className="font-semibold text-slate-900">{formatMonth(data.sourceAsOfMonth)}</span>
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">KPIs On Track</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {data.summary.onTrack}/{data.summary.totalKpis}
          </p>
        </article>
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Watch KPIs</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{data.summary.watch}</p>
        </article>
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Off Track KPIs</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{data.summary.offTrack}</p>
        </article>
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Open Pending</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{data.summary.openPending}</p>
          <p className="mt-1 text-xs text-slate-600">Health {formatPercent(data.summary.weightedHealthPct)}</p>
        </article>
      </div>

      {viewMode === 'dashboard' && hasData ? (
        <article className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-3">KPI</th>
                  <th className="px-4 py-3">Objective</th>
                  <th className="px-4 py-3">Current</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Coverage</th>
                  <th className="px-4 py-3">Additional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.scores.map((item) => {
                  const isLawsuit = isLawsuitKpi(item);
                  const showAdditional = isLawsuit && ((item.currentCount ?? 0) + (item.activeCount ?? 0) > 0);
                  return (
                    <tr key={`${item.kpiLabel}-${item.kpiName}`}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{item.kpiLabel}</td>
                      <td className="px-4 py-3 text-slate-700">{formatInt(item.objectiveCount)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatInt(item.currentCount)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatInt(item.activeCount)}</td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                          <span className={`h-3 w-3 rounded-full ${coverageDotClass(item.status)}`} />
                          <span className="text-sm font-semibold text-slate-900">{formatPercent(item.coveragePct)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {showAdditional ? formatCurrency(item.additionalAmountMxn) : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      {viewMode === 'scorecard' && hasData ? (
        <div className="grid gap-3 xl:grid-cols-2">
          <article className="rounded-[18px] border border-emerald-200 bg-emerald-50/40 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-emerald-800">What Is Working</p>
            <div className="mt-2 space-y-2">
              {working.map((item) => (
                <div key={`${item.kpiLabel}-${item.kpiName}`} className="rounded-[10px] border border-emerald-200 bg-white px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{item.kpiLabel}</p>
                  <p className="text-xs text-slate-700">
                    Objective {formatInt(item.objectiveCount)} | Current {formatInt(item.currentCount)} | Active {formatInt(item.activeCount)} | Coverage {formatPercent(item.coveragePct)}
                  </p>
                </div>
              ))}
              {working.length === 0 ? <p className="text-sm text-slate-700">No KPI is on track in this cut.</p> : null}
            </div>
          </article>
          <article className="rounded-[18px] border border-rose-200 bg-rose-50/40 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-rose-800">What Needs To Improve</p>
            <div className="mt-2 space-y-2">
              {needsImprove.map((item) => (
                <div key={`${item.kpiLabel}-${item.kpiName}`} className="rounded-[10px] border border-rose-200 bg-white px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{item.kpiLabel}</p>
                  <p className="text-xs text-slate-700">
                    Objective {formatInt(item.objectiveCount)} | Current {formatInt(item.currentCount)} | Active {formatInt(item.activeCount)} | Coverage {formatPercent(item.coveragePct)}
                  </p>
                </div>
              ))}
              {needsImprove.length === 0 ? <p className="text-sm text-slate-700">No KPI is off track in this cut.</p> : null}
            </div>
          </article>
        </div>
      ) : null}

      {viewMode === 'insights' && hasData ? (
        <div className="grid gap-3 xl:grid-cols-2">
          <article className="rounded-[18px] border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Legal & Compliance Narrative</p>
            <p className="mt-2 text-sm text-slate-700">
              Current cut: <strong>{data.summary.onTrack}</strong> on track, <strong>{data.summary.watch}</strong> on watch, and <strong>{data.summary.offTrack}</strong> off track. Overall health: <strong>{formatPercent(data.summary.weightedHealthPct)}</strong>.
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
                        <span className="font-semibold text-slate-900">{item.kpiLabel}</span>: coverage {formatPercent(item.coveragePct)}, gap {formatGapToTarget(item)}.
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
                        <span className="font-semibold text-slate-900">{item.kpiLabel}</span>:{' '}
                        {hasWatchQuickWins
                          ? `needs ${formatGapToTarget(item)} to move on track.`
                          : `off-track but closest to threshold, needs ${formatGapToTarget(item)} to reach target.`}
                      </p>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Management Focus (Next 30 Days)</p>
                <p className="mt-1">
                  Prioritize off-track KPIs with highest gaps, reduce open pending items ({formatInt(data.summary.openPending)}), and enforce weekly follow-up on current plus active execution.
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Projection</p>
                {data.summary.watch > 0 ? (
                  <p className="mt-1">
                    If all watch KPIs move on-track, health improves from{' '}
                    <span className="font-semibold text-slate-900">{formatPercent(data.summary.weightedHealthPct)}</span> to{' '}
                    <span className="font-semibold text-slate-900">{formatPercent(projectedHealthPct)}</span>.
                  </p>
                ) : recoverableCount > 0 ? (
                  <p className="mt-1">
                    No watch KPIs available. If the top {recoverableCount} off-track KPIs move to watch, health improves from{' '}
                    <span className="font-semibold text-slate-900">{formatPercent(data.summary.weightedHealthPct)}</span> to{' '}
                    <span className="font-semibold text-slate-900">{formatPercent(projectedHealthFromRecoveryPct)}</span>.
                  </p>
                ) : (
                  <p className="mt-1">No near-term recovery scenario available for this cut.</p>
                )}
              </div>
            </div>
          </article>
        </div>
      ) : null}

      {!hasData ? (
        <article className="rounded-[18px] border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-700">
            No Legal & Compliance submissions found for this cut. Load data from <strong>/forms/legal-compliance</strong>.
          </p>
        </article>
      ) : null}

      {viewMode !== 'dashboard' && hasData ? (
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">KPI Snapshot</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.scores.map((item) => (
              <span
                key={`chip-${item.kpiLabel}-${item.kpiName}`}
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(item.status)}`}
                title={item.comment || item.kpiLabel}
              >
                {item.kpiLabel}
              </span>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}
