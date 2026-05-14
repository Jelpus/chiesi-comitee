import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import type { ReactNode } from 'react';
import { SectionHeader } from '@/components/ui/section-header';
import { OpenVacancyPanelClient } from '@/components/executive/human-resources/open-vacancy-panel-client';
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
  getHumanResourcesOpenVacancyData,
  getHumanResourcesTrainingRanking,
  getHumanResourcesTrainingOverview,
  getHumanResourcesTrainingThemeData,
  getHumanResourcesTrainingUsers,
  getHumanResourcesTurnoverThemeData,
  getHumanResourcesTurnoverOverview,
} from '@/lib/data/human-resources';
import { getOpexRows } from '@/lib/data/opex';
import type { OpexRow } from '@/lib/data/opex';
import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';
import type {
  HumanResourcesTrainingUserRow,
  HumanResourcesOpenVacancyBreakdownRow,
  HumanResourcesOpenVacancyData,
  HumanResourcesTrainingRankingDimension,
  HumanResourcesTrainingRankingRow,
  HumanResourcesTrainingScope,
  HumanResourcesTrainingThemeData,
  HumanResourcesTurnoverScope,
  HumanResourcesTurnoverThemeData,
  HumanResourcesTurnoverThemeItem,
} from '@/types/human-resources';

export type HumanResourcesViewMode = 'insights' | 'scorecard' | 'dashboard';
type HumanResourcesDashboardTab = 'turnover' | 'training' | 'payroll' | 'open_vacancy';

type SearchParams = {
  version?: string;
  hrTab?: string;
  turnoverScope?: string;
  trainingScope?: string;
  vacancyStatus?: string;
  vacancyOpening?: string;
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
    <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
      <span>{children}</span>
      <KpiHelp text={help} />
    </p>
  );
}

function formatAmount(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatOpexPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(1)}%`;
}

function formatSignedOpexPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatSignedAmount(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  const formatted = formatAmount(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function normalizeOpexText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getMetricYear(metricName: string): number | null {
  const match = metricName.match(/(\d{4})$/);
  if (!match) return null;
  return Number(match[1]);
}

function resolvePayrollMetricMap(rows: OpexRow[]) {
  const metrics = [...new Set(rows.map((row) => row.metricName))];
  const actualMetrics = metrics.filter((metric) => metric.startsWith('actuals_'));
  const budgetMetrics = metrics.filter((metric) => metric.startsWith('budget_'));
  const actualSorted = actualMetrics
    .map((metric) => ({ metric, year: getMetricYear(metric) ?? -1 }))
    .sort((a, b) => b.year - a.year);
  const currentActual = actualSorted[0]?.metric ?? null;
  const pyActual = actualSorted[1]?.metric ?? null;
  const currentYear = getMetricYear(currentActual ?? '');
  const currentBudget = budgetMetrics.find((metric) => getMetricYear(metric) === currentYear) ?? null;
  return { currentActual, pyActual, currentBudget, currentYear };
}

type PayrollAchievementBreakdownRow = {
  label: string;
  actual: number;
  budget: number;
  py: number;
  achievementPct: number | null;
  variance: number;
  vsPyPct: number | null;
  sharePct: number | null;
};

type PayrollAchievementData = {
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  latestPeriodMonth: string | null;
  ytd: {
    actual: number;
    budget: number;
    py: number;
    achievementPct: number | null;
    variance: number;
    vsPyPct: number | null;
  };
  mth: {
    actual: number;
    budget: number;
    py: number;
    achievementPct: number | null;
    variance: number;
    vsPyPct: number | null;
  };
  byCecoGroup: PayrollAchievementBreakdownRow[];
  byBusinessUnit: PayrollAchievementBreakdownRow[];
};

function buildPayrollAchievementData(rows: OpexRow[]): PayrollAchievementData | null {
  const payrollRows = rows.filter((row) => normalizeOpexText(row.element) === 'base salaries');
  if (payrollRows.length === 0) return null;

  const metricMap = resolvePayrollMetricMap(payrollRows);
  if (!metricMap.currentActual) return null;

  const aggregate = (scope: 'ytd' | 'mth') => {
    let actual = 0;
    let budget = 0;
    let py = 0;
    for (const row of payrollRows) {
      const currentPeriod = scope === 'ytd' ? row.isYtd : row.isMth;
      const pyPeriod = scope === 'ytd' ? row.isYtdPy : row.isMthPy;
      if (row.metricName === metricMap.currentActual && currentPeriod) actual += row.amountValue;
      if (metricMap.currentBudget && row.metricName === metricMap.currentBudget && currentPeriod) budget += row.amountValue;
      if (metricMap.pyActual && row.metricName === metricMap.pyActual && pyPeriod) py += row.amountValue;
    }
    return {
      actual,
      budget,
      py,
      achievementPct: budget > 0 ? (actual / budget) * 100 : null,
      variance: actual - budget,
      vsPyPct: py > 0 ? ((actual - py) / py) * 100 : null,
    };
  };

  const buildBreakdown = (dimension: 'cecoNameGroup' | 'businessUnit') => {
    const byKey = new Map<string, { actual: number; budget: number; py: number }>();
    for (const row of payrollRows) {
      const label = (row[dimension] ?? '').trim() || 'Unassigned';
      const current = byKey.get(label) ?? { actual: 0, budget: 0, py: 0 };
      if (row.metricName === metricMap.currentActual && row.isYtd) current.actual += row.amountValue;
      if (metricMap.currentBudget && row.metricName === metricMap.currentBudget && row.isYtd) current.budget += row.amountValue;
      if (metricMap.pyActual && row.metricName === metricMap.pyActual && row.isYtdPy) current.py += row.amountValue;
      byKey.set(label, current);
    }
    const totalActual = [...byKey.values()].reduce((sum, row) => sum + row.actual, 0);
    return [...byKey.entries()]
      .map(([label, values]) => ({
        label,
        actual: values.actual,
        budget: values.budget,
        py: values.py,
        achievementPct: values.budget > 0 ? (values.actual / values.budget) * 100 : null,
        variance: values.actual - values.budget,
        vsPyPct: values.py > 0 ? ((values.actual - values.py) / values.py) * 100 : null,
        sharePct: totalActual > 0 ? (values.actual / totalActual) * 100 : null,
      }))
      .filter((row) => !(row.actual === 0 && row.budget === 0 && row.py === 0))
      .sort((a, b) => b.budget - a.budget || b.actual - a.actual);
  };

  const reportPeriodMonth = payrollRows.map((row) => row.reportPeriodMonth).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const sourceAsOfMonth = payrollRows.map((row) => row.sourceAsOfMonth).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const latestPeriodMonth = payrollRows.map((row) => row.latestPeriodMonth).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;

  return {
    reportPeriodMonth,
    sourceAsOfMonth,
    latestPeriodMonth,
    ytd: aggregate('ytd'),
    mth: aggregate('mth'),
    byCecoGroup: buildBreakdown('cecoNameGroup'),
    byBusinessUnit: buildBreakdown('businessUnit'),
  };
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
  payrollAchievement,
  openVacancyData,
}: {
  turnoverExits: number;
  turnoverVoluntary: number;
  trainingHours: number;
  trainingCompletionRate: number | null;
  payrollAchievement: PayrollAchievementData | null;
  openVacancyData: HumanResourcesOpenVacancyData;
}) {
  const payrollStatusInfo = payrollStatus(payrollAchievement?.ytd.achievementPct ?? null);
  const vacancyOverview = openVacancyData.overview;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <KpiLabel help="Total employee exits accumulated year to date in the selected reporting version.">
          Turnover YTD
        </KpiLabel>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {new Intl.NumberFormat('en-US').format(turnoverExits)}
        </p>
        <p className="mt-2 text-sm text-slate-600">Voluntary exits: {new Intl.NumberFormat('en-US').format(turnoverVoluntary)}</p>
      </article>
      <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <KpiLabel help="Total learning hours and completion rate for the current year-to-date training cut.">
          Training YTD
        </KpiLabel>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(trainingHours)}
        </p>
        <p className="mt-2 text-sm text-slate-600">Completion: {formatPercent(trainingCompletionRate)}</p>
      </article>
      <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <KpiLabel help="Average Time to Fill year to date, read directly from the Open Vacancy Excel file.">
          Avg Time to Fill YTD
        </KpiLabel>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {formatDays(vacancyOverview?.avgTimeToFillDays ?? null)}
        </p>
        <p className="mt-2 text-sm text-slate-600">In target: {formatPercent(vacancyOverview?.targetHitRate ?? null)}</p>
      </article>
      <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <KpiLabel help="Actual Base Salaries divided by budget for the current year-to-date payroll cut.">
          Payroll Achievement YTD
        </KpiLabel>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {formatOpexPercent(payrollAchievement?.ytd.achievementPct ?? null)}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Variance: {formatSignedAmount(payrollAchievement?.ytd.variance ?? null)}
        </p>
        <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${payrollStatusInfo.className}`}>
          {payrollStatusInfo.label}
        </span>
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
  payrollAchievement,
  openVacancyData,
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
  payrollAchievement: PayrollAchievementData | null;
  openVacancyData: HumanResourcesOpenVacancyData;
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
    if (params.vacancyStatus) query.set('vacancyStatus', params.vacancyStatus);
    if (params.vacancyOpening) query.set('vacancyOpening', params.vacancyOpening);
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
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Turnover, Training, Payroll Achievement & Open Vacancy</h2>
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
        <Link
          href={buildTabHref('payroll')}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
            activeTab === 'payroll'
              ? 'bg-slate-900 text-white shadow-[0_8px_22px_rgba(15,23,42,0.35)]'
              : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
          }`}
        >
          Payroll Achievement
        </Link>
        <Link
          href={buildTabHref('open_vacancy')}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
            activeTab === 'open_vacancy'
              ? 'bg-slate-900 text-white shadow-[0_8px_22px_rgba(15,23,42,0.35)]'
              : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
          }`}
        >
          Open Vacancy
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
        ) : activeTab === 'training' ? (
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
                    <KpiLabel help="Distinct employees with completed or tracked learning activity year to date.">
                      Trained Employees YTD
                    </KpiLabel>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(trainingThemeData.summary.trainedEmployeesYtd)}</p>
                  </div>
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                    <KpiLabel help="Share of active employees covered by training year to date.">
                      Coverage YTD
                    </KpiLabel>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{formatPercent(trainingThemeData.summary.coverageRateYtd)}</p>
                  </div>
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                    <KpiLabel help="Training events completed year to date in the selected training scope.">
                      Completed Events YTD
                    </KpiLabel>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(trainingThemeData.summary.completedEventsYtd)}</p>
                  </div>
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                    <KpiLabel help="Total learning hours accumulated year to date.">
                      Learning Hours YTD
                    </KpiLabel>
                    <p className="mt-1 text-xl font-semibold text-slate-900">
                      {new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(trainingThemeData.summary.learningHoursYtd)}
                    </p>
                  </div>
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                    <KpiLabel help="Average learning hours per trained employee year to date.">
                      Avg Hours / Trained
                    </KpiLabel>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{trainingThemeData.summary.avgHoursPerTrainedEmployeeYtd == null ? 'N/A' : trainingThemeData.summary.avgHoursPerTrainedEmployeeYtd.toFixed(1)}</p>
                  </div>
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                    <KpiLabel help="Current YTD learning hours compared with previous-year YTD learning hours.">
                      Growth vs PY
                    </KpiLabel>
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
        ) : activeTab === 'payroll' ? (
          <PayrollAchievementPanel data={payrollAchievement} />
        ) : (
          <OpenVacancyPanelClient data={openVacancyData} />
        )}
      </div>
    </article>
  );
}

function payrollStatus(achievementPct: number | null) {
  if (achievementPct == null) return { label: 'No Budget', className: 'border-slate-200 bg-slate-50 text-slate-700' };
  const deviation = Math.abs(achievementPct - 100);
  if (deviation <= 3) return { label: 'On Plan', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
  if (deviation <= 7) return { label: 'Near Plan', className: 'border-amber-200 bg-amber-50 text-amber-800' };
  if (achievementPct > 107) return { label: 'Over Budget', className: 'border-rose-200 bg-rose-50 text-rose-800' };
  return { label: 'Below Budget', className: 'border-sky-200 bg-sky-50 text-sky-800' };
}

function formatDays(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(1)} days`;
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date);
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function businessDaysBetween(startValue: string | null | undefined, endDate = new Date()) {
  const startDate = parseDateOnly(startValue);
  if (!startDate) return null;
  const endUtc = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()));
  if (startDate > endUtc) return 0;

  let count = 0;
  const cursor = new Date(startDate);
  while (cursor <= endUtc) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

const vacancyStatusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'about_to_enter', label: 'About to enter' },
  { value: 'paused', label: 'Paused' },
  { value: 'other', label: 'Other' },
] as const;

const vacancyOpeningOptions = [
  { value: 'all', label: 'All' },
  { value: 'existing', label: 'Existent' },
  { value: 'new', label: 'New' },
] as const;

function normalizeVacancyStatusFilter(value: string | null | undefined): string {
  if (typeof value !== 'string') return 'all';
  return vacancyStatusOptions.some((option) => option.value === value) ? value : 'all';
}

function normalizeVacancyOpeningFilter(value: string | null | undefined): string {
  if (typeof value !== 'string') return 'all';
  return vacancyOpeningOptions.some((option) => option.value === value) ? value : 'all';
}

function StatusLegend() {
  const items = [
    { label: 'Open', className: 'bg-emerald-500' },
    { label: 'Closed', className: 'bg-slate-500' },
    { label: 'About to enter', className: 'bg-cyan-500' },
    { label: 'Paused', className: 'bg-amber-500' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${item.className}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function OpenVacancyBreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: HumanResourcesOpenVacancyBreakdownRow[];
}) {
  const maxOpened = Math.max(1, ...rows.map((row) => row.opened));
  return (
    <article className="rounded-[16px] border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{title}</p>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? <p className="text-sm text-slate-500">No open vacancy data available.</p> : null}
        {rows.map((row) => (
          <div key={`${title}-${row.label}`} className="rounded-[12px] border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{row.label}</p>
              <p className="text-xs text-slate-600">
                {formatInt(row.opened)} total
              </p>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-200" style={{ width: `${Math.max(8, (row.opened / maxOpened) * 100)}%` }}>
              <div className="h-full bg-emerald-500" style={{ width: `${row.opened > 0 ? (row.open / row.opened) * 100 : 0}%` }} />
              <div className="h-full bg-slate-500" style={{ width: `${row.opened > 0 ? (row.covered / row.opened) * 100 : 0}%` }} />
              <div className="h-full bg-cyan-500" style={{ width: `${row.opened > 0 ? (row.aboutToEnter / row.opened) * 100 : 0}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${row.opened > 0 ? (row.paused / row.opened) * 100 : 0}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Open {formatInt(row.open)} | Closed {formatInt(row.covered)} | About to enter {formatInt(row.aboutToEnter)} | Paused {formatInt(row.paused)}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Avg TTF {formatDays(row.avgTimeToFillDays)} | In target {formatPercent(row.targetHitRate)}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

// Legacy server-rendered vacancy panel kept temporarily while the client-side filter version stabilizes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function OpenVacancyPanel({ data, params }: { data: HumanResourcesOpenVacancyData; params: SearchParams }) {
  const overview = data.overview;
  const activeStatus = normalizeVacancyStatusFilter(params.vacancyStatus);
  const activeOpening = normalizeVacancyOpeningFilter(params.vacancyOpening);
  const buildOpeningHref = (opening: string) => {
    const query = new URLSearchParams();
    if (params.version) query.set('version', params.version);
    query.set('hrTab', 'open_vacancy');
    if (params.vacancyStatus) query.set('vacancyStatus', params.vacancyStatus);
    query.set('vacancyOpening', opening);
    return `/executive/human-resources/dashboard?${query.toString()}`;
  };
  return (
    <div className="space-y-4">
      <article className="rounded-[16px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Open Vacancy Scorecard</p>
          <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
            {vacancyOpeningOptions.map((option) => (
              <Link
                key={option.value}
                href={buildOpeningHref(option.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                  activeOpening === option.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Positions opened year to date using Fecha inicio busqueda as period month.">
              YTD Opened
            </KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(overview?.ytdOpened ?? 0)}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Positions with status Open in the current report month.">
              Open MTH
            </KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(overview?.openPositions ?? 0)}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Positions with status Closed in the current report month.">
              Closed MTH
            </KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(overview?.coveredPositions ?? 0)}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Positions temporarily paused in the current report month.">
              Paused MTH
            </KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(overview?.pausedPositions ?? 0)}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Average Time to Fill read directly from the Excel column.">
              Avg Time to Fill
            </KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatDays(overview?.avgTimeToFillDays ?? null)}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Share of measured vacancies at or below target: FF 35 days, Staff 45 days.">
              In Target
            </KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatPercent(overview?.targetHitRate ?? null)}</p>
          </div>
        </div>
      </article>

      <article className="rounded-[16px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Monthly Flow</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {data.monthlyTrend.map((row) => (
            <div key={row.monthOrder} className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{row.monthLabel}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatInt(row.opened)} opened</p>
              <p className="text-xs text-slate-600">
                Open {formatInt(row.open)} | Closed {formatInt(row.covered)} | About {formatInt(row.aboutToEnter)} | Paused {formatInt(row.paused)}
              </p>
              <p className="mt-1 text-xs text-slate-600">{formatDays(row.avgTimeToFillDays)}</p>
            </div>
          ))}
          {data.monthlyTrend.length === 0 ? <p className="text-sm text-slate-500">No monthly vacancy trend available.</p> : null}
        </div>
      </article>

      <div className="rounded-[16px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Status Composition</p>
          <StatusLegend />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <OpenVacancyBreakdownTable title="By Area" rows={data.byArea} />
        <OpenVacancyBreakdownTable title="By Type" rows={data.byType} />
      </div>

      <article className="overflow-hidden rounded-[16px] border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Latest Vacancy Detail</p>
          <form action="/executive/human-resources/dashboard" className="flex items-center gap-2">
            {params.version ? <input type="hidden" name="version" value={params.version} /> : null}
            <input type="hidden" name="hrTab" value="open_vacancy" />
            <input type="hidden" name="vacancyOpening" value={activeOpening} />
            <select
              name="vacancyStatus"
              defaultValue={activeStatus}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              {vacancyStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button type="submit" className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
              Apply
            </button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-white">
              <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Area</th>
                <th className="px-3 py-2">View</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Manager</th>
                <th className="px-3 py-2">Resp HR</th>
                <th className="px-3 py-2 text-right">TTF</th>
                <th className="px-3 py-2 text-right">Target</th>
                <th className="px-3 py-2">Start</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.details.map((row, index) => {
                const elapsedBusinessDays = row.timeToFillDays == null ? businessDaysBetween(row.searchStartDate) : null;
                return (
                  <tr key={`${row.area}-${row.manager}-${row.searchStartDate}-${index}`}>
                    <td className="px-3 py-2 font-medium text-slate-900">{row.status ?? 'N/A'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.area ?? 'N/A'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.openingType ?? 'N/A'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.vacancyType ?? 'N/A'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.manager ?? 'N/A'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.respHr ?? 'N/A'}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${row.withinTarget === false ? 'text-rose-700' : row.timeToFillDays == null ? 'text-amber-700' : 'text-slate-900'}`}>
                      {row.timeToFillDays == null
                        ? (elapsedBusinessDays == null ? 'N/A' : `${elapsedBusinessDays}*`)
                        : row.timeToFillDays.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.targetDays == null ? 'N/A' : row.targetDays.toFixed(0)}</td>
                    <td className="px-3 py-2 text-slate-700">{formatShortDate(row.searchStartDate)}</td>
                  </tr>
                );
              })}
              {data.details.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={9}>No open vacancy records available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          * Provisional business days elapsed from Start to today for vacancies without final Time to Fill in the source file.
        </p>
      </article>
    </div>
  );
}

function PayrollBreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: PayrollAchievementBreakdownRow[];
}) {
  return (
    <article className="rounded-[16px] border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{title}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
              <th className="px-2 py-2">Segment</th>
              <th className="px-2 py-2 text-right">Actual</th>
              <th className="px-2 py-2 text-right">Budget</th>
              <th className="px-2 py-2 text-right">Variance</th>
              <th className="px-2 py-2 text-right">Achievement</th>
              <th className="px-2 py-2 text-right">vs PY</th>
              <th className="px-2 py-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((row) => {
              const status = payrollStatus(row.achievementPct);
              return (
                <tr
                  key={`${title}-${row.label}`}
                  className="border-b border-slate-100 last:border-b-0"
                >
                  <td className="px-2 py-2 font-semibold text-slate-900">{row.label}</td>
                  <td className="px-2 py-2 text-right text-slate-700">{formatAmount(row.actual)}</td>
                  <td className="px-2 py-2 text-right text-slate-700">{formatAmount(row.budget)}</td>
                  <td className={`px-2 py-2 text-right font-semibold ${row.variance <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatSignedAmount(row.variance)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${status.className}`}>
                      {formatOpexPercent(row.achievementPct)}
                    </span>
                  </td>
                  <td className={`px-2 py-2 text-right font-semibold ${(row.vsPyPct ?? 0) <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatSignedOpexPercent(row.vsPyPct)}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-700">{formatOpexPercent(row.sharePct)}</td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td className="px-2 py-4 text-center text-slate-500" colSpan={7}>
                  No Base Salaries rows available.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function PayrollAchievementPanel({ data }: { data: PayrollAchievementData | null }) {
  if (!data) {
    return (
      <article className="rounded-[16px] border border-slate-200 bg-white p-4 text-sm text-slate-600">
        No payroll budget data available from OPEX Base Salaries.
      </article>
    );
  }

  const ytdStatus = payrollStatus(data.ytd.achievementPct);
  const mthStatus = payrollStatus(data.mth.achievementPct);
  const overBudgetRows = data.byCecoGroup.filter((row) => row.variance > 0).slice(0, 3);
  const underBudgetRows = data.byCecoGroup.filter((row) => row.variance < 0).slice(0, 3);

  return (
    <div className="space-y-4">
      <article className="rounded-[16px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Payroll Budget Achievement</p>
            <p className="mt-1 text-sm text-slate-600">
              Base Salaries from OPEX, evaluated as actual payroll vs budget by YTD and current month.
            </p>
          </div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${ytdStatus.className}`}>
            {ytdStatus.label}
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3 xl:col-span-2">
            <KpiLabel help="Actual Base Salaries posted year to date from OPEX.">
              YTD Actual
            </KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatAmount(data.ytd.actual)}</p>
            <p className="text-xs text-slate-600">Budget {formatAmount(data.ytd.budget)}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Actual Base Salaries divided by budget for the current year-to-date cut.">
              YTD Achievement
            </KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatOpexPercent(data.ytd.achievementPct)}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Actual Base Salaries minus budget. Positive values indicate payroll above budget.">
              Variance vs Budget
            </KpiLabel>
            <p className={`mt-1 text-xl font-semibold ${data.ytd.variance <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatSignedAmount(data.ytd.variance)}
            </p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Year-to-date Base Salaries growth compared with the previous-year year-to-date cut.">
              Growth vs PY
            </KpiLabel>
            <p className={`mt-1 text-xl font-semibold ${(data.ytd.vsPyPct ?? 0) <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatSignedOpexPercent(data.ytd.vsPyPct)}
            </p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Current month actual Base Salaries divided by current month budget.">
              MTH Achievement
            </KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatOpexPercent(data.mth.achievementPct)}</p>
            <p className={`mt-1 inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${mthStatus.className}`}>
              {mthStatus.label}
            </p>
          </div>
        </div>
      </article>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[16px] border border-rose-200 bg-rose-50/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Over Budget Watch</p>
          <div className="mt-3 space-y-2">
            {overBudgetRows.map((row) => (
              <div key={`over-${row.label}`} className="rounded-[10px] border border-rose-200 bg-white px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                <p className="text-xs text-rose-800">
                  {formatSignedAmount(row.variance)} vs budget | {formatOpexPercent(row.achievementPct)} achievement
                </p>
              </div>
            ))}
            {overBudgetRows.length === 0 ? <p className="text-sm text-slate-600">No CeCoGroup is over budget.</p> : null}
          </div>
        </article>
        <article className="rounded-[16px] border border-sky-200 bg-sky-50/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Below Budget Capacity</p>
          <div className="mt-3 space-y-2">
            {underBudgetRows.map((row) => (
              <div key={`under-${row.label}`} className="rounded-[10px] border border-sky-200 bg-white px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                <p className="text-xs text-sky-800">
                  {formatSignedAmount(row.variance)} vs budget | {formatOpexPercent(row.achievementPct)} achievement
                </p>
              </div>
            ))}
            {underBudgetRows.length === 0 ? <p className="text-sm text-slate-600">No CeCoGroup is materially below budget.</p> : null}
          </div>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PayrollBreakdownTable title="Base Salaries by CeCoGroup" rows={data.byCecoGroup} />
        <PayrollBreakdownTable title="Base Salaries by Business Unit" rows={data.byBusinessUnit} />
      </div>
    </div>
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
          <KpiLabel help="Current year-to-date exits for the selected turnover scope.">
            Current YTD
          </KpiLabel>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(data.summary.currentYtdExits)}</p>
        </div>
        <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
          <KpiLabel help="Previous-year exits accumulated through the same month cut.">
            PY YTD
          </KpiLabel>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(data.summary.previousYtdExits)}</p>
        </div>
        <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
          <KpiLabel help="Target trajectory for the current cut, based on reducing prior-year voluntary turnover by 15%.">
            Target YTD
          </KpiLabel>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(data.summary.targetYtdExits)}</p>
        </div>
        <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
          <KpiLabel help="Current YTD exits minus target exits. Positive means above the target trajectory.">
            Variance vs Target
          </KpiLabel>
          <p className={`mt-1 text-xl font-semibold ${data.summary.varianceVsTarget <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatSignedInt(data.summary.varianceVsTarget)}
          </p>
        </div>
        <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
          <KpiLabel help="Current YTD exits compared with previous-year YTD exits.">
            Growth vs PY
          </KpiLabel>
          <p className={`mt-1 text-xl font-semibold ${data.summary.growthVsPyPct !== null && data.summary.growthVsPyPct <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatSignedPercent(data.summary.growthVsPyPct)}
          </p>
        </div>
        <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
          <KpiLabel help="On Track when turnover is at or below the target trajectory.">
            Target Status
          </KpiLabel>
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
  payrollAchievement,
}: {
  turnoverThemeTotal: HumanResourcesTurnoverThemeData | null;
  trainingThemeTotal: HumanResourcesTrainingThemeData | null;
  payrollAchievement: PayrollAchievementData | null;
}) {
  const turnoverInsights = turnoverThemeTotal?.insights ?? [];
  const trainingInsights = trainingThemeTotal?.insights ?? [];
  const payrollStatusLabel = payrollStatus(payrollAchievement?.ytd.achievementPct ?? null).label;
  const payrollOverBudget = payrollAchievement?.byCecoGroup.filter((row) => row.variance > 0).slice(0, 3) ?? [];
  const payrollUnderBudget = payrollAchievement?.byCecoGroup.filter((row) => row.variance < 0).slice(0, 3) ?? [];
  return (
    <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Insights</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
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
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Payroll Signals</p>
          {payrollAchievement ? (
            <>
              <div className="rounded-[12px] border border-slate-200 bg-slate-50/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Payroll Achievement</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {payrollStatusLabel}: {formatOpexPercent(payrollAchievement.ytd.achievementPct)} YTD.
                </p>
                <p className="mt-1 text-xs text-slate-700">
                  Actual {formatAmount(payrollAchievement.ytd.actual)} vs budget {formatAmount(payrollAchievement.ytd.budget)}.
                </p>
              </div>
              {payrollOverBudget.map((row) => (
                <div key={`payroll-over-${row.label}`} className="rounded-[12px] border border-rose-200 bg-rose-50/70 p-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-rose-700">Over Budget</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{row.label}</p>
                  <p className="mt-1 text-xs text-slate-700">
                    {formatSignedAmount(row.variance)} vs budget, {formatOpexPercent(row.achievementPct)} achievement.
                  </p>
                </div>
              ))}
              {payrollOverBudget.length === 0 && payrollUnderBudget[0] ? (
                <div className="rounded-[12px] border border-emerald-200 bg-emerald-50/70 p-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-700">Budget Capacity</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{payrollUnderBudget[0].label}</p>
                  <p className="mt-1 text-xs text-slate-700">
                    {formatSignedAmount(payrollUnderBudget[0].variance)} vs budget.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="rounded-[12px] border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-600">
              No payroll Base Salaries signal available.
            </p>
          )}
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
  payrollAchievement,
}: {
  turnoverThemeTotal: HumanResourcesTurnoverThemeData | null;
  trainingThemeTotal: HumanResourcesTrainingThemeData | null;
  payrollAchievement: PayrollAchievementData | null;
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
  const payrollYtdStatus = payrollStatus(payrollAchievement?.ytd.achievementPct ?? null);
  const payrollTopOverBudget = payrollAchievement?.byCecoGroup.find((row) => row.variance > 0) ?? null;
  const payrollTopUnderBudget = payrollAchievement?.byCecoGroup.find((row) => row.variance < 0) ?? null;

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

  if (payrollAchievement) {
    if (payrollAchievement.ytd.achievementPct != null && Math.abs(payrollAchievement.ytd.achievementPct - 100) <= 3) {
      working.push(`PAY|||Payroll is on plan at ${formatOpexPercent(payrollAchievement.ytd.achievementPct)} YTD achievement.`);
    } else if (payrollAchievement.ytd.variance > 0) {
      improve.push(`PAY|||Payroll is over budget by ${formatSignedAmount(payrollAchievement.ytd.variance)} YTD.`);
      actions.push('PAY|||Review Base Salaries drivers by CeCoGroup and freeze non-critical incremental payroll commitments.');
    } else if (payrollAchievement.ytd.variance < 0) {
      working.push(`PAY|||Payroll is below budget by ${formatSignedAmount(payrollAchievement.ytd.variance)} YTD.`);
    }
    if (payrollTopOverBudget) {
      improve.push(
        `PAY|||${payrollTopOverBudget.label} is the largest payroll variance: ${formatSignedAmount(payrollTopOverBudget.variance)} vs budget.`,
      );
      actions.push(`PAY|||Validate payroll accruals and headcount movements in ${payrollTopOverBudget.label}.`);
    } else if (payrollTopUnderBudget) {
      working.push(`PAY|||${payrollTopUnderBudget.label} has available payroll capacity (${formatSignedAmount(payrollTopUnderBudget.variance)}).`);
    }
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
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
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
          <div className="rounded-[14px] border border-violet-200 bg-violet-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Payroll Achievement</p>
            <p className="mt-1 text-xs text-violet-900">Base Salaries budget discipline from OPEX.</p>
            <p className="mt-2 text-xs text-slate-700">
              YTD {formatAmount(payrollAchievement?.ytd.actual ?? 0)} | Budget {formatAmount(payrollAchievement?.ytd.budget ?? 0)}
            </p>
            <p className="mt-1 text-xs text-slate-700">
              Variance {formatSignedAmount(payrollAchievement?.ytd.variance ?? null)} | vs PY{' '}
              {formatSignedOpexPercent(payrollAchievement?.ytd.vsPyPct ?? null)}
            </p>
            <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${payrollYtdStatus.className}`}>
              {payrollYtdStatus.label}
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
                        : tag === 'PAY'
                          ? 'border-violet-200 bg-violet-50 text-violet-800'
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
                        : tag === 'PAY'
                          ? 'border-violet-200 bg-violet-50 text-violet-800'
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
                      : tag === 'PAY'
                        ? 'border-violet-200 bg-violet-50 text-violet-800'
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
      openVacancyData,
      opexRows,
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
      getHumanResourcesOpenVacancyData(reportingVersionId || undefined),
      getOpexRows(reportingVersionId || undefined),
    ]);
    const payrollAchievement = buildPayrollAchievementData(opexRows);

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
      openVacancyData,
      payrollAchievement,
    };
  },
  ['human-resources-v16'],
  { revalidate: 90 },
);

const getCachedTrainingRanking = unstable_cache(
  async (
    reportingVersionId: string,
    trainingScope: HumanResourcesTrainingScope,
    trainingRankingBy: HumanResourcesTrainingRankingDimension,
  ) => getHumanResourcesTrainingRanking(reportingVersionId || undefined, trainingScope, trainingRankingBy, 24),
  ['human-resources-training-ranking-v2'],
  { revalidate: 90 },
);

export async function HumanResourcesView({
  viewMode,
  searchParams = {},
}: {
  viewMode: HumanResourcesViewMode;
  searchParams?: SearchParams;
}) {
  const versions = await getReportingVersions({
    statuses: searchParams.version ? ['draft', 'ready_to_show', 'closed'] : ['ready_to_show', 'closed'],
  });
  const selectedVersion =
    versions.find((version) => version.reportingVersionId === searchParams.version) ?? versions[0];
  const selectedReportingVersionId = selectedVersion?.reportingVersionId ?? searchParams.version ?? '';
  const activeDashboardTab: HumanResourcesDashboardTab =
    searchParams.hrTab === 'training' || searchParams.hrTab === 'payroll' || searchParams.hrTab === 'open_vacancy'
      ? searchParams.hrTab
      : 'turnover';
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
    data.openVacancyData.overview?.reportPeriodMonth ??
    auditHeader.reportPeriodMonth;
  const headerSourceAsOf =
    turnoverOverview?.sourceAsOfMonth ??
    trainingOverview?.sourceAsOfMonth ??
    data.openVacancyData.overview?.sourceAsOfMonth ??
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
        payrollAchievement={data.payrollAchievement}
        openVacancyData={data.openVacancyData}
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
          payrollAchievement={data.payrollAchievement}
          openVacancyData={data.openVacancyData}
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
          payrollAchievement={data.payrollAchievement}
        />
      ) : null}

      {viewMode === 'scorecard' ? (
        <ScorecardPanelV2
          turnoverThemeTotal={data.turnoverThemeTotal}
          trainingThemeTotal={data.trainingThemeTotal}
          payrollAchievement={data.payrollAchievement}
        />
      ) : null}

      <AuditPanel rows={data.auditSources} />
    </section>
  );
}
