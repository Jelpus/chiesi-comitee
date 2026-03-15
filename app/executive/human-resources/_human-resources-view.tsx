import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { SectionHeader } from '@/components/ui/section-header';
import {
  getHumanResourcesAuditSources,
  getHumanResourcesTrainingOverview,
  getHumanResourcesTrainingUsers,
  getHumanResourcesTurnoverDepartments,
  getHumanResourcesTurnoverOverview,
} from '@/lib/data/human-resources';
import type { HumanResourcesTrainingUserRow } from '@/types/human-resources';

export type HumanResourcesViewMode = 'insights' | 'scorecard' | 'dashboard';

type SearchParams = {
  version?: string;
};

function modeHref(mode: HumanResourcesViewMode, params: SearchParams) {
  const query = new URLSearchParams();
  if (params.version) query.set('version', params.version);
  const queryText = query.toString();
  return `/executive/human-resources/${mode}${queryText ? `?${queryText}` : ''}`;
}

function formatPeriod(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function formatPercent(value: number | null) {
  if (value === null) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

function ModeTabs({ active, params }: { active: HumanResourcesViewMode; params: SearchParams }) {
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

function TopCards({
  turnoverExits,
  turnoverVoluntary,
  trainingHours,
  trainingCompletionRate,
  activeUsers,
}: {
  turnoverExits: number;
  turnoverVoluntary: number;
  trainingHours: number;
  trainingCompletionRate: number | null;
  activeUsers: number;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Turnover YTD</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {new Intl.NumberFormat('en-US').format(turnoverExits)}
        </p>
        <p className="mt-2 text-sm text-slate-600">Voluntary exits: {new Intl.NumberFormat('en-US').format(turnoverVoluntary)}</p>
      </article>
      <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Training YTD Hours</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(trainingHours)}
        </p>
      </article>
      <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Training Completion</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatPercent(trainingCompletionRate)}</p>
      </article>
      <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Active Learners YTD</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {new Intl.NumberFormat('en-US').format(activeUsers)}
        </p>
      </article>
    </div>
  );
}

function DashboardPanel({
  turnoverRows,
  trainingRows,
}: {
  turnoverRows: Awaited<ReturnType<typeof getHumanResourcesTurnoverDepartments>>;
  trainingRows: HumanResourcesTrainingUserRow[];
}) {
  return (
    <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Human Resources Dashboard</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Turnover & Training</h2>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-[16px] border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Turnover by Department</p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="py-2">Department</th>
                  <th className="py-2 text-right">Exits</th>
                  <th className="py-2 text-right">Voluntary</th>
                  <th className="py-2 text-right">Involuntary</th>
                </tr>
              </thead>
              <tbody>
                {turnoverRows.map((row) => (
                  <tr key={row.department} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2.5 text-slate-900">{row.department}</td>
                    <td className="py-2.5 text-right font-semibold text-slate-900">{row.exits}</td>
                    <td className="py-2.5 text-right text-slate-700">{row.voluntaryExits}</td>
                    <td className="py-2.5 text-right text-slate-700">{row.involuntaryExits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[16px] border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Training by User</p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="py-2">User</th>
                  <th className="py-2">People ID</th>
                  <th className="py-2 text-right">Hours</th>
                  <th className="py-2 text-right">Completion</th>
                </tr>
              </thead>
              <tbody>
                {trainingRows.map((row) => (
                  <tr key={`${row.userName}-${row.peopleId ?? 'na'}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2.5 text-slate-900">{row.userName}</td>
                    <td className="py-2.5 text-slate-700">{row.peopleId ?? 'N/A'}</td>
                    <td className="py-2.5 text-right font-semibold text-slate-900">{row.totalHours.toFixed(1)}</td>
                    <td className="py-2.5 text-right text-slate-700">{formatPercent(row.completionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </article>
  );
}

function NarrativePanel({
  turnoverExits,
  voluntaryExits,
  completionRate,
  activeUsers,
  title,
}: {
  turnoverExits: number;
  voluntaryExits: number;
  completionRate: number | null;
  activeUsers: number;
  title: string;
}) {
  return (
    <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-600">{title}</p>
      <div className="mt-3 space-y-3 text-sm text-slate-700">
        <p>YTD turnover exits are {turnoverExits}, with {voluntaryExits} voluntary exits tracked in this cut.</p>
        <p>Training completion is {formatPercent(completionRate)} across active learners ({activeUsers} users).</p>
      </div>
    </article>
  );
}

function AuditPanel({ rows }: { rows: Awaited<ReturnType<typeof getHumanResourcesAuditSources>> }) {
  return (
    <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Audit Context</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.sourceKey} className="rounded-[16px] border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{row.sourceLabel}</p>
            <p className="mt-2">Reporting Version: {row.reportingVersionId}</p>
            <p>Report Period: {formatPeriod(row.reportPeriodMonth)}</p>
            <p>Source As Of: {formatPeriod(row.sourceAsOfMonth)}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

const getCachedData = unstable_cache(
  async (reportingVersionId: string) => {
    const [auditSources, turnoverOverview, trainingOverview, turnoverRows, trainingRows] = await Promise.all([
      getHumanResourcesAuditSources(reportingVersionId || undefined),
      getHumanResourcesTurnoverOverview(reportingVersionId || undefined),
      getHumanResourcesTrainingOverview(reportingVersionId || undefined),
      getHumanResourcesTurnoverDepartments(reportingVersionId || undefined, 12),
      getHumanResourcesTrainingUsers(reportingVersionId || undefined, 15),
    ]);

    return { auditSources, turnoverOverview, trainingOverview, turnoverRows, trainingRows };
  },
  ['human-resources-v1'],
  { revalidate: 90 },
);

export async function HumanResourcesView({
  viewMode,
  searchParams = {},
}: {
  viewMode: HumanResourcesViewMode;
  searchParams?: SearchParams;
}) {
  const selectedReportingVersionId = searchParams.version ?? '';
  const data = await getCachedData(selectedReportingVersionId);

  const turnoverOverview = data.turnoverOverview;
  const trainingOverview = data.trainingOverview;

  return (
    <section className="space-y-4 pb-8">
      <SectionHeader
        eyebrow="Executive"
        title="Human Resources"
        description="Turnover and training control tower with traceable upload scope and enrichment-ready training users."
        actions={<ModeTabs active={viewMode} params={searchParams} />}
      />

      <TopCards
        turnoverExits={turnoverOverview?.ytdExits ?? 0}
        turnoverVoluntary={turnoverOverview?.ytdVoluntaryExits ?? 0}
        trainingHours={trainingOverview?.ytdTotalHours ?? 0}
        trainingCompletionRate={trainingOverview?.ytdCompletionRate ?? null}
        activeUsers={trainingOverview?.ytdActiveUsers ?? 0}
      />

      {viewMode === 'dashboard' ? (
        <DashboardPanel turnoverRows={data.turnoverRows} trainingRows={data.trainingRows} />
      ) : null}

      {viewMode === 'insights' ? (
        <NarrativePanel
          title="Insights"
          turnoverExits={turnoverOverview?.ytdExits ?? 0}
          voluntaryExits={turnoverOverview?.ytdVoluntaryExits ?? 0}
          completionRate={trainingOverview?.ytdCompletionRate ?? null}
          activeUsers={trainingOverview?.ytdActiveUsers ?? 0}
        />
      ) : null}

      {viewMode === 'scorecard' ? (
        <NarrativePanel
          title="Scorecard"
          turnoverExits={turnoverOverview?.ytdExits ?? 0}
          voluntaryExits={turnoverOverview?.ytdVoluntaryExits ?? 0}
          completionRate={trainingOverview?.ytdCompletionRate ?? null}
          activeUsers={trainingOverview?.ytdActiveUsers ?? 0}
        />
      ) : null}

      <AuditPanel rows={data.auditSources} />
    </section>
  );
}

