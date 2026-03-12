import 'server-only';
import type {
  SalesInternalBudgetDualKpis,
  SalesInternalBudgetKpis,
  SalesInternalBudgetProductVarianceRow,
  SalesInternalBreakdownRow,
  SalesInternalDualKpisYoY,
  SalesMetricMode,
  SalesInternalTopProductRow,
  SalesInternalTrendYoY,
} from '@/types/sales-internal';

type InsightPriority = 'high' | 'medium' | 'low';

type InsightFact = {
  title: string;
  message: string;
  priority: InsightPriority;
  evidence: string[];
};

export type SalesInternalInsightsModel = {
  headline: string;
  summary: string;
  facts: InsightFact[];
  actions: string[];
  source: 'deterministic' | 'openai_enhanced';
};

export type SalesInternalScorecardSeed = {
  level: 'Total' | 'BU' | 'Product' | 'SKU';
  item: string;
  sharePct: number;
  signalPct: number | null;
  coveragePct: number | null;
  score: number;
  reason: string;
  action: string;
};

export type SalesInternalScorecardPriority = {
  title: string;
  why: string;
  opportunity: string;
  action: string;
};

export type SalesInternalScorecardPrioritiesModel = {
  priorities: SalesInternalScorecardPriority[];
  source: 'deterministic' | 'openai_enhanced';
};

type BuildInsightsInput = {
  metricMode: SalesMetricMode;
  dualKpisYoY: SalesInternalDualKpisYoY;
  budgetDualKpis: SalesInternalBudgetDualKpis;
  trendYoY: SalesInternalTrendYoY;
  channelBreakdown: SalesInternalBreakdownRow[];
  buBreakdown: SalesInternalBreakdownRow[];
  topProducts: SalesInternalTopProductRow[];
  budgetKpis: SalesInternalBudgetKpis;
  budgetVarianceRows: SalesInternalBudgetProductVarianceRow[];
};

function formatPct(value: number | null) {
  if (value === null) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function priorityFromPct(value: number | null): InsightPriority {
  if (value === null) return 'low';
  if (value <= -5) return 'high';
  if (value < 0) return 'medium';
  if (value >= 8) return 'medium';
  return 'low';
}

function rankPriority(priority: InsightPriority) {
  if (priority === 'high') return 0;
  if (priority === 'medium') return 1;
  return 2;
}

function safePortfolioMixShare(topValue: number, totalValue: number) {
  if (topValue <= 0) return 0;
  const denominator = Math.max(totalValue, topValue);
  if (denominator <= 0) return 0;
  return Math.min(100, (topValue / denominator) * 100);
}

function buildMomentumMessage(points: SalesInternalTrendYoY['points']) {
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  if (!last || !prev) {
    return {
      pct: null as number | null,
      message: 'Month-over-month signal is not available with current data granularity.',
    };
  }

  const delta = last.actualValue - prev.actualValue;
  const avg = points.length > 0
    ? points.reduce((sum, item) => sum + item.actualValue, 0) / points.length
    : 0;
  const lowBaseThreshold = Math.max(1, avg * 0.12);

  if (Math.abs(prev.actualValue) < lowBaseThreshold) {
    return {
      pct: null as number | null,
      message: `Latest month changed by ${delta.toFixed(0)} vs previous month, but the previous-month base is low so percentage signal is not reliable.`,
    };
  }

  const pct = prev.actualValue === 0 ? null : (delta / prev.actualValue) * 100;
  return {
    pct,
    message: `Latest month moved ${formatPct(pct)} vs previous month in the current YTD run rate.`,
  };
}

function buildDeterministicInsights(input: BuildInsightsInput): SalesInternalInsightsModel {
  const {
    metricMode,
    dualKpisYoY,
    budgetDualKpis,
    trendYoY,
    channelBreakdown,
    buBreakdown,
    topProducts,
    budgetKpis,
    budgetVarianceRows,
  } = input;

  const topChannel = channelBreakdown[0];
  const topBu = buBreakdown[0];
  const topProduct = topProducts[0];

  const totalChannel = channelBreakdown.reduce((sum, item) => sum + item.actualValue, 0);
  const totalBu = buBreakdown.reduce((sum, item) => sum + item.actualValue, 0);
  const topChannelShare = totalChannel > 0 ? ((topChannel?.actualValue ?? 0) / totalChannel) * 100 : 0;
  const topBuShare = totalBu > 0 ? ((topBu?.actualValue ?? 0) / totalBu) * 100 : 0;

  const top3Value = topProducts.slice(0, 3).reduce((sum, item) => sum + item.actualValue, 0);
  const positiveTrackedTotal = topProducts
    .filter((item) => item.actualValue > 0)
    .reduce((sum, item) => sum + item.actualValue, 0);
  const top3Share = safePortfolioMixShare(top3Value, positiveTrackedTotal);

  const points = trendYoY.points;
  const momentum = buildMomentumMessage(points);

  const netGrowth = dualKpisYoY.netSales.deltaPct;
  const unitsGrowth = dualKpisYoY.units.deltaPct;
  const selectedBudgetMetric =
    metricMode === 'currency' ? budgetDualKpis.netSales : budgetDualKpis.units;
  const selectedActualYtd =
    metricMode === 'currency' ? dualKpisYoY.netSales.actual : dualKpisYoY.units.actual;
  const selectedBudgetYtd = selectedBudgetMetric.budget;
  const selectedVarianceYtd = selectedActualYtd - selectedBudgetYtd;
  const selectedVariancePctYtd =
    selectedBudgetYtd === 0 ? null : selectedVarianceYtd / selectedBudgetYtd;

  const facts: InsightFact[] = [
    {
      title: 'Net Sales YoY',
      message:
        netGrowth === null
          ? 'No LY baseline is available for Net Sales yet.'
          : `Net Sales are running at ${formatPct(netGrowth)} vs LY for the comparable YTD window.`,
      priority: priorityFromPct(netGrowth),
      evidence: [
        `Actual: ${dualKpisYoY.netSales.actual.toFixed(0)}`,
        `LY: ${dualKpisYoY.netSales.ly?.toFixed(0) ?? 'N/A'}`,
        `Delta: ${dualKpisYoY.netSales.delta?.toFixed(0) ?? 'N/A'}`,
      ],
    },
    {
      title: 'Units YoY',
      message:
        unitsGrowth === null
          ? 'No LY baseline is available for Units yet.'
          : `Units are running at ${formatPct(unitsGrowth)} vs LY for the comparable YTD window.`,
      priority: priorityFromPct(unitsGrowth),
      evidence: [
        `Actual: ${dualKpisYoY.units.actual.toFixed(0)}`,
        `LY: ${dualKpisYoY.units.ly?.toFixed(0) ?? 'N/A'}`,
        `Delta: ${dualKpisYoY.units.delta?.toFixed(0) ?? 'N/A'}`,
      ],
    },
    {
      title: 'Monthly Momentum',
      message: momentum.message,
      priority: priorityFromPct(momentum.pct),
      evidence: [
        `Last month actual: ${points[points.length - 1]?.actualValue.toFixed(0) ?? 'N/A'}`,
        `Previous month actual: ${points[points.length - 2]?.actualValue.toFixed(0) ?? 'N/A'}`,
      ],
    },
    {
      title: 'Budget Variance YTD',
      message:
        !budgetKpis.hasData
          ? 'Budget baseline is not available yet for this cut.'
          : `YTD variance vs budget is ${formatPct(
              selectedVariancePctYtd === null ? null : selectedVariancePctYtd * 100,
            )} with absolute variance ${selectedVarianceYtd.toFixed(0)}.`,
      priority:
        !budgetKpis.hasData
          ? 'low'
          : selectedVariancePctYtd !== null && selectedVariancePctYtd < -0.05
            ? 'high'
            : selectedVariancePctYtd !== null && selectedVariancePctYtd < 0
              ? 'medium'
              : 'low',
      evidence: [
        `Actual YTD: ${selectedActualYtd.toFixed(0)}`,
        `Budget YTD: ${selectedBudgetYtd.toFixed(0)}`,
        `Variance: ${selectedVarianceYtd.toFixed(0)}`,
      ],
    },
    {
      title: 'Concentration Risk',
      message:
        top3Share >= 55
          ? `Top 3 products represent ${top3Share.toFixed(1)}% of portfolio mix (selected filters), concentration risk is high.`
          : `Top 3 products represent ${top3Share.toFixed(1)}% of portfolio mix (selected filters), concentration is manageable.`,
      priority: (top3Share >= 55 ? 'high' : top3Share >= 45 ? 'medium' : 'low') as InsightPriority,
      evidence: [
        `Top 3 value: ${top3Value.toFixed(0)}`,
        `Tracked positive total: ${positiveTrackedTotal.toFixed(0)}`,
      ],
    },
    {
      title: 'Channel Dominance',
      message: `Leading channel is ${topChannel?.label ?? 'N/A'} with ${topChannelShare.toFixed(1)}% contribution in current selection.`,
      priority: (topChannelShare >= 40 ? 'medium' : 'low') as InsightPriority,
      evidence: [
        `Top channel value: ${(topChannel?.actualValue ?? 0).toFixed(0)}`,
        `Total channel value: ${totalChannel.toFixed(0)}`,
      ],
    },
    {
      title: 'BU Dominance',
      message: `Leading BU is ${topBu?.label ?? 'N/A'} with ${topBuShare.toFixed(1)}% contribution in current selection.`,
      priority: (topBuShare >= 45 ? 'medium' : 'low') as InsightPriority,
      evidence: [
        `Top BU value: ${(topBu?.actualValue ?? 0).toFixed(0)}`,
        `Total BU value: ${totalBu.toFixed(0)}`,
      ],
    },
    {
      title: 'Anchor Product',
      message: `Top product is ${topProduct?.canonicalProductName ?? 'N/A'} and should be tracked as the anchor growth lever.`,
      priority: 'low',
      evidence: [
        `Product value: ${(topProduct?.actualValue ?? 0).toFixed(0)}`,
        `Product ID: ${topProduct?.productId ?? 'N/A'}`,
      ],
    },
  ];
  facts.sort((a, b) => rankPriority(a.priority) - rankPriority(b.priority));

  const score = (netGrowth ?? 0) + (unitsGrowth ?? 0);
  const headline =
    score >= 6
      ? 'Commercial momentum is accelerating'
      : score >= 0
        ? 'Commercial momentum is stable with mixed pressure points'
        : 'Commercial momentum is under pressure and needs intervention';

  const summary =
    score >= 6
      ? 'Growth is positive in both value and volume. Focus on scaling best-performing channel and BU execution.'
      : score >= 0
        ? 'Signals are mixed. Protect growth drivers and actively manage concentration risk in top products.'
        : 'YoY trend is negative. Prioritize corrective actions in channel execution, product mix and BU deployment.';

  const actions: string[] = [];
  if ((netGrowth ?? 0) < 0 || (unitsGrowth ?? 0) < 0) {
    actions.push('Launch a 30-day recovery plan for negative YoY metrics in priority channels and BU.');
  }
  if (budgetKpis.hasData && selectedVariancePctYtd !== null && selectedVariancePctYtd < 0) {
    actions.push('Activate budget recovery actions in underperforming products and tighten monthly follow-up.');
  }
  if (top3Share >= 55) {
    actions.push('Reduce concentration risk by expanding support for products ranked 4-8.');
  }
  if ((momentum.pct ?? 0) < 0) {
    actions.push('Review monthly execution cadence; momentum turned negative in the latest period.');
  }
  const worstBudget = budgetVarianceRows
    .filter((row) => row.varianceVsBudget < 0)
    .sort((a, b) => a.varianceVsBudget - b.varianceVsBudget)[0];
  if (worstBudget) {
    actions.push(
      `Prioritize recovery for ${worstBudget.canonicalProductName} (variance ${worstBudget.varianceVsBudget.toFixed(0)} vs budget).`,
    );
  }
  if (actions.length < 3) {
    actions.push('Scale what works in top channel and replicate playbook in secondary channels.');
  }
  if (actions.length < 3) {
    actions.push('Keep executive tracking on Net Sales and Units with strict YTD vs LY discipline.');
  }

  return {
    headline,
    summary,
    facts: facts.slice(0, 6),
    actions: actions.slice(0, 4),
    source: 'deterministic',
  };
}


export async function getSalesInternalInsightsModel(
  input: BuildInsightsInput,
): Promise<SalesInternalInsightsModel> {
  return buildDeterministicInsights(input);
}

function normalizeActionKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function levelLabel(level: SalesInternalScorecardSeed['level']) {
  if (level === 'BU') return 'Business Unit';
  return level;
}

function buildOpportunity(seed: SalesInternalScorecardSeed, metricMode: SalesMetricMode) {
  const unitLabel = metricMode === 'currency' ? 'value' : 'volume';
  if (seed.sharePct >= 18) {
    return `High leverage opportunity: improving this area can materially lift total ${unitLabel}.`;
  }
  if (seed.coveragePct !== null && seed.coveragePct < 1) {
    return 'Closing the budget gap here can quickly improve YTD delivery.';
  }
  return `Targeted execution here can remove drag and protect ${unitLabel} momentum.`;
}

function buildDeterministicScorecardPriorities(
  seeds: SalesInternalScorecardSeed[],
  metricMode: SalesMetricMode,
): SalesInternalScorecardPriority[] {
  const uniqueByItem = new Set<string>();
  const uniqueByAction = new Set<string>();
  const priorities: SalesInternalScorecardPriority[] = [];

  for (const seed of seeds) {
    const itemKey = `${seed.level}:${seed.item}`.toLowerCase();
    const actionKey = normalizeActionKey(seed.action);
    if (uniqueByItem.has(itemKey) || uniqueByAction.has(actionKey)) {
      continue;
    }

    uniqueByItem.add(itemKey);
    uniqueByAction.add(actionKey);

    priorities.push({
      title: `${levelLabel(seed.level)} priority: ${seed.item}`,
      why: seed.reason,
      opportunity: buildOpportunity(seed, metricMode),
      action: seed.action,
    });

    if (priorities.length >= 5) {
      break;
    }
  }

  return priorities;
}


export async function getSalesInternalScorecardPriorities(input: {
  seeds: SalesInternalScorecardSeed[];
  metricMode: SalesMetricMode;
}): Promise<SalesInternalScorecardPrioritiesModel> {
  const base = buildDeterministicScorecardPriorities(input.seeds, input.metricMode);
  return {
    priorities: base,
    source: 'deterministic',
  };
}
