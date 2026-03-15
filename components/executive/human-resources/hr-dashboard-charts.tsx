'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  HumanResourcesTrainingRankingRow,
  HumanResourcesTrainingThemeData,
  HumanResourcesTurnoverThemeData,
  HumanResourcesTrainingUserRow,
  HumanResourcesTurnoverDepartmentRow,
  HumanResourcesTurnoverQuarterRow,
  HumanResourcesTurnoverReasonRow,
  HumanResourcesTurnoverSeniorityRow,
} from '@/types/human-resources';

type TurnoverChartsPanelProps = {
  quarterRows: HumanResourcesTurnoverQuarterRow[];
  reasonRows: HumanResourcesTurnoverReasonRow[];
  seniorityRows: HumanResourcesTurnoverSeniorityRow[];
  departmentRows: HumanResourcesTurnoverDepartmentRow[];
};

type TrainingChartsPanelProps = {
  trainingRows: HumanResourcesTrainingUserRow[];
  areaRankingRows: HumanResourcesTrainingRankingRow[];
};

type TurnoverThemeChartsPanelProps = {
  themeData: HumanResourcesTurnoverThemeData;
};

const PIE_COLORS = ['#1d4ed8', '#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

function toNumericValue(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0];
    const numeric = Number(first);
    return Number.isFinite(numeric) ? numeric : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatPercentFromHundred(value: unknown) {
  const numeric = toNumericValue(value);
  if (numeric == null) return 'N/A';
  return `${numeric.toFixed(1)}%`;
}

function formatPercentFromRatio(value: unknown) {
  const numeric = toNumericValue(value);
  if (numeric == null) return 'N/A';
  return `${(numeric * 100).toFixed(1)}%`;
}

function formatInt(value: unknown) {
  const numeric = toNumericValue(value);
  if (numeric == null) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(numeric);
}

function formatHours(value: unknown) {
  const numeric = toNumericValue(value);
  if (numeric == null) return '0.0';
  if (!Number.isFinite(numeric)) return 'N/A';
  return numeric.toFixed(1);
}

export function TurnoverChartsPanel({
  quarterRows,
  reasonRows,
  seniorityRows,
  departmentRows,
}: TurnoverChartsPanelProps) {
  const quarterChartRows = useMemo(
    () =>
      quarterRows.map((row) => ({
        quarter: row.quarter,
        current: row.exitsCurrentYear,
        previous: row.exitsPreviousYear,
        cumulative: row.cumulativeCurrentYearPct == null ? null : row.cumulativeCurrentYearPct * 100,
      })),
    [quarterRows],
  );

  const departmentPieRows = useMemo(
    () =>
      departmentRows
        .filter((row) => row.exits > 0)
        .slice(0, 7)
        .map((row) => ({ name: row.department, value: row.exits })),
    [departmentRows],
  );

  const reasonChartRows = useMemo(
    () =>
      reasonRows.slice(0, 8).map((row) => ({
        reason: row.reason,
        voluntary: row.voluntaryExits,
        involuntary: row.involuntaryExits,
      })),
    [reasonRows],
  );

  const seniorityChartRows = useMemo(
    () =>
      seniorityRows.map((row) => ({
        band: row.seniorityBand,
        total: row.totalExits,
      })),
    [seniorityRows],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-[16px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Quarter Turnover Trend</p>
        <div className="mt-3 h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={quarterChartRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'Cumulative %') return [formatPercentFromHundred(value), name];
                  return [formatInt(value), name];
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="current" name="Current Year" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="previous" name="Previous Year" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="cumulative" name="Cumulative %" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-[16px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Department Exit Mix</p>
        <div className="mt-3 h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={departmentPieRows}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                labelLine={false}
                label={(entry) => `${entry.name}: ${formatInt(entry.value)}`}
              >
                {departmentPieRows.map((_, index) => (
                  <Cell key={`department-slice-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [formatInt(value), 'Exits']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-[16px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Reason vs Rationale</p>
        <div className="mt-3 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={reasonChartRows} layout="vertical" margin={{ left: 6, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="reason" type="category" width={130} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [formatInt(value), 'Exits']} />
              <Legend />
              <Bar dataKey="voluntary" name="Voluntary" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              <Bar dataKey="involuntary" name="Involuntary" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-[16px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Seniority Distribution</p>
        <div className="mt-3 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={seniorityChartRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="band" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [formatInt(value), 'Exits']} />
              <Bar dataKey="total" name="Total Exits" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </div>
  );
}

export function TrainingChartsPanel({ trainingRows, areaRankingRows }: TrainingChartsPanelProps) {
  const topAreasRows = useMemo(
    () =>
      areaRankingRows.slice(0, 8).map((row) => ({
        area: row.label,
        hours: row.hours,
      })),
    [areaRankingRows],
  );

  const completionPieRows = useMemo(() => {
    const completed = trainingRows.reduce((sum, row) => sum + row.completedRecords, 0);
    const pending = trainingRows.reduce(
      (sum, row) => sum + Math.max(row.totalRecords - row.completedRecords, 0),
      0,
    );
    return [
      { name: 'Completed', value: completed },
      { name: 'Pending', value: pending },
    ];
  }, [trainingRows]);

  const averageCompletion =
    trainingRows.length === 0
      ? null
      : trainingRows.reduce((sum, row) => sum + (row.completionRate ?? 0), 0) / trainingRows.length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-[16px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Top Areas by Training Hours</p>
        <div className="mt-3 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topAreasRows} layout="vertical" margin={{ left: 6, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="area" type="category" width={140} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [formatHours(value), 'Hours']} />
              <Bar dataKey="hours" name="Hours" fill="#1d4ed8" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-[16px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Completion Distribution</p>
        <div className="mt-2 grid gap-2 text-sm text-slate-700">
          <p>Average completion rate: <span className="font-semibold text-slate-900">{formatPercentFromRatio(averageCompletion)}</span></p>
        </div>
        <div className="mt-2 h-[230px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={completionPieRows} dataKey="value" nameKey="name" innerRadius={55} outerRadius={92}>
                {completionPieRows.map((_, index) => (
                  <Cell key={`training-slice-${index}`} fill={index === 0 ? '#10b981' : '#f59e0b'} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [formatInt(value), 'Records']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </article>
    </div>
  );
}

export function TrainingAnalyticsPanel({
  data,
  metricMode,
}: {
  data: HumanResourcesTrainingThemeData;
  metricMode: 'events' | 'hours' | 'employees';
}) {
  const itemTypeRows = useMemo(
    () =>
      data.itemTypeMix.map((row) => ({
        label: row.label,
        value:
          metricMode === 'hours'
            ? row.ytdHours
            : metricMode === 'employees'
              ? row.ytdEmployees
              : row.ytdEvents,
      })),
    [data.itemTypeMix, metricMode],
  );

  const completionRows = useMemo(
    () =>
      data.completionStatusMix.map((row) => ({
        label: row.label,
        value: row.ytdEvents,
      })),
    [data.completionStatusMix],
  );

  const contentRows = useMemo(
    () =>
      data.topContent.slice(0, 8).map((row) => ({
        label: row.entityTitle.length > 28 ? `${row.entityTitle.slice(0, 28)}…` : row.entityTitle,
        value:
          metricMode === 'hours'
            ? row.ytdHours
            : metricMode === 'employees'
              ? row.ytdEmployees
              : row.ytdEvents,
      })),
    [data.topContent, metricMode],
  );

  const trendRows = useMemo(
    () =>
      data.monthlyTrend.map((row) => ({
        month: row.monthLabel,
        current:
          metricMode === 'hours'
            ? row.currentYearHours
            : metricMode === 'employees'
              ? row.currentYearEmployees
              : row.currentYearEvents,
        previous:
          metricMode === 'hours'
            ? row.previousYearHours
            : metricMode === 'employees'
              ? row.previousYearEmployees
              : row.previousYearEvents,
      })),
    [data.monthlyTrend, metricMode],
  );
  const hasPyComparison = useMemo(
    () =>
      trendRows.some((row) => row.previous > 0) ||
      data.summary.trainedEmployeesPy > 0 ||
      data.summary.completedEventsPy > 0 ||
      data.summary.learningHoursPy > 0,
    [trendRows, data.summary.trainedEmployeesPy, data.summary.completedEventsPy, data.summary.learningHoursPy],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[16px] border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Training Mix by Item Type</p>
          <div className="mt-3 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={itemTypeRows} layout="vertical" margin={{ left: 6, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="label" type="category" width={130} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [formatInt(value), metricMode]} />
                <Bar dataKey="value" name={metricMode} fill="#1d4ed8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-[16px] border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Completion Status Mix</p>
          <div className="mt-3 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={completionRows} dataKey="value" nameKey="label" innerRadius={50} outerRadius={90}>
                  {completionRows.map((_, index) => (
                    <Cell key={`completion-slice-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [formatInt(value), 'events']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[16px] border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Top Content Portfolio</p>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contentRows} layout="vertical" margin={{ left: 6, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="label" type="category" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [formatInt(value), metricMode]} />
                <Bar dataKey="value" name={metricMode} fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-[16px] border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
            {hasPyComparison ? 'Monthly Momentum vs PY' : 'Monthly Momentum'}
          </p>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [formatInt(value), metricMode]} />
                {hasPyComparison ? <Legend /> : null}
                {hasPyComparison ? (
                  <Bar dataKey="previous" name="Previous Year" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                ) : null}
                <Bar dataKey="current" name="Current Year" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
    </div>
  );
}

export function TurnoverThemeChartsPanel({ themeData }: TurnoverThemeChartsPanelProps) {
  const summaryRows = useMemo(
    () => [
      { label: 'PY YTD', value: themeData.summary.previousYtdExits },
      { label: 'Target YTD', value: themeData.summary.targetYtdExits },
      { label: 'Actual YTD', value: themeData.summary.currentYtdExits },
    ],
    [themeData],
  );
  const monthlyYoyRows = useMemo(
    () =>
      themeData.monthlyTrend.map((row) => ({
        month: row.monthLabel,
        current: row.currentYearExits,
        previous: row.previousYearExits,
      })),
    [themeData.monthlyTrend],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-[16px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">YTD vs PY vs Target</p>
        <div className="mt-3 h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summaryRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [formatInt(value), 'Exits']} />
              <Legend />
              <ReferenceLine
                y={themeData.summary.targetYtdExits}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{ value: 'Target', fill: '#b45309', fontSize: 11, position: 'insideTopRight' }}
              />
              <Bar dataKey="value" name="Exits" radius={[4, 4, 0, 0]}>
                {summaryRows.map((row) => (
                  <Cell
                    key={`summary-cell-${row.label}`}
                    fill={
                      row.label === 'PY YTD'
                        ? '#94a3b8'
                        : row.label === 'Target YTD'
                          ? '#f59e0b'
                          : '#1d4ed8'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-[16px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Total by Month vs YoY</p>
        <div className="mt-3 h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyYoyRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [formatInt(value), 'Exits']} />
              <Legend />
              <Bar dataKey="previous" name="Previous Year" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="current" name="Current Year" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </div>
  );
}

export function TopExitReasonsChart({ rows }: { rows: HumanResourcesTurnoverThemeData['topReasons'] }) {
  const reasonRows = useMemo(
    () =>
      rows.slice(0, 6).map((row) => ({
        label: row.label,
        value: row.currentYtdExits,
      })),
    [rows],
  );

  return (
    <article className="rounded-[16px] border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Top Exit Reasons</p>
      <div className="mt-3 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={reasonRows} layout="vertical" margin={{ left: 6, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="label" type="category" width={130} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [formatInt(value), 'Exits']} />
            <Bar dataKey="value" name="Exits" fill="#ef4444" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function DepartmentContributionChart({
  rows,
}: {
  rows: HumanResourcesTurnoverThemeData['topDepartments'];
}) {
  const departmentRows = useMemo(
    () =>
      rows.slice(0, 6).map((row) => ({
        name: row.label,
        value: row.currentYtdExits,
      })),
    [rows],
  );

  return (
    <article className="rounded-[16px] border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Department Contribution</p>
      <div className="mt-3 h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={departmentRows} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
              {departmentRows.map((_, index) => (
                <Cell key={`dep-slice-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [formatInt(value), 'Exits']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function TopManagersImpactChart({
  rows,
}: {
  rows: HumanResourcesTurnoverThemeData['topManagers'];
}) {
  const managerRows = useMemo(
    () =>
      rows.slice(0, 6).map((row) => ({
        label: row.label,
        value: row.currentYtdExits,
      })),
    [rows],
  );

  return (
    <article className="rounded-[16px] border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Top Managers Impact</p>
      <div className="mt-3 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={managerRows} layout="vertical" margin={{ left: 6, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="label" type="category" width={130} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [formatInt(value), 'Exits']} />
            <Bar dataKey="value" name="Exits" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function GenderMixChart({
  rows,
}: {
  rows: HumanResourcesTurnoverThemeData['genderMix'];
}) {
  const genderRows = useMemo(
    () =>
      rows.map((row) => ({
        name: row.label,
        value: row.currentYtdExits,
      })),
    [rows],
  );

  return (
    <article className="rounded-[16px] border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Gender Mix</p>
      <div className="mt-3 h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={genderRows} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
              {genderRows.map((_, index) => (
                <Cell key={`gender-slice-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [formatInt(value), 'Exits']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function ThemeHorizontalBarChart({
  title,
  rows,
  color = '#1d4ed8',
}: {
  title: string;
  rows: HumanResourcesTurnoverThemeData['topDepartments'];
  color?: string;
}) {
  const chartRows = useMemo(
    () =>
      rows.slice(0, 8).map((row) => ({
        label: row.label,
        value: row.currentYtdExits,
      })),
    [rows],
  );

  return (
    <article className="rounded-[16px] border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{title}</p>
      <div className="mt-3 h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartRows} layout="vertical" margin={{ left: 6, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="label" type="category" width={130} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [formatInt(value), 'Exits']} />
            <Bar dataKey="value" name="Exits" fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function ThemePieChart({
  title,
  rows,
}: {
  title: string;
  rows: HumanResourcesTurnoverThemeData['genderMix'];
}) {
  const chartRows = useMemo(
    () =>
      rows.map((row) => ({
        name: row.label,
        value: row.currentYtdExits,
      })),
    [rows],
  );

  return (
    <article className="rounded-[16px] border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{title}</p>
      <div className="mt-3 h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartRows} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
              {chartRows.map((_, index) => (
                <Cell key={`theme-slice-${title}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [formatInt(value), 'Exits']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function MonthlyTrendComparisonChart({
  rows,
}: {
  rows: HumanResourcesTurnoverThemeData['monthlyTrend'];
}) {
  const chartRows = useMemo(
    () =>
      rows.map((row) => ({
        month: row.monthLabel,
        current: row.currentYearExits,
        previous: row.previousYearExits,
        currentCum: row.currentYearCumulativeExits,
        previousCum: row.previousYearCumulativeExits,
      })),
    [rows],
  );

  return (
    <article className="rounded-[16px] border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Monthly Trend (YTD vs PY)</p>
      <div className="mt-3 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartRows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [formatInt(value), 'Exits']} />
            <Legend />
            <Line type="monotone" dataKey="current" name="Current Year" stroke="#1d4ed8" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="previous" name="Previous Year" stroke="#94a3b8" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="currentCum" name="Current Cumulative" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="previousCum" name="Previous Cumulative" stroke="#475569" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
