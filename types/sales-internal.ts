export type SalesMetricMode = 'currency' | 'units';

export type SalesInternalFilters = {
  periodMonth?: string;
  bu?: string;
  channel?: string;
  distributionChannel?: string;
  salesGroup?: string;
  productId?: string;
};

export type SalesInternalSummaryRow = {
  periodMonth: string;
  bu: string;
  channel: string;
  distributionChannel: string;
  distributionChannelName: string;
  salesGroup: string;
  actualValue: number;
  rowCount: number;
  customerCount: number;
  lastNormalizedAt: string | null;
};

export type SalesInternalProductRow = {
  periodMonth: string;
  bu: string;
  channel: string;
  distributionChannel: string;
  distributionChannelName: string;
  salesGroup: string;
  productId: string;
  canonicalProductCode: string;
  canonicalProductName: string;
  actualValue: number;
  rowCount: number;
  customerCount: number;
};

export type SalesInternalFilterOptions = {
  periods: string[];
  bus: string[];
  businessUnits: { value: string; label: string }[];
  channels: string[];
  distributionChannels: { value: string; label: string; channel: string }[];
  salesGroups: string[];
};

export type SalesInternalKpis = {
  totalActualValue: number;
};

export type SalesInternalDualKpis = {
  netSalesTotal: number;
  unitsTotal: number;
};

export type SalesInternalComparisonContext = {
  analysisYear: number | null;
  lyYear: number | null;
  cutoffMonth: number | null;
  hasLyData: boolean;
};

export type SalesInternalKpiComparison = {
  actual: number;
  ly: number | null;
  delta: number | null;
  deltaPct: number | null;
};

export type SalesInternalDualKpisYoY = {
  context: SalesInternalComparisonContext;
  netSales: SalesInternalKpiComparison;
  units: SalesInternalKpiComparison;
};

export type SalesInternalTrendPoint = {
  month: number;
  monthLabel: string;
  actualValue: number;
  lyValue: number | null;
};

export type SalesInternalTrendYoY = {
  context: SalesInternalComparisonContext;
  points: SalesInternalTrendPoint[];
};

export type SalesInternalBudgetKpis = {
  analysisYear: number | null;
  cutoffMonth: number | null;
  hasData: boolean;
  actualTotal: number;
  budgetTotal: number;
  varianceTotal: number;
  variancePct: number | null;
};

export type SalesInternalBudgetProductVarianceRow = {
  productId: string;
  canonicalProductCode: string;
  canonicalProductName: string;
  bu: string;
  salesGroup: string;
  actualValue: number;
  budgetValue: number;
  varianceVsBudget: number;
  varianceVsBudgetPct: number | null;
  coveragePct: number | null;
};

export type SalesInternalBudgetMetricComparison = {
  actual: number;
  budget: number;
  variance: number;
  variancePct: number | null;
  coveragePct: number | null;
};

export type SalesInternalBudgetDualKpis = {
  analysisYear: number | null;
  cutoffMonth: number | null;
  hasData: boolean;
  netSales: SalesInternalBudgetMetricComparison;
  units: SalesInternalBudgetMetricComparison;
};

export type SalesInternalBreakdownRow = {
  label: string;
  actualValue: number;
};

export type SalesInternalBudgetBreakdownRow = {
  label: string;
  budgetValue: number;
};

export type SalesInternalBudgetBrandBreakdownRow = {
  label: string;
  actualValue: number;
  budgetValue: number;
  varianceValue: number;
};

export type SalesInternalBudgetChannelPerformanceRow = {
  label: string;
  actualValue: number;
  budgetValue: number;
  varianceValue: number;
};

export type SalesInternalBudgetMonthlyRow = {
  periodMonth: string;
  productId: string;
  bu: string;
  channel: string;
  budgetValue: number;
};

export type SalesInternalTopProductRow = {
  productId: string;
  canonicalProductCode: string;
  canonicalProductName: string;
  actualValue: number;
  rowCount: number;
  customerCount: number;
  brandName: string | null;
  subbrandOrDevice: string | null;
  portfolioName: string | null;
  businessUnitName: string | null;
  lifecycleStatus: string | null;
  notes: string | null;
};
