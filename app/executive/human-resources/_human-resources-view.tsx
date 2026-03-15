import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { SectionHeader } from '@/components/ui/section-header';
import { TrainingRankingTable } from '@/components/executive/human-resources/training-ranking-table';
import {
  DepartmentContributionChart,
  GenderMixChart,
  MonthlyTrendComparisonChart,
  TrainingAnalyticsPanel,
  ThemeHorizontalBarChart,
  ThemePieChart,
  TopExitReasonsChart,
  TopManagersImpactChart,
  TrainingChartsPanel,
  TurnoverThemeChartsPanel,
} from '@/components/executive/human-resources/hr-dashboard-charts';
import {
  getHumanResourcesAuditSources,
  getHumanResourcesTrainingRanking,
  getHumanResourcesTrainingOverview,
  getHumanResourcesTrainingThemeData,
  getHumanResourcesTrainingUsers,
  getHumanResourcesTurnoverThemeData,
  getHumanResourcesTurnoverOverview,
} from '@/lib/data/human-resources';
import type {
  HumanResourcesTrainingUserRow,
  HumanResourcesTrainingRankingDimension,
  HumanResourcesTrainingRankingRow,
  HumanResourcesTrainingScope,
  HumanResourcesTrainingThemeData,
  HumanResourcesTurnoverScope,
  HumanResourcesTurnoverThemeData,
  HumanResourcesTurnoverThemeItem,
} from '@/types/human-resources';

export type HumanResourcesViewMode = 'insights' | 'scorecard' | 'dashboard';
type HumanResourcesDashboardTab = 'turnover' | 'training';

type SearchParams = {
  version?: string;
  hrTab?: string;
  turnoverScope?: string;
  trainingScope?: string;
};

function modeHref(mode: HumanResourcesViewMode, params: SearchParams) {
  const query = new URLSearchParams();
  if (params.version) query.set('version', params.version);
  const queryText = query.toString();
  return `/executive/human-resources/${mode}${queryText ? `?${queryText}` : ''}`;
}

function formatPeriod(value: string | null | undefined) {
  if (!value) return 'N/A';
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return 'N/A';

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch ? new Date(`${raw}T00:00:00Z`) : new Date(raw);

  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function resolveHeaderAuditContext(rows: Awaited<ReturnType<typeof getHumanResourcesAuditSources>>) {
  const reportPeriodMonth =
    rows.map((row) => row.reportPeriodMonth).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const sourceAsOfMonth =
    rows.map((row) => row.sourceAsOfMonth).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  return { reportPeriodMonth, sourceAsOfMonth };
}

function formatPercent(value: number | null) {
  if (value === null) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

function formatInt(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatSignedInt(value: number) {
  const abs = formatInt(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}

function formatSignedPercent(value: number | null) {
  if (value === null) return 'N/A';
  const pct = value * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
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
  trainingRows,
  trainingAreaRows,
  trainingEntityRows,
  trainingItemTypeRows,
  trainingInstructorRows,
  turnoverThemeData,
  trainingThemeData,
  activeTab,
  turnoverScope,
  trainingScope,
  params,
}: {
  trainingRows: HumanResourcesTrainingUserRow[];
  trainingAreaRows: HumanResourcesTrainingRankingRow[];
  trainingEntityRows: HumanResourcesTrainingRankingRow[];
  trainingItemTypeRows: HumanResourcesTrainingRankingRow[];
  trainingInstructorRows: HumanResourcesTrainingRankingRow[];
  turnoverThemeData: HumanResourcesTurnoverThemeData | null;
  trainingThemeData: HumanResourcesTrainingThemeData | null;
  activeTab: HumanResourcesDashboardTab;
  turnoverScope: HumanResourcesTurnoverScope;
  trainingScope: HumanResourcesTrainingScope;
  params: SearchParams;
}) {
  const buildTabHref = (tab: HumanResourcesDashboardTab) => {
    const query = new URLSearchParams();
    if (params.version) query.set('version', params.version);
    if (params.turnoverScope) query.set('turnoverScope', params.turnoverScope);
    if (params.trainingScope) query.set('trainingScope', params.trainingScope);
    query.set('hrTab', tab);
    const queryText = query.toString();
    return `/executive/human-resources/dashboard${queryText ? `?${queryText}` : ''}`;
  };
  const buildTurnoverScopeHref = (scope: HumanResourcesTurnoverScope) => {
    const query = new URLSearchParams();
    if (params.version) query.set('version', params.version);
    query.set('hrTab', 'turnover');
    query.set('turnoverScope', scope);
    if (params.trainingScope) query.set('trainingScope', params.trainingScope);
    const queryText = query.toString();
    return `/executive/human-resources/dashboard${queryText ? `?${queryText}` : ''}`;
  };
  const buildTrainingViewHref = (scope: HumanResourcesTrainingScope) => {
    const query = new URLSearchParams();
    if (params.version) query.set('version', params.version);
    query.set('hrTab', 'training');
    if (params.turnoverScope) query.set('turnoverScope', params.turnoverScope);
    query.set('trainingScope', scope);
    const queryText = query.toString();
    return `/executive/human-resources/dashboard${queryText ? `?${queryText}` : ''}`;
  };

  return (
    <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Human Resources Dashboard</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Turnover & Training</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={buildTabHref('turnover')}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
            activeTab === 'turnover'
              ? 'bg-slate-900 text-white shadow-[0_8px_22px_rgba(15,23,42,0.35)]'
              : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
          }`}
        >
          Turnover
        </Link>
        <Link
          href={buildTabHref('training')}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
            activeTab === 'training'
              ? 'bg-slate-900 text-white shadow-[0_8px_22px_rgba(15,23,42,0.35)]'
              : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
          }`}
        >
          Training
        </Link>
      </div>

      <div className="mt-4">
        {activeTab === 'turnover' ? (
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
              {(
                [
                  { key: 'total', label: 'Total' },
                  { key: 'voluntary', label: 'Voluntary' },
                  { key: 'involuntary', label: 'Involuntary' },
                ] as const
              ).map((scopeOption) => (
                <Link
                  key={scopeOption.key}
                  href={buildTurnoverScopeHref(scopeOption.key)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                    turnoverScope === scopeOption.key
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {scopeOption.label}
                </Link>
              ))}
            </div>

            <TurnoverTargetPanel scope={turnoverScope} data={turnoverThemeData} />
            {turnoverThemeData ? <TurnoverThemeChartsPanel themeData={turnoverThemeData} /> : null}
            <TurnoverThemeDetailsPanel data={turnoverThemeData} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Learning Analysis</p>
              <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
                {(
                  [
                    { key: 'total', label: 'Total' },
                    { key: 'online', label: 'Online' },
                    { key: 'face_to_face', label: 'Face to Face' },
                  ] as const
                ).map((scopeOption) => (
                  <Link
                    key={scopeOption.key}
                    href={buildTrainingViewHref(scopeOption.key)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                      trainingScope === scopeOption.key
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {scopeOption.label}
                  </Link>
                ))}
              </div>
            </div>

            {trainingThemeData ? (
              <article className="rounded-[16px] border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Learning Scorecard</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Trained Employees YTD</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(trainingThemeData.summary.trainedEmployeesYtd)}</p>
                  </div>
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Coverage YTD</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{formatPercent(trainingThemeData.summary.coverageRateYtd)}</p>
                  </div>
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Completed Events YTD</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(trainingThemeData.summary.completedEventsYtd)}</p>
                  </div>
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Learning Hours YTD</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(trainingThemeData.summary.learningHoursYtd)}</p>
                  </div>
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Avg Hours / Trained</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{trainingThemeData.summary.avgHoursPerTrainedEmployeeYtd == null ? 'N/A' : trainingThemeData.summary.avgHoursPerTrainedEmployeeYtd.toFixed(1)}</p>
                  </div>
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Growth vs PY (Hours)</p>
                    <p className={`mt-1 text-xl font-semibold ${(trainingThemeData.summary.growthVsPyLearningHoursPct ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatSignedPercent(trainingThemeData.summary.growthVsPyLearningHoursPct)}
                    </p>
                  </div>
                </div>
              </article>
            ) : null}

            {trainingThemeData ? (
              <TrainingAnalyticsPanel data={trainingThemeData} metricMode="hours" />
            ) : null}

            <TrainingChartsPanel trainingRows={trainingRows} areaRankingRows={trainingAreaRows} />

            <TrainingRankingTable
              rowsByDimension={{
                area: trainingAreaRows,
                entity_title: trainingEntityRows,
                item_type: trainingItemTypeRows,
                instructor: trainingInstructorRows,
              }}
            />
          </div>
        )}
      </div>
    </article>
  );
}

function ScopeLabel({ scope }: { scope: HumanResourcesTurnoverScope }) {
  const label =
    scope === 'voluntary' ? 'Voluntary Turnover' : scope === 'involuntary' ? 'Involuntary Turnover' : 'Total Turnover';
  return <span className="text-slate-900">{label}</span>;
}

function ThemeList({
  title,
  rows,
}: {
  title: string;
  rows: HumanResourcesTurnoverThemeItem[];
}) {
  return (
    <article className="rounded-[16px] border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{title}</p>
      <div className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="rounded-[10px] border border-slate-100 bg-slate-50/70 px-3 py-2">
            <p className="font-medium text-slate-900">{row.label}</p>
            <p className="text-xs text-slate-600">
              YTD: {formatInt(row.currentYtdExits)} | PY: {formatInt(row.previousYtdExits)} | Growth:{' '}
              <span className={row.growthVsPyPct !== null && row.growthVsPyPct > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                {formatSignedPercent(row.growthVsPyPct)}
              </span>
              {' '}| Contribution: {formatPercent(row.contributionPct)}
            </p>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm text-slate-500">No data available.</p> : null}
      </div>
    </article>
  );
}

function TurnoverTargetPanel({
  data,
  scope,
}: {
  data: HumanResourcesTurnoverThemeData | null;
  scope: HumanResourcesTurnoverScope;
}) {
  if (!data) {
    return (
      <article className="rounded-[16px] border border-slate-200 bg-white p-4 text-sm text-slate-600">
        No turnover YTD data available for selected scope.
      </article>
    );
  }

  return (
    <article className="rounded-[16px] border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
        Target & Status · <ScopeLabel scope={scope} />
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Current YTD</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(data.summary.currentYtdExits)}</p>
        </div>
        <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">PY YTD</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(data.summary.previousYtdExits)}</p>
        </div>
        <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Target YTD (-15% vs PY)</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(data.summary.targetYtdExits)}</p>
        </div>
        <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Variance vs Target</p>
          <p className={`mt-1 text-xl font-semibold ${data.summary.varianceVsTarget <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatSignedInt(data.summary.varianceVsTarget)}
          </p>
        </div>
        <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Growth vs PY</p>
          <p className={`mt-1 text-xl font-semibold ${data.summary.growthVsPyPct !== null && data.summary.growthVsPyPct <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatSignedPercent(data.summary.growthVsPyPct)}
          </p>
        </div>
        <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Target Status</p>
          <p className={`mt-1 text-base font-semibold ${data.summary.onTrackToTarget ? 'text-emerald-700' : 'text-rose-700'}`}>
            {data.summary.onTrackToTarget ? 'On Track' : 'Above Target'}
          </p>
        </div>
      </div>
    </article>
  );
}

function TurnoverThemeDetailsPanel({ data }: { data: HumanResourcesTurnoverThemeData | null }) {
  if (!data) return null;
  const keyRoleMetrics = data.keyRoleMetrics ?? {
    keyPeopleExits: 0,
    keyPeopleSharePct: null,
    keyPositionExits: 0,
    keyPositionSharePct: null,
  };
  const riskIndices = data.riskIndices ?? {
    attritionRiskIndex: 0,
    compensationRiskIndex: 0,
    hiringQualityRiskIndex: 0,
  };
  const monthlyTrend = data.monthlyTrend ?? [];
  const insights = data.insights ?? [];
  return (
    <div className="space-y-4">
      <article className="rounded-[16px] border border-slate-200 bg-slate-50/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Where Is Turnover Happening</p>
        <div className="mt-3 grid gap-4 xl:grid-cols-3">
          <DepartmentContributionChart rows={data.topDepartments} />
          <ThemeHorizontalBarChart title="Territory Hotspots" rows={data.topTerritories} color="#0891b2" />
          <TopManagersImpactChart rows={data.topManagers} />
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <ThemeList title="Department Hotspots" rows={data.topDepartments} />
          <ThemeList title="Territory Hotspots" rows={data.topTerritories} />
          <ThemeList title="Leadership Hotspots · Managers" rows={data.topManagers} />
        </div>
      </article>

      <article className="rounded-[16px] border border-slate-200 bg-slate-50/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Who Is Leaving</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[12px] border border-slate-200 bg-white p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Key People Exits</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(keyRoleMetrics.keyPeopleExits)}</p>
            <p className="text-xs text-slate-600">{formatPercent(keyRoleMetrics.keyPeopleSharePct)} of turnover</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-white p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Key Position Exits</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(keyRoleMetrics.keyPositionExits)}</p>
            <p className="text-xs text-slate-600">{formatPercent(keyRoleMetrics.keyPositionSharePct)} of turnover</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-white p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Attrition Risk Index</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(riskIndices.attritionRiskIndex)}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-white p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Hiring Quality Risk</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(riskIndices.hiringQualityRiskIndex)}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <ThemeHorizontalBarChart title="Tenure Mix · Seniority" rows={data.seniorityMix} color="#8b5cf6" />
          <ThemePieChart title="Age Mix" rows={data.ageMix} />
          <GenderMixChart rows={data.genderMix} />
        </div>
      </article>

      <article className="rounded-[16px] border border-slate-200 bg-slate-50/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Why Employees Leave</p>
        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          <TopExitReasonsChart rows={data.topReasons} />
          <ThemeList title="People Drivers · Reasons" rows={data.topReasons} />
        </div>
      </article>

      <article className="rounded-[16px] border border-slate-200 bg-slate-50/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Compensation & Early Attrition</p>
        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          <ThemePieChart title="Compensation Signal · Salary Band" rows={data.compensationMix} />
          <ThemeHorizontalBarChart title="Early Attrition Distribution" rows={data.earlyAttritionMix} color="#f59e0b" />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-[12px] border border-slate-200 bg-white p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Compensation Risk Index</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(riskIndices.compensationRiskIndex)}</p>
          </div>
          {insights.map((insight) => (
            <div
              key={`${insight.type}-${insight.title}`}
              className={`rounded-[12px] border p-3 ${
                insight.severity === 'negative'
                  ? 'border-rose-200 bg-rose-50/70'
                  : insight.severity === 'warning'
                    ? 'border-amber-200 bg-amber-50/70'
                    : insight.severity === 'positive'
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : 'border-slate-200 bg-white'
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{insight.type}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{insight.title}</p>
              <p className="mt-1 text-xs text-slate-700">{insight.message}</p>
            </div>
          ))}
        </div>
      </article>

      <MonthlyTrendComparisonChart rows={monthlyTrend} />
    </div>
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

function InsightsPanel({
  turnoverThemeTotal,
  trainingThemeTotal,
}: {
  turnoverThemeTotal: HumanResourcesTurnoverThemeData | null;
  trainingThemeTotal: HumanResourcesTrainingThemeData | null;
}) {
  const turnoverInsights = turnoverThemeTotal?.insights ?? [];
  const trainingInsights = trainingThemeTotal?.insights ?? [];
  return (
    <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Insights</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Turnover Signals</p>
          {turnoverInsights.map((insight) => (
            <div
              key={`turnover-${insight.type}-${insight.title}`}
              className={`rounded-[12px] border p-3 ${
                insight.severity === 'negative'
                  ? 'border-rose-200 bg-rose-50/70'
                  : insight.severity === 'warning'
                    ? 'border-amber-200 bg-amber-50/70'
                    : insight.severity === 'positive'
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{insight.type}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{insight.title}</p>
              <p className="mt-1 text-xs text-slate-700">{insight.message}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Learning Signals</p>
          {trainingInsights.map((insight) => (
            <div
              key={`training-${insight.type}-${insight.title}`}
              className={`rounded-[12px] border p-3 ${
                insight.severity === 'negative'
                  ? 'border-rose-200 bg-rose-50/70'
                  : insight.severity === 'warning'
                    ? 'border-amber-200 bg-amber-50/70'
                    : insight.severity === 'positive'
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{insight.type}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{insight.title}</p>
              <p className="mt-1 text-xs text-slate-700">{insight.message}</p>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function ScorecardPanel({
  turnoverThemeTotal,
  trainingCompletionRate,
  trainingActiveUsers,
}: {
  turnoverThemeTotal: HumanResourcesTurnoverThemeData | null;
  trainingCompletionRate: number | null;
  trainingActiveUsers: number;
}) {
  const summary = turnoverThemeTotal?.summary;
  const topDepartment = turnoverThemeTotal?.topDepartments?.[0];
  const topReason = turnoverThemeTotal?.topReasons?.[0];
  const keyPositionShare = turnoverThemeTotal?.keyRoleMetrics?.keyPositionSharePct ?? null;

  const turnoverStatus =
    summary == null ? 'N/A' : summary.onTrackToTarget ? 'On Track' : 'Above Target';
  const trainingStatus =
    trainingCompletionRate == null
      ? 'N/A'
      : trainingCompletionRate >= 0.85
        ? 'Healthy'
        : trainingCompletionRate >= 0.7
          ? 'Watch'
          : 'At Risk';

  const working: string[] = [];
  const improve: string[] = [];
  const actions: string[] = [];

  if (summary?.onTrackToTarget) {
    working.push(`Turnover is below target (${formatSignedInt(summary.varianceVsTarget)} vs target).`);
  } else if (summary) {
    improve.push(`Turnover is above target by ${formatSignedInt(summary.varianceVsTarget)} exits.`);
    actions.push('Launch retention sprint in top-exit departments and managers during next 30 days.');
  }

  if (trainingCompletionRate != null && trainingCompletionRate >= 0.85) {
    working.push(`Training completion is strong at ${formatPercent(trainingCompletionRate)}.`);
  } else if (trainingCompletionRate != null) {
    improve.push(`Training completion is ${formatPercent(trainingCompletionRate)} and below desired threshold.`);
    actions.push('Define mandatory completion checkpoints and weekly follow-up for overdue learners.');
  }

  if ((topDepartment?.contributionPct ?? 0) >= 0.35) {
    improve.push(
      `${topDepartment?.label} concentrates ${formatPercent(topDepartment?.contributionPct ?? null)} of total exits.`,
    );
    actions.push(`Run targeted manager review and workload calibration in ${topDepartment?.label}.`);
  }

  if ((topReason?.contributionPct ?? 0) >= 0.3) {
    improve.push(`${topReason?.label} is the leading exit driver (${formatPercent(topReason?.contributionPct ?? null)}).`);
    actions.push('Set a reason-specific action plan with HRBP owners and monthly KPI check.');
  }

  if ((keyPositionShare ?? 0) >= 0.1) {
    improve.push(`Key position exposure is high (${formatPercent(keyPositionShare)} of exits).`);
    actions.push('Prioritize succession coverage and retention incentives for critical roles.');
  }

  if (working.length === 0) working.push('No clear positive outlier detected in this cut.');
  if (improve.length === 0) improve.push('No major deterioration signal detected in this cut.');
  if (actions.length === 0) actions.push('Maintain current operating cadence and monitor monthly deltas.');

  const turnoverStatusClass =
    turnoverStatus === 'On Track'
      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
      : turnoverStatus === 'Above Target'
        ? 'border-rose-200 bg-rose-50/70 text-rose-800'
        : 'border-slate-200 bg-slate-50 text-slate-700';
  const trainingStatusClass =
    trainingStatus === 'Healthy'
      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
      : trainingStatus === 'Watch'
        ? 'border-amber-200 bg-amber-50/70 text-amber-800'
        : trainingStatus === 'At Risk'
          ? 'border-rose-200 bg-rose-50/70 text-rose-800'
          : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <div className="space-y-4">
      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">HR Performance Map</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[16px] border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Turnover</p>
            <p className="mt-2 text-sm text-slate-700">
              YTD {formatInt(summary?.currentYtdExits ?? 0)} | PY {formatInt(summary?.previousYtdExits ?? 0)} | Target{' '}
              {formatInt(summary?.targetYtdExits ?? 0)}
            </p>
            <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${turnoverStatusClass}`}>
              {turnoverStatus}
            </span>
          </div>
          <div className="rounded-[16px] border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Training</p>
            <p className="mt-2 text-sm text-slate-700">
              Completion {formatPercent(trainingCompletionRate)} | Active learners {formatInt(trainingActiveUsers)}
            </p>
            <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${trainingStatusClass}`}>
              {trainingStatus}
            </span>
          </div>
        </div>
      </article>

      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">What Is Working</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          {working.map((item) => (
            <p key={item}>• {item}</p>
          ))}
        </div>
      </article>

      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">What Needs To Improve</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          {improve.map((item) => (
            <p key={item}>• {item}</p>
          ))}
        </div>
      </article>

      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Action Plan Priorities</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          {actions.map((item) => (
            <p key={item}>• {item}</p>
          ))}
        </div>
      </article>
    </div>
  );
}

function ScorecardPanelV2({
  turnoverThemeTotal,
  trainingThemeTotal,
}: {
  turnoverThemeTotal: HumanResourcesTurnoverThemeData | null;
  trainingThemeTotal: HumanResourcesTrainingThemeData | null;
}) {
  const summary = turnoverThemeTotal?.summary;
  const topDepartment = turnoverThemeTotal?.topDepartments?.[0];
  const topReason = turnoverThemeTotal?.topReasons?.[0];
  const keyPositionShare = turnoverThemeTotal?.keyRoleMetrics?.keyPositionSharePct ?? null;

  const turnoverStatus =
    summary == null ? 'N/A' : summary.onTrackToTarget ? 'On Track' : 'Above Target';
  const trainingCoverage = trainingThemeTotal?.summary.coverageRateYtd ?? null;
  const trainingActiveUsers = trainingThemeTotal?.summary.activeEmployeesYtd ?? 0;
  const hasTrainingPy =
    (trainingThemeTotal?.summary.trainedEmployeesPy ?? 0) > 0 ||
    (trainingThemeTotal?.summary.completedEventsPy ?? 0) > 0 ||
    (trainingThemeTotal?.summary.learningHoursPy ?? 0) > 0;
  const trainingStatus =
    trainingCoverage == null
      ? 'N/A'
      : trainingCoverage >= 0.85
        ? 'Healthy'
        : trainingCoverage >= 0.7
          ? 'Watch'
          : 'At Risk';

  const working: string[] = [];
  const improve: string[] = [];
  const actions: string[] = [];

  if (summary?.onTrackToTarget) {
    working.push(`TOV|||Turnover is below target (${formatSignedInt(summary.varianceVsTarget)} vs target).`);
  } else if (summary) {
    improve.push(`TOV|||Turnover is above target by ${formatSignedInt(summary.varianceVsTarget)} exits.`);
    actions.push('TOV|||Launch retention sprint in top-exit departments and managers during next 30 days.');
  }

  if (hasTrainingPy && (trainingThemeTotal?.summary.growthVsPyLearningHoursPct ?? 0) > 0) {
    working.push(
      `TRN|||Learning hours are up ${formatSignedPercent(trainingThemeTotal?.summary.growthVsPyLearningHoursPct ?? null)} vs PY.`,
    );
  }

  if (trainingCoverage != null && trainingCoverage >= 0.85) {
    working.push(`TRN|||Training coverage is strong at ${formatPercent(trainingCoverage)}.`);
  } else if (trainingCoverage != null) {
    improve.push(`TRN|||Training coverage is ${formatPercent(trainingCoverage)} and below desired threshold.`);
    actions.push('TRN|||Define mandatory completion checkpoints and weekly follow-up for overdue learners.');
  }

  if ((trainingThemeTotal?.top10UsersHoursSharePct ?? 0) >= 0.45) {
    improve.push(
      `TRN|||Learning is concentrated: top 10% users account for ${formatPercent(trainingThemeTotal?.top10UsersHoursSharePct ?? null)} of hours.`,
    );
    actions.push('TRN|||Expand participation breadth by manager with monthly coverage quotas.');
  }

  if ((trainingThemeTotal?.top10UsersHoursSharePct ?? 0) < 0.35 && (trainingThemeTotal?.top10UsersHoursSharePct ?? 0) > 0) {
    working.push(
      `TRN|||Learning load is well distributed (top 10% users = ${formatPercent(trainingThemeTotal?.top10UsersHoursSharePct ?? null)} of hours).`,
    );
  }

  if ((trainingThemeTotal?.contentOlderThan12MonthsSharePct ?? 0) >= 0.3) {
    improve.push(
      `TRN|||Content freshness risk: ${formatPercent(trainingThemeTotal?.contentOlderThan12MonthsSharePct ?? null)} of events are based on content older than 12 months.`,
    );
    actions.push('TRN|||Refresh learning catalog for high-consumption titles older than 12 months.');
  } else if ((trainingThemeTotal?.recentRevisionSharePct ?? 0) >= 0.5) {
    working.push(
      `TRN|||Freshness is healthy: ${formatPercent(trainingThemeTotal?.recentRevisionSharePct ?? null)} of events use recently revised content.`,
    );
  }

  if ((trainingThemeTotal?.creditsEventSharePct ?? 0) >= 0.25) {
    working.push(
      `TRN|||Professional value is visible: ${formatPercent(trainingThemeTotal?.creditsEventSharePct ?? null)} of events generate formal credits/contact hours/CPE.`,
    );
  } else if ((trainingThemeTotal?.creditsEventSharePct ?? 0) > 0) {
    improve.push(
      `TRN|||Professional-credit intensity is low (${formatPercent(trainingThemeTotal?.creditsEventSharePct ?? null)} of events with credits/contact/CPE).`,
    );
    actions.push('TRN|||Increase share of credit-bearing trainings in core curriculum.');
  }

  if ((trainingThemeTotal?.zeroCostTrainingSharePct ?? 0) >= 0.8) {
    improve.push(
      `TRN|||Training is mostly zero-cost (${formatPercent(trainingThemeTotal?.zeroCostTrainingSharePct ?? null)}), which may hide underreported external investment.`,
    );
    actions.push('TRN|||Validate tuition capture quality and tag paid trainings consistently.');
  }

  if ((topDepartment?.contributionPct ?? 0) >= 0.35) {
    improve.push(
      `TOV|||${topDepartment?.label} concentrates ${formatPercent(topDepartment?.contributionPct ?? null)} of total exits.`,
    );
    actions.push(`TOV|||Run targeted manager review and workload calibration in ${topDepartment?.label}.`);
  }

  if ((topReason?.contributionPct ?? 0) >= 0.3) {
    improve.push(`TOV|||${topReason?.label} is the leading exit driver (${formatPercent(topReason?.contributionPct ?? null)}).`);
    actions.push('TOV|||Set a reason-specific action plan with HRBP owners and monthly KPI check.');
  }

  if ((keyPositionShare ?? 0) >= 0.1) {
    improve.push(`TOV|||Key position exposure is high (${formatPercent(keyPositionShare)} of exits).`);
    actions.push('TOV|||Prioritize succession coverage and retention incentives for critical roles.');
  }

  if (working.length === 0) working.push('TOV|||No clear positive outlier detected in this cut.');
  if (improve.length === 0) improve.push('TOV|||No major deterioration signal detected in this cut.');
  if (actions.length === 0) actions.push('TOV|||Maintain current operating cadence and monitor monthly deltas.');

  const turnoverStatusClass =
    turnoverStatus === 'On Track'
      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
      : turnoverStatus === 'Above Target'
        ? 'border-rose-200 bg-rose-50/70 text-rose-800'
        : 'border-slate-200 bg-slate-50 text-slate-700';
  const trainingStatusClass =
    trainingStatus === 'Healthy'
      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
      : trainingStatus === 'Watch'
        ? 'border-amber-200 bg-amber-50/70 text-amber-800'
        : trainingStatus === 'At Risk'
          ? 'border-rose-200 bg-rose-50/70 text-rose-800'
          : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <div className="space-y-4">
      <article className="rounded-[24px] border border-indigo-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-indigo-700">HR Performance Map</p>
          <p className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
            YTD vs PY + Target + Completion
          </p>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className="rounded-[14px] border border-rose-200 bg-rose-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Turnover</p>
            <p className="mt-1 text-xs text-rose-900">Exit pressure, target attainment and concentration risk.</p>
            <p className="mt-2 text-xs text-slate-700">
              YTD {formatInt(summary?.currentYtdExits ?? 0)} | PY {formatInt(summary?.previousYtdExits ?? 0)} | Target{' '}
              {formatInt(summary?.targetYtdExits ?? 0)}
            </p>
            <p className="mt-1 text-xs text-slate-700">
              Main driver: {topReason?.label ?? 'N/A'} ({formatPercent(topReason?.contributionPct ?? null)}).
            </p>
            <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${turnoverStatusClass}`}>
              {turnoverStatus}
            </span>
          </div>
          <div className="rounded-[14px] border border-cyan-200 bg-cyan-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">Training</p>
            <p className="mt-1 text-xs text-cyan-900">Capability activation and learning adoption level.</p>
            <p className="mt-2 text-xs text-slate-700">
              Coverage {formatPercent(trainingCoverage)} | Active employees {formatInt(trainingActiveUsers)}
            </p>
            <p className="mt-1 text-xs text-slate-700">Priority scope: enforce completion cadence by manager and department.</p>
            <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${trainingStatusClass}`}>
              {trainingStatus}
            </span>
          </div>
        </div>
      </article>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[24px] border border-emerald-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">What Is Working</p>
          <div className="mt-3 space-y-2">
            {working.map((item, index) => {
              const [tag, message] = item.includes('|||') ? item.split('|||') : ['TOV', item];
              return (
              <div key={`working-${item}`} className="rounded-[12px] border border-emerald-200 bg-emerald-50/60 p-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] ${
                      tag === 'TRN'
                        ? 'border-blue-200 bg-blue-50 text-blue-800'
                        : 'border-slate-300 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {tag}
                  </span>
                  <p className="text-xs text-slate-700">{message}</p>
                </div>
              </div>
            )})}
          </div>
        </article>

        <article className="rounded-[24px] border border-rose-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <p className="text-xs uppercase tracking-[0.16em] text-rose-700">What Needs To Improve</p>
          <div className="mt-3 space-y-2">
            {improve.map((item, index) => {
              const [tag, message] = item.includes('|||') ? item.split('|||') : ['TOV', item];
              return (
              <div key={`improve-${item}`} className="rounded-[12px] border border-rose-200 bg-rose-50/60 p-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] ${
                      tag === 'TRN'
                        ? 'border-blue-200 bg-blue-50 text-blue-800'
                        : 'border-slate-300 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {tag}
                  </span>
                  <p className="text-xs text-slate-700">{message}</p>
                </div>
              </div>
            )})}
          </div>
        </article>
      </div>

      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Action Plan Priorities</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {actions.map((item, index) => {
            const [tag, message] = item.includes('|||') ? item.split('|||') : ['TOV', item];
            return (
            <div key={`action-${item}`} className="rounded-[12px] border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Priority {index + 1}</p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] ${
                    tag === 'TRN'
                      ? 'border-blue-200 bg-blue-50 text-blue-800'
                      : 'border-slate-300 bg-slate-50 text-slate-700'
                  }`}
                >
                  {tag}
                </span>
                <p className="text-xs text-slate-700">{message}</p>
              </div>
            </div>
          )})}
        </div>
      </article>
    </div>
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
    const [
      auditSources,
      turnoverOverview,
      trainingOverview,
      trainingRows,
      turnoverThemeTotal,
      turnoverThemeVoluntary,
      turnoverThemeInvoluntary,
      trainingThemeTotal,
      trainingThemeOnline,
      trainingThemeFaceToFace,
    ] = await Promise.all([
      getHumanResourcesAuditSources(reportingVersionId || undefined),
      getHumanResourcesTurnoverOverview(reportingVersionId || undefined),
      getHumanResourcesTrainingOverview(reportingVersionId || undefined),
      getHumanResourcesTrainingUsers(reportingVersionId || undefined, 15),
      getHumanResourcesTurnoverThemeData(reportingVersionId || undefined, 'total'),
      getHumanResourcesTurnoverThemeData(reportingVersionId || undefined, 'voluntary'),
      getHumanResourcesTurnoverThemeData(reportingVersionId || undefined, 'involuntary'),
      getHumanResourcesTrainingThemeData(reportingVersionId || undefined, 'total'),
      getHumanResourcesTrainingThemeData(reportingVersionId || undefined, 'online'),
      getHumanResourcesTrainingThemeData(reportingVersionId || undefined, 'face_to_face'),
    ]);

    return {
      auditSources,
      turnoverOverview,
      trainingOverview,
      trainingRows,
      turnoverThemeTotal,
      turnoverThemeVoluntary,
      turnoverThemeInvoluntary,
      trainingThemeTotal,
      trainingThemeOnline,
      trainingThemeFaceToFace,
    };
  },
  ['human-resources-v3'],
  { revalidate: 90 },
);

const getCachedTrainingRanking = unstable_cache(
  async (
    reportingVersionId: string,
    trainingScope: HumanResourcesTrainingScope,
    trainingRankingBy: HumanResourcesTrainingRankingDimension,
  ) => getHumanResourcesTrainingRanking(reportingVersionId || undefined, trainingScope, trainingRankingBy, 24),
  ['human-resources-training-ranking-v1'],
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
  const activeDashboardTab: HumanResourcesDashboardTab =
    searchParams.hrTab === 'training' ? 'training' : 'turnover';
  const turnoverScope: HumanResourcesTurnoverScope =
    searchParams.turnoverScope === 'voluntary' || searchParams.turnoverScope === 'involuntary'
      ? searchParams.turnoverScope
      : 'total';
  const trainingScope: HumanResourcesTrainingScope =
    searchParams.trainingScope === 'online' || searchParams.trainingScope === 'face_to_face'
      ? searchParams.trainingScope
      : 'total';
  const data = await getCachedData(selectedReportingVersionId);
  const trainingAreaRows = await getCachedTrainingRanking(
    selectedReportingVersionId,
    trainingScope,
    'area',
  );
  const trainingEntityRows = await getCachedTrainingRanking(
    selectedReportingVersionId,
    trainingScope,
    'entity_title',
  );
  const trainingItemTypeRows = await getCachedTrainingRanking(
    selectedReportingVersionId,
    trainingScope,
    'item_type',
  );
  const trainingInstructorRows = await getCachedTrainingRanking(
    selectedReportingVersionId,
    trainingScope,
    'instructor',
  );
  const turnoverThemeData =
    turnoverScope === 'voluntary'
      ? data.turnoverThemeVoluntary
      : turnoverScope === 'involuntary'
        ? data.turnoverThemeInvoluntary
        : data.turnoverThemeTotal;
  const trainingThemeData =
    trainingScope === 'online'
      ? data.trainingThemeOnline
      : trainingScope === 'face_to_face'
        ? data.trainingThemeFaceToFace
        : data.trainingThemeTotal;

  const turnoverOverview = data.turnoverOverview;
  const trainingOverview = data.trainingOverview;
  const auditHeader = resolveHeaderAuditContext(data.auditSources);
  const headerReportPeriod =
    turnoverOverview?.reportPeriodMonth ??
    trainingOverview?.reportPeriodMonth ??
    auditHeader.reportPeriodMonth;
  const headerSourceAsOf =
    turnoverOverview?.sourceAsOfMonth ??
    trainingOverview?.sourceAsOfMonth ??
    auditHeader.sourceAsOfMonth;

  return (
    <section className="space-y-4 pb-8">
      <SectionHeader
        eyebrow="Executive"
        title="Human Resources"
        description="Turnover and training control tower with traceable upload scope and enrichment-ready training users."
        actions={<ModeTabs active={viewMode} params={searchParams} />}
      />
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
          <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Report Period</span>
          <span className="font-semibold text-slate-900">{formatPeriod(headerReportPeriod)}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
          <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Source As Of</span>
          <span className="font-semibold text-slate-900">{formatPeriod(headerSourceAsOf)}</span>
        </span>
      </div>

      <TopCards
        turnoverExits={turnoverOverview?.ytdExits ?? 0}
        turnoverVoluntary={turnoverOverview?.ytdVoluntaryExits ?? 0}
        trainingHours={trainingOverview?.ytdTotalHours ?? 0}
        trainingCompletionRate={trainingOverview?.ytdCompletionRate ?? null}
        activeUsers={trainingOverview?.ytdActiveUsers ?? 0}
      />

      {viewMode === 'dashboard' ? (
        <DashboardPanel
          trainingRows={data.trainingRows}
          trainingAreaRows={trainingAreaRows}
          trainingEntityRows={trainingEntityRows}
          trainingItemTypeRows={trainingItemTypeRows}
          trainingInstructorRows={trainingInstructorRows}
          turnoverThemeData={turnoverThemeData}
          trainingThemeData={trainingThemeData}
          activeTab={activeDashboardTab}
          turnoverScope={turnoverScope}
          trainingScope={trainingScope}
          params={searchParams}
        />
      ) : null}

      {viewMode === 'insights' ? (
        <InsightsPanel
          turnoverThemeTotal={data.turnoverThemeTotal}
          trainingThemeTotal={data.trainingThemeTotal}
        />
      ) : null}

      {viewMode === 'scorecard' ? (
        <ScorecardPanelV2
          turnoverThemeTotal={data.turnoverThemeTotal}
          trainingThemeTotal={data.trainingThemeTotal}
        />
      ) : null}

      <AuditPanel rows={data.auditSources} />
    </section>
  );
}
