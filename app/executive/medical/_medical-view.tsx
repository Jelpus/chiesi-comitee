import Link from 'next/link';
import { SectionHeader } from '@/components/ui/section-header';
import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';
import { getMedicalData, type MedicalKpiStatus } from '@/lib/data/medical';

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

function formatResult(value: number | null, qtyUnit: string, fallbackText: string) {
  if (value == null) return fallbackText || 'N/A';
  if (qtyUnit === '%') return `${value.toFixed(1)}%`;
  if (qtyUnit.toLowerCase() === 'count' || qtyUnit.toLowerCase() === 'index') return `${Math.round(value)}`;
  return value.toFixed(1);
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

function TopCards({
  totalKpis,
  onTrack,
  watch,
  offTrack,
  averageCoveragePct,
}: {
  totalKpis: number;
  onTrack: number;
  watch: number;
  offTrack: number;
  averageCoveragePct: number | null;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">KPIs On Track</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {onTrack}/{totalKpis}
        </p>
        <p className="mt-1 text-xs text-slate-600">Current cut status</p>
      </article>
      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Watch KPIs</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{watch}</p>
        <p className="mt-1 text-xs text-slate-600">Needs follow-up</p>
      </article>
      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Off Track KPIs</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{offTrack}</p>
        <p className="mt-1 text-xs text-slate-600">Performance gap</p>
      </article>
      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Average Coverage</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatPercent(averageCoveragePct)}</p>
        <p className="mt-1 text-xs text-slate-600">Vs configured targets</p>
      </article>
    </div>
  );
}

type MedicalViewProps = {
  viewMode: MedicalViewMode;
  searchParams?: SearchParams;
};

export async function MedicalView({ viewMode, searchParams = {} }: MedicalViewProps) {
  const versions = await getReportingVersions();
  if (versions.length === 0) {
    throw new Error('No reporting versions found.');
  }
  const selectedVersion =
    versions.find((version) => version.reportingVersionId === searchParams.version) ?? versions[0];

  const data = await getMedicalData(selectedVersion.reportingVersionId, selectedVersion.periodMonth);
  const hasData = data.scores.length > 0;
  const working = data.scores.filter((item) => item.status === 'on_track');
  const needsImprove = data.scores.filter((item) => item.status === 'off_track');
  const watch = data.scores.filter((item) => item.status === 'watch');

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
          <span className="font-semibold text-slate-900">{formatMonth(data.sourceAsOfMonth)}</span>
        </span>
      </div>

      <div className="space-y-4">
        <TopCards
          totalKpis={data.summary.totalKpis}
          onTrack={data.summary.onTrack}
          watch={data.summary.watch}
          offTrack={data.summary.offTrack}
          averageCoveragePct={data.summary.averageCoveragePct}
        />

        {viewMode === 'insights' && hasData ? (
          <div className="grid gap-3 xl:grid-cols-2">
            <article className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Medical Narrative</p>
              <p className="mt-2 text-sm text-slate-700">
                Current cut shows <strong>{data.summary.onTrack}</strong> KPIs on track, <strong>{data.summary.watch}</strong> on watch,
                and <strong>{data.summary.offTrack}</strong> off track, with average coverage at{' '}
                <strong>{formatPercent(data.summary.averageCoveragePct)}</strong>.
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Main attention points: {needsImprove.length > 0 ? needsImprove.map((item) => item.kpiLabel).join(', ') : 'no critical KPI in this cut'}.
              </p>
            </article>
            <article className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Read For Next Layer</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                <li>Watchlist this cut: {watch.length} KPI(s).</li>
                <li>Use `/forms/medical` to update results and contextual comments.</li>
                <li>Next step: add 3-month trend by KPI to detect momentum shifts.</li>
              </ul>
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
                    <div key={item.kpiName} className="rounded-[10px] border border-emerald-200 bg-white px-3 py-2">
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
                {needsImprove.length > 0 ? (
                  needsImprove.map((item) => (
                    <div key={item.kpiName} className="rounded-[10px] border border-rose-200 bg-white px-3 py-2">
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

        {viewMode === 'dashboard' && hasData ? (
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
                      <div key={`coverage-${item.kpiName}`}>
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
                      <tr key={item.kpiName}>
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
                          <span
                            className="inline-flex cursor-help rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700"
                            title={item.comment || 'N/A'}
                          >
                            Comment
                          </span>
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

