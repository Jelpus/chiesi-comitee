import Link from 'next/link';
import { SectionHeader } from '@/components/ui/section-header';
import { OpexDashboardPanel } from '@/components/executive/opex/opex-dashboard-panel';
import { getOpexRows } from '@/lib/data/opex';

export type OpexViewMode = 'insights' | 'scorecard' | 'dashboard';

type SearchParams = {
  version?: string;
};

function modeHref(mode: OpexViewMode, params: SearchParams) {
  const query = new URLSearchParams();
  if (params.version) query.set('version', params.version);
  const queryText = query.toString();
  return `/executive/opex/${mode}${queryText ? `?${queryText}` : ''}`;
}

function formatMonth(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function formatAmount(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(1)}%`;
}

function formatSignedPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function getMetricYear(metricName: string): number | null {
  const match = metricName.match(/(\d{4})$/);
  if (!match) return null;
  return Number(match[1]);
}

function formatSignedAmount(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(abs);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function resolveMetricMap(rows: Awaited<ReturnType<typeof getOpexRows>>) {
  const metrics = [...new Set(rows.map((row) => row.metricName))];
  const actualMetrics = metrics.filter((metric) => metric.startsWith('actuals_'));
  const budgetMetrics = metrics.filter((metric) => metric.startsWith('budget_'));
  const sortedActual = actualMetrics
    .map((metric) => ({ metric, year: getMetricYear(metric) ?? -1 }))
    .sort((a, b) => b.year - a.year);
  const currentActual = sortedActual[0]?.metric ?? null;
  const pyActual = sortedActual[1]?.metric ?? null;
  const currentYear = getMetricYear(currentActual ?? '');
  const currentBudget = budgetMetrics.find((metric) => getMetricYear(metric) === currentYear) ?? null;
  return { currentActual, pyActual, currentBudget };
}

type GroupScoreRow = {
  group: string;
  actual: number;
  budget: number;
  py: number;
  coveragePct: number | null;
  growthVsPyPct: number | null;
};

function buildCoverageCards(rows: Awaited<ReturnType<typeof getOpexRows>>) {
  const metricMap = resolveMetricMap(rows);

  let ytdActual = 0;
  let ytdBudget = 0;
  let mthActual = 0;
  let mthBudget = 0;
  let fyBudget = 0;
  const ytdMonths = new Set<string>();

  for (const row of rows) {
    if (metricMap.currentActual && row.metricName === metricMap.currentActual) {
      if (row.isYtd) {
        ytdActual += row.amountValue;
        ytdMonths.add(row.periodMonth.slice(0, 7));
      }
      if (row.isMth) mthActual += row.amountValue;
    }
    if (metricMap.currentBudget && row.metricName === metricMap.currentBudget) {
      if (row.isYtd) ytdBudget += row.amountValue;
      if (row.isMth) mthBudget += row.amountValue;
      if (row.periodMonth && metricMap.currentActual) {
        const currentYear = getMetricYear(metricMap.currentActual);
        if (currentYear != null && row.periodMonth.startsWith(String(currentYear))) {
          fyBudget += row.amountValue;
        }
      }
    }
  }

  const ytdCoverage = ytdBudget > 0 ? (ytdActual / ytdBudget) * 100 : null;
  const mthCoverage = mthBudget > 0 ? (mthActual / mthBudget) * 100 : null;
  const ytdExecutionRatePct = fyBudget > 0 ? (ytdActual / fyBudget) * 100 : null;
  const monthsElapsed = ytdMonths.size > 0 ? ytdMonths.size : null;
  const expectedPacePct = monthsElapsed ? (monthsElapsed / 12) * 100 : null;
  const paceDeltaPct =
    ytdExecutionRatePct != null && expectedPacePct != null ? ytdExecutionRatePct - expectedPacePct : null;

  return {
    ytd: {
      amount: ytdActual,
      target: ytdBudget,
      varianceAmount: ytdActual - ytdBudget,
      coveragePct: ytdCoverage,
    },
    mth: {
      amount: mthActual,
      target: mthBudget,
      varianceAmount: mthActual - mthBudget,
      coveragePct: mthCoverage,
    },
    ytdExecutionRatePct,
    expectedPacePct,
    paceDeltaPct,
  };
}

function buildGroupScoreRows(rows: Awaited<ReturnType<typeof getOpexRows>>) {
  const metricMap = resolveMetricMap(rows);
  const byGroup = new Map<string, { actual: number; budget: number; py: number }>();
  for (const row of rows) {
    const group = (row.cecoNameGroup ?? '').trim() || 'Ungrouped';
    const current = byGroup.get(group) ?? { actual: 0, budget: 0, py: 0 };
    if (metricMap.currentActual && row.metricName === metricMap.currentActual && row.isYtd) {
      current.actual += row.amountValue;
    }
    if (metricMap.currentBudget && row.metricName === metricMap.currentBudget && row.isYtd) {
      current.budget += row.amountValue;
    }
    if (metricMap.pyActual && row.metricName === metricMap.pyActual && row.isYtdPy) {
      current.py += row.amountValue;
    }
    byGroup.set(group, current);
  }
  return [...byGroup.entries()]
    .map(([group, values]) => ({
      group,
      actual: values.actual,
      budget: values.budget,
      py: values.py,
      coveragePct: values.budget > 0 ? (values.actual / values.budget) * 100 : null,
      growthVsPyPct: values.py > 0 ? ((values.actual - values.py) / values.py) * 100 : null,
    }))
    .sort((a, b) => b.actual - a.actual);
}

function buildElementBudgetDeltaRows(rows: Awaited<ReturnType<typeof getOpexRows>>) {
  const metricMap = resolveMetricMap(rows);
  const byKey = new Map<string, { element: string; cecoName: string; cecoGroup: string; actual: number; budget: number }>();

  for (const row of rows) {
    const group = (row.cecoNameGroup ?? '').trim() || 'Ungrouped';
    const cecoName = (row.cecoName ?? '').trim() || 'Unassigned CeCo';
    const element = (row.element ?? '').trim() || 'Unassigned Element';
    const key = `${group}|||${cecoName}|||${element}`;
    const current = byKey.get(key) ?? { element, cecoName, cecoGroup: group, actual: 0, budget: 0 };

    if (metricMap.currentActual && row.metricName === metricMap.currentActual && row.isYtd) {
      current.actual += row.amountValue;
    }
    if (metricMap.currentBudget && row.metricName === metricMap.currentBudget && row.isYtd) {
      current.budget += row.amountValue;
    }

    byKey.set(key, current);
  }

  return [...byKey.values()]
    .map((row) => ({
      ...row,
      delta: row.actual - row.budget,
      coveragePct: row.budget > 0 ? (row.actual / row.budget) * 100 : null,
    }))
    .filter((row) => !(row.actual === 0 && row.budget === 0));
}

function classifyBucket(row: GroupScoreRow) {
  const coverage = row.coveragePct ?? -Infinity;
  const growth = row.growthVsPyPct ?? -Infinity;
  if (coverage >= 100 && growth >= 0) return 'scale_up';
  if (coverage >= 100 && growth < 0) return 'defend_margin';
  if (coverage < 100 && growth >= 0) return 'fix_plan';
  return 'turnaround';
}

function renderBucketCard(
  title: string,
  subtitle: string,
  rows: GroupScoreRow[],
  tone: 'emerald' | 'amber' | 'sky' | 'rose',
) {
  const toneStyles =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/40'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/40'
        : tone === 'sky'
          ? 'border-sky-200 bg-sky-50/40'
          : 'border-rose-200 bg-rose-50/40';
  return (
    <article className={`rounded-[18px] border p-4 ${toneStyles}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-slate-600">{title}</p>
      <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
      <div className="mt-3 space-y-2">
        {rows.slice(0, 4).map((row) => (
          <div key={`${title}-${row.group}`} className="rounded-[10px] border border-slate-200 bg-white px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">{row.group}</p>
            <p className="text-xs text-slate-700">
              Coverage {formatPercent(row.coveragePct)} | Growth {formatSignedPercent(row.growthVsPyPct)}
            </p>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-xs text-slate-500">No groups in this bucket.</p> : null}
      </div>
    </article>
  );
}

function renderOpexNarrative(rows: GroupScoreRow[], coverageCards: ReturnType<typeof buildCoverageCards>) {
  const totalActual = rows.reduce((sum, row) => sum + row.actual, 0);
  const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0);
  const totalPy = rows.reduce((sum, row) => sum + row.py, 0);
  const totalCoverage = totalBudget > 0 ? (totalActual / totalBudget) * 100 : null;
  const totalGrowth = totalPy > 0 ? ((totalActual - totalPy) / totalPy) * 100 : null;
  const top3SharePct =
    totalActual > 0
      ? (rows.slice(0, 3).reduce((sum, row) => sum + row.actual, 0) / totalActual) * 100
      : null;
  const budgetDeltaRows = rows
    .filter((row) => row.budget > 0)
    .map((row) => ({
      ...row,
      budgetDelta: row.actual - row.budget,
    }));
  const mostOverBudget = budgetDeltaRows
    .filter((row) => row.budgetDelta > 0)
    .sort((a, b) => b.budgetDelta - a.budgetDelta)[0];
  const mostUnderBudget = budgetDeltaRows
    .filter((row) => row.budgetDelta < 0)
    .sort((a, b) => a.budgetDelta - b.budgetDelta)[0];

  const byShareShift = rows
    .map((row) => {
      const currentShare = totalActual > 0 ? row.actual / totalActual : 0;
      const pyShare = totalPy > 0 ? row.py / totalPy : 0;
      return {
        ...row,
        currentSharePct: currentShare * 100,
        pySharePct: pyShare * 100,
        shareDeltaPp: (currentShare - pyShare) * 100,
      };
    })
    .sort((a, b) => Math.abs(b.shareDeltaPp) - Math.abs(a.shareDeltaPp));
  const topShareShift = byShareShift[0];

  const abovePlanCount = rows.filter((row) => (row.coveragePct ?? -Infinity) >= 100).length;
  const nearPlanCount = rows.filter(
    (row) => (row.coveragePct ?? -Infinity) >= 95 && (row.coveragePct ?? -Infinity) < 100,
  ).length;
  const belowPlanCount = rows.filter((row) => (row.coveragePct ?? Infinity) < 95).length;

  return {
    headline: `Total OPEX view: ${formatAmount(totalActual)} YTD, with ${formatPercent(totalCoverage)} budget coverage and ${formatSignedPercent(totalGrowth)} vs PY.`,
    bullets: [
      coverageCards.ytdExecutionRatePct == null
        ? 'Run-rate signal is not available because FY budget is missing for the current cut.'
        : `Run-rate risk: YTD execution is ${formatPercent(coverageCards.ytdExecutionRatePct)} vs expected pace ${formatPercent(coverageCards.expectedPacePct)} (${formatSignedPercent(coverageCards.paceDeltaPct)} delta).`,
      `Concentration alert: top 3 CeCoGroups explain ${formatPercent(top3SharePct)} of total OPEX.`,
      mostOverBudget
        ? `Largest positive budget delta: ${mostOverBudget.group} by ${formatAmount(mostOverBudget.budgetDelta)} (${formatPercent(mostOverBudget.coveragePct)} coverage).`
        : 'No CeCoGroup is currently exceeding budget.',
      mostUnderBudget
        ? `Largest negative budget delta: ${mostUnderBudget.group} by ${formatAmount(mostUnderBudget.budgetDelta)} (${formatPercent(mostUnderBudget.coveragePct)} coverage).`
        : 'No CeCoGroup is currently below budget.',
      topShareShift
        ? `Mix shift vs PY: ${topShareShift.group} moved ${formatSignedPercent(topShareShift.shareDeltaPp)} in share (${formatPercent(topShareShift.pySharePct)} -> ${formatPercent(topShareShift.currentSharePct)}).`
        : 'Mix shift vs PY is not available.',
      `Execution discipline: ${abovePlanCount} groups above plan, ${nearPlanCount} near plan, ${belowPlanCount} below plan.`,
    ],
  };
}

function ModeTabs({ active, params }: { active: OpexViewMode; params: SearchParams }) {
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

type OpexViewProps = {
  viewMode: OpexViewMode;
  searchParams?: SearchParams;
};

export async function OpexView({ viewMode, searchParams = {} }: OpexViewProps) {
  const rows = await getOpexRows(searchParams.version);
  const reportPeriodMonth = rows.map((row) => row.reportPeriodMonth).filter(Boolean).sort().at(-1) ?? null;
  const sourceAsOfMonth = rows.map((row) => row.sourceAsOfMonth).filter(Boolean).sort().at(-1) ?? null;
  const groupScores = buildGroupScoreRows(rows);
  const elementDeltaRows = buildElementBudgetDeltaRows(rows);
  const coverageCards = buildCoverageCards(rows);
  const bucketed = {
    scaleUp: groupScores.filter((row) => classifyBucket(row) === 'scale_up'),
    defendMargin: groupScores.filter((row) => classifyBucket(row) === 'defend_margin'),
    fixPlan: groupScores.filter((row) => classifyBucket(row) === 'fix_plan'),
    turnaround: groupScores.filter((row) => classifyBucket(row) === 'turnaround'),
  };
  const opexNarrative = renderOpexNarrative(groupScores, coverageCards);
  const topAboveBudgetElements = [...elementDeltaRows]
    .filter((row) => row.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 8);
  const topBelowBudgetElements = [...elementDeltaRows]
    .filter((row) => row.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Executive"
        title="Opex"
        description="CeCo-centered operating expense baseline with total and Excl. Rare visibility."
        actions={<ModeTabs active={viewMode} params={searchParams} />}
      />

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700">
          <span className="uppercase tracking-[0.14em] text-slate-500">Report Period</span>
          <span className="font-semibold text-slate-900">{formatMonth(reportPeriodMonth)}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700">
          <span className="uppercase tracking-[0.14em] text-slate-500">Source As Of</span>
          <span className="font-semibold text-slate-900">{formatMonth(sourceAsOfMonth)}</span>
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <article className="rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">YTD Budget Coverage</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatPercent(coverageCards.ytd.coveragePct)}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            <span className="text-slate-600">Amount: <span className="font-semibold text-slate-900">{formatAmount(coverageCards.ytd.amount)}</span></span>
            <span className="text-slate-600">Target: <span className="font-semibold text-slate-900">{formatAmount(coverageCards.ytd.target)}</span></span>
            <span className={`${(coverageCards.ytd.varianceAmount ?? -Infinity) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              Variance: <span className="font-semibold">{formatSignedAmount(coverageCards.ytd.varianceAmount)}</span>
            </span>
          </div>
        </article>

        <article className="rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">MTH Budget Coverage</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatPercent(coverageCards.mth.coveragePct)}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            <span className="text-slate-600">Amount: <span className="font-semibold text-slate-900">{formatAmount(coverageCards.mth.amount)}</span></span>
            <span className="text-slate-600">Target: <span className="font-semibold text-slate-900">{formatAmount(coverageCards.mth.target)}</span></span>
            <span className={`${(coverageCards.mth.varianceAmount ?? -Infinity) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              Variance: <span className="font-semibold">{formatSignedAmount(coverageCards.mth.varianceAmount)}</span>
            </span>
          </div>
        </article>
      </div>

      {viewMode === 'dashboard' ? <OpexDashboardPanel rows={rows} /> : null}

      {viewMode === 'scorecard' ? (
        <div className="space-y-4">
          <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Opex Performance Map</p>
            <p className="mt-1 text-sm text-slate-600">Buckets combine Budget Coverage and Growth vs PY at CeCoGroup level.</p>
            <div className="mt-4 grid gap-3 xl:grid-cols-4">
              {renderBucketCard('Scale Up', 'Coverage >= 100% and positive growth.', bucketed.scaleUp, 'emerald')}
              {renderBucketCard('Defend Margin', 'Coverage >= 100% but negative growth.', bucketed.defendMargin, 'amber')}
              {renderBucketCard('Fix Plan', 'Coverage < 100% but positive growth.', bucketed.fixPlan, 'sky')}
              {renderBucketCard('Turnaround', 'Coverage < 100% and negative growth.', bucketed.turnaround, 'rose')}
            </div>
          </article>

          <div className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-[24px] border border-emerald-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
              <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">Top Elements Above Budget</p>
              <div className="mt-3 space-y-2">
                {topAboveBudgetElements.map((row) => (
                  <div key={`above-${row.cecoGroup}-${row.cecoName}-${row.element}`} className="rounded-[12px] border border-emerald-200 bg-emerald-50/60 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{row.element}</p>
                    <p className="text-xs text-slate-700">
                      {row.cecoName} · {row.cecoGroup}
                    </p>
                    <p className="text-xs text-emerald-800">
                      Delta {formatAmount(row.delta)} | Coverage {formatPercent(row.coveragePct)}
                    </p>
                  </div>
                ))}
                {topAboveBudgetElements.length === 0 ? (
                  <p className="text-xs text-slate-500">No above-budget elements in current YTD cut.</p>
                ) : null}
              </div>
            </article>

            <article className="rounded-[24px] border border-rose-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
              <p className="text-xs uppercase tracking-[0.16em] text-rose-700">Top Elements Below Budget</p>
              <div className="mt-3 space-y-2">
                {topBelowBudgetElements.map((row) => (
                  <div key={`below-${row.cecoGroup}-${row.cecoName}-${row.element}`} className="rounded-[12px] border border-rose-200 bg-rose-50/60 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{row.element}</p>
                    <p className="text-xs text-slate-700">
                      {row.cecoName} · {row.cecoGroup}
                    </p>
                    <p className="text-xs text-rose-800">
                      Delta {formatAmount(row.delta)} | Coverage {formatPercent(row.coveragePct)}
                    </p>
                  </div>
                ))}
                {topBelowBudgetElements.length === 0 ? (
                  <p className="text-xs text-slate-500">No below-budget elements in current YTD cut.</p>
                ) : null}
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {viewMode === 'insights' ? (
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Opex Narrative</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{opexNarrative.headline}</p>
          <ul className="mt-3 space-y-2">
            {opexNarrative.bullets.map((text) => (
              <li key={text} className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {text}
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </div>
  );
}
