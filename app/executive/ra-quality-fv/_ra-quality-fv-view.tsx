import Link from 'next/link';
import { SectionHeader } from '@/components/ui/section-header';
import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';
import { getRaQualityFvData, type RaTopicStatus } from '@/lib/data/ra-quality-fv';

export type RaQualityFvViewMode = 'insights' | 'scorecard' | 'dashboard';

type SearchParams = {
  version?: string;
};

function modeHref(mode: RaQualityFvViewMode, params: SearchParams) {
  const query = new URLSearchParams();
  if (params.version) query.set('version', params.version);
  const queryText = query.toString();
  return `/executive/ra-quality-fv/${mode}${queryText ? `?${queryText}` : ''}`;
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

function topicDisplayLabel(item: { topic: string; targetText: string }) {
  return item.targetText && item.targetText !== 'Target not configured' ? item.targetText : item.topic;
}

function topicCompletionPct(item: {
  topic: string;
  targetValue: number | null;
  onTimeCount: number | null;
  lateCount: number | null;
  pendingCount: number | null;
  activeCount: number | null;
  overdueCount: number | null;
  ytdCount: number | null;
}) {
  const topic = item.topic.toLowerCase();
  if (topic.includes('procedimientos')) {
    const active = item.activeCount ?? 0;
    const overdue = item.overdueCount ?? 0;
    if (active <= 0) return 100;
    return Math.max(0, ((active - overdue) / active) * 100);
  }
  if (topic.includes('auditorias')) {
    if (item.targetValue == null || item.targetValue <= 0) return null;
    return ((item.ytdCount ?? 0) / item.targetValue) * 100;
  }
  const onTime = item.onTimeCount ?? 0;
  const late = item.lateCount ?? 0;
  const pending = item.pendingCount ?? 0;
  const total = onTime + late + pending;
  if (total <= 0) return null;
  return (onTime / total) * 100;
}

function topicGapText(item: {
  topic: string;
  targetValue: number | null;
  lateCount: number | null;
  pendingCount: number | null;
  overdueCount: number | null;
  ytdCount: number | null;
}) {
  const topic = item.topic.toLowerCase();
  if (topic.includes('procedimientos')) {
    return `clear ${item.overdueCount ?? 0} overdue`;
  }
  if (topic.includes('auditorias')) {
    if (item.targetValue == null) return 'N/A';
    const gap = Math.max(0, Math.ceil(item.targetValue - (item.ytdCount ?? 0)));
    return gap > 0 ? `+${gap} audits` : 'at target';
  }
  const gap = (item.lateCount ?? 0) + (item.pendingCount ?? 0);
  return gap > 0 ? `${gap} late/pending` : 'stable';
}

function buildTopicKpiLine(item: {
  topic: string;
  targetText: string;
  onTimeCount: number | null;
  lateCount: number | null;
  pendingCount: number | null;
  activeCount: number | null;
  overdueCount: number | null;
  ytdCount: number | null;
}) {
  const topic = item.topic.toLowerCase();
  if (topic.includes('procedimientos')) {
    return `Active ${item.activeCount ?? 0} | Overdue ${item.overdueCount ?? 0}. Target: ${item.targetText}.`;
  }
  if (topic.includes('auditorias')) {
    return `YTD audits ${item.ytdCount ?? 0}. Target: ${item.targetText}.`;
  }
  return `On-time ${item.onTimeCount ?? 0} | Late ${item.lateCount ?? 0} | Pending ${item.pendingCount ?? 0}. Target: ${item.targetText}.`;
}

function buildTopicActionLine(item: {
  topic: string;
  pendingCount: number | null;
  overdueCount: number | null;
  lateCount: number | null;
}) {
  const topic = item.topic.toLowerCase();
  if (topic.includes('procedimientos')) {
    return 'Action: close overdue procedures with owners and due dates this month.';
  }
  if ((item.pendingCount ?? 0) > 0) {
    return 'Action: prioritize pending items and lock a regulatory follow-up cadence.';
  }
  if ((item.lateCount ?? 0) > 0 || (item.overdueCount ?? 0) > 0) {
    return 'Action: focus on cycle-time reduction for delayed cases.';
  }
  return 'Action: maintain current execution discipline and monitor lead times.';
}

function statusClasses(status: RaTopicStatus) {
  if (status === 'on_track') return 'border-emerald-200 bg-emerald-50/40 text-emerald-800';
  if (status === 'watch') return 'border-amber-200 bg-amber-50/40 text-amber-800';
  return 'border-rose-200 bg-rose-50/40 text-rose-800';
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

  return (
    <article className="rounded-[18px] border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Status Mix</p>
      <div className="mt-3 h-4 w-full overflow-hidden rounded-full border border-slate-200">
        <div className="flex h-full w-full">
          <div className="bg-emerald-500" style={{ width: `${onTrackPct}%` }} />
          <div className="bg-amber-400" style={{ width: `${watchPct}%` }} />
          <div className="bg-rose-500" style={{ width: `${offTrackPct}%` }} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <p className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-800">On Track {onTrack}</p>
        <p className="rounded-md bg-amber-50 px-2 py-1 text-amber-800">Watch {watch}</p>
        <p className="rounded-md bg-rose-50 px-2 py-1 text-rose-800">Off {offTrack}</p>
      </div>
    </article>
  );
}

function TooltipCell({ label, value }: { label: string; value: string }) {
  const text = value?.trim() || 'N/A';
  return (
    <div>
      <span
        className="inline-flex cursor-help rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700"
        title={text}
      >
        {label}
      </span>
    </div>
  );
}

function ModeTabs({ active, params }: { active: RaQualityFvViewMode; params: SearchParams }) {
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
  totalTopics,
  onTrack,
  watch,
  offTrack,
  openPending,
  healthPct,
}: {
  totalTopics: number;
  onTrack: number;
  watch: number;
  offTrack: number;
  openPending: number;
  healthPct: number | null;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Topics On Track</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {onTrack}/{totalTopics}
        </p>
        <p className="mt-1 text-xs text-slate-600">Current month status</p>
      </article>
      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Watch Topics</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{watch}</p>
        <p className="mt-1 text-xs text-slate-600">Need follow-up</p>
      </article>
      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Off Track Topics</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{offTrack}</p>
        <p className="mt-1 text-xs text-slate-600">Critical gaps</p>
      </article>
      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Open Pending</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{openPending}</p>
        <p className="mt-1 text-xs text-slate-600">Health {formatPercent(healthPct)}</p>
      </article>
    </div>
  );
}

type RaQualityFvViewProps = {
  viewMode: RaQualityFvViewMode;
  searchParams?: SearchParams;
};

export async function RaQualityFvView({ viewMode, searchParams = {} }: RaQualityFvViewProps) {
  const versions = await getReportingVersions();
  if (versions.length === 0) {
    throw new Error('No reporting versions found.');
  }
  const selectedVersion =
    versions.find((version) => version.reportingVersionId === searchParams.version) ?? versions[0];

  const data = await getRaQualityFvData(selectedVersion.reportingVersionId, selectedVersion.periodMonth);
  const hasData = data.scores.length > 0;
  const working = data.scores.filter((item) => item.status === 'on_track');
  const needsImprove = data.scores.filter((item) => item.status === 'off_track');
  const watch = data.scores.filter((item) => item.status === 'watch');
  const topRisks = [...needsImprove]
    .sort((a, b) => (topicCompletionPct(a) ?? -Infinity) - (topicCompletionPct(b) ?? -Infinity))
    .slice(0, 3);
  const quickWinsFromWatch = [...watch]
    .sort((a, b) => (topicCompletionPct(b) ?? 0) - (topicCompletionPct(a) ?? 0));
  const quickWinsFromOffTrack = [...needsImprove]
    .sort((a, b) => (topicCompletionPct(b) ?? 0) - (topicCompletionPct(a) ?? 0));
  const quickWins = (quickWinsFromWatch.length > 0 ? quickWinsFromWatch : quickWinsFromOffTrack).slice(0, 3);
  const hasWatchQuickWins = quickWinsFromWatch.length > 0;
  const currentHealthPoints = data.summary.onTrack * 1 + data.summary.watch * 0.5;
  const projectedOnTrack = data.summary.onTrack + data.summary.watch;
  const projectedHealthPct =
    data.summary.totalTopics > 0
      ? ((projectedOnTrack * 1 + 0 * 0.5) / data.summary.totalTopics) * 100
      : null;
  const recoverableCount = Math.min(2, needsImprove.length);
  const projectedHealthFromRecoveryPct =
    data.summary.totalTopics > 0
      ? ((currentHealthPoints + recoverableCount * 0.5) / data.summary.totalTopics) * 100
      : null;

  return (
    <section className="space-y-4 pb-8">
      <SectionHeader
        eyebrow="Executive"
        title="RA - Quality - FV"
        description="Target-vs-result control tower for regulatory execution and quality follow-up."
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

      <div className="space-y-4">
        <TopCards
          totalTopics={data.summary.totalTopics}
          onTrack={data.summary.onTrack}
          watch={data.summary.watch}
          offTrack={data.summary.offTrack}
          openPending={data.summary.openPending}
          healthPct={data.summary.weightedHealthPct}
        />

        {viewMode === 'insights' && hasData ? (
          <div className="grid gap-3 xl:grid-cols-2">
            <article className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Regulatory Narrative</p>
              <p className="mt-2 text-sm text-slate-700">
                Current cut shows <strong>{data.summary.onTrack}</strong> topics on track, <strong>{data.summary.watch}</strong> on watch,
                and <strong>{data.summary.offTrack}</strong> off track, with overall health at{' '}
                <strong>{formatPercent(data.summary.weightedHealthPct)}</strong>.
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Main risk drivers are concentrated in {needsImprove.length > 0 ? needsImprove.map((item) => topicDisplayLabel(item)).join(', ') : 'no critical topics this month'}.
              </p>
            </article>
            <article className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Read For Next Layer</p>
              <div className="mt-2 space-y-3 text-sm text-slate-700">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Top Risks This Cut</p>
                  <div className="mt-1 space-y-1.5">
                    {topRisks.length === 0 ? (
                      <p className="text-slate-600">No critical topics in this cut.</p>
                    ) : (
                      topRisks.map((item) => (
                        <p key={`risk-${item.topic}`}>
                          <span className="font-semibold text-slate-900">{topicDisplayLabel(item)}</span>: completion {formatPercent(topicCompletionPct(item))}, gap {topicGapText(item)}.
                        </p>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Quick Wins</p>
                  <div className="mt-1 space-y-1.5">
                    {quickWins.length === 0 ? (
                      <p className="text-slate-600">No near-threshold topics in this cut.</p>
                    ) : (
                      quickWins.map((item) => (
                        <p key={`quick-${item.topic}`}>
                          <span className="font-semibold text-slate-900">{topicDisplayLabel(item)}</span>:{' '}
                          {hasWatchQuickWins
                            ? `needs ${topicGapText(item)} to move on track.`
                            : `off-track but closest to threshold, needs ${topicGapText(item)}.`}
                        </p>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Management Focus (Next 30 Days)</p>
                  <p className="mt-1">
                    Prioritize off-track topics with highest execution gaps, reduce pending workload ({data.summary.openPending}), and lock weekly owner follow-up with SLA discipline.
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Projection</p>
                  {data.summary.watch > 0 ? (
                    <p className="mt-1">
                      If all watch topics move on-track, health improves from{' '}
                      <span className="font-semibold text-slate-900">{formatPercent(data.summary.weightedHealthPct)}</span> to{' '}
                      <span className="font-semibold text-slate-900">{formatPercent(projectedHealthPct)}</span>.
                    </p>
                  ) : recoverableCount > 0 ? (
                    <p className="mt-1">
                      No watch topics available. If the top {recoverableCount} off-track topics move to watch, health improves from{' '}
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

        {viewMode === 'scorecard' && hasData ? (
          <div className="grid gap-3 xl:grid-cols-2">
            <article className="rounded-[18px] border border-emerald-200 bg-emerald-50/40 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-emerald-800">What Is Working</p>
              <div className="mt-2 space-y-2">
                {working.length > 0 ? (
                  working.map((item) => (
                    <div key={item.topic} className="rounded-[10px] border border-emerald-200 bg-white px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{topicDisplayLabel(item)}</p>
                      <p className="text-xs text-slate-700">{buildTopicKpiLine(item)}</p>
                      <p className="mt-1 text-xs text-slate-600">{buildTopicActionLine(item)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-700">No topics on track in this cut.</p>
                )}
              </div>
            </article>

            <article className="rounded-[18px] border border-rose-200 bg-rose-50/40 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-rose-800">What Needs To Improve</p>
              <div className="mt-2 space-y-2">
                {needsImprove.length > 0 ? (
                  needsImprove.map((item) => (
                    <div key={item.topic} className="rounded-[10px] border border-rose-200 bg-white px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{topicDisplayLabel(item)}</p>
                      <p className="text-xs text-slate-700">{buildTopicKpiLine(item)}</p>
                      <p className="mt-1 text-xs text-slate-600">{buildTopicActionLine(item)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-700">No off-track topics in this cut.</p>
                )}
              </div>
            </article>

            <article className="rounded-[18px] border border-amber-200 bg-amber-50/40 p-4 xl:col-span-2">
              <p className="text-xs uppercase tracking-[0.14em] text-amber-800">Action Plan Priorities</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                <li>Close pending COFEPRIS evaluations for registration-related topics.</li>
                <li>Reduce overdue procedures with cross-functional owners and due dates.</li>
                <li>Track audit run-rate monthly to reach annual target without end-year compression.</li>
              </ul>
            </article>
          </div>
        ) : null}

        {viewMode === 'dashboard' && hasData ? (
          <div className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-2">
              <StatusStack
                onTrack={data.summary.onTrack}
                watch={data.summary.watch}
                offTrack={data.summary.offTrack}
                total={data.summary.totalTopics}
              />
              <article className="rounded-[18px] border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Topic Execution Mix</p>
                <div className="mt-3 space-y-2">
                  {data.scores.map((item) => {
                    const isProcedimientos = item.topic.toLowerCase().includes('procedimientos');
                    const onTime = isProcedimientos ? item.activeCount ?? 0 : item.onTimeCount ?? 0;
                    const late = isProcedimientos ? item.overdueCount ?? 0 : item.lateCount ?? 0;
                    const pending = isProcedimientos ? 0 : item.pendingCount ?? 0;
                    const total = onTime + late + pending;
                    const onPct = total > 0 ? (onTime / total) * 100 : 0;
                    const latePct = total > 0 ? (late / total) * 100 : 0;
                    const pendingPct = total > 0 ? (pending / total) * 100 : 0;
                    return (
                      <div key={`mix-${item.topic}`}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">{topicDisplayLabel(item)}</span>
                          <span className="text-slate-500">{total} total</span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full border border-slate-200">
                          <div className="flex h-full w-full">
                            <div className="bg-emerald-500" style={{ width: `${onPct}%` }} />
                            <div className="bg-rose-500" style={{ width: `${latePct}%` }} />
                            <div className="bg-amber-400" style={{ width: `${pendingPct}%` }} />
                          </div>
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
                    <th className="px-4 py-3">Topic</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">On Time</th>
                    <th className="px-4 py-3">Late</th>
                    <th className="px-4 py-3">Pending</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-4 py-3">Overdue</th>
                    <th className="px-4 py-3">YTD</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.scores.map((item) => (
                    <tr key={item.topic}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{topicDisplayLabel(item)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${statusClasses(item.status)}`}>
                          {item.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.targetText}</td>
                      <td className="px-4 py-3 text-slate-700">{item.onTimeCount ?? 0}</td>
                      <td className="px-4 py-3 text-slate-700">{item.lateCount ?? 0}</td>
                      <td className="px-4 py-3 text-slate-700">{item.pendingCount ?? 0}</td>
                      <td className="px-4 py-3 text-slate-700">{item.activeCount ?? 0}</td>
                      <td className="px-4 py-3 text-slate-700">{item.overdueCount ?? 0}</td>
                      <td className="px-4 py-3 text-slate-700">{item.ytdCount ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <TooltipCell label="Result" value={item.resultText} />
                          <TooltipCell label="Comment" value={item.comment} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.scores.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={11}>
                        No RA topic submissions found for this period. Use `/forms/regulatory-affairs`.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
                </table>
              </div>
            </article>
          </div>
        ) : null}

        {!hasData ? (
          <article className="rounded-[18px] border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-700">
              No RA submissions found for this cut. Load data from <strong>/forms/regulatory-affairs</strong> and refresh.
            </p>
          </article>
        ) : null}

        {viewMode !== 'dashboard' && hasData && watch.length > 0 ? (
          <article className="rounded-[18px] border border-amber-200 bg-amber-50/30 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-amber-800">Watchlist</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {watch.map((item) => (
                <span
                  key={`watch-${item.topic}`}
                  className="inline-flex rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800"
                >
                  {topicDisplayLabel(item)}
                </span>
              ))}
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
