export type BusinessExcellenceFilters = {
  reportingVersionId?: string;
  periodMonth?: string;
  marketGroup?: string;
  salesGroup?: string;
  channel?: string;
  specialty?: string;
};

export type BusinessExcellenceResolvedFilters = {
  reportingVersionId: string;
  periodMonth: string;
  marketGroup?: string;
  salesGroup?: string;
  channel?: string;
  specialty?: string;
};

export type BusinessExcellenceFilterOptions = {
  reportingVersionId: string;
  periods: string[];
  marketGroups: string[];
  salesGroups: string[];
  channels: string[];
  specialties: string[];
};

export type BusinessExcellenceAuditSource = {
  sourceKey: 'pmm' | 'closeup';
  sourceLabel: string;
  reportingVersionId: string;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
};

export type BusinessExcellenceKpis = {
  periodMonth: string;
  pmmNetSales: number;
  pmmUnits: number;
  closeupRecetas: number;
  sellOutUnits: number;
  visitedBricks: number;
  totalBricks: number;
  brickVisitRate: number | null;
};

export type BusinessExcellenceMarketRow = {
  label: string;
  pmmNetSales: number;
  pmmUnits: number;
  closeupRecetas: number;
  sellOutUnits: number;
};

export type BusinessExcellenceChannelRow = {
  label: string;
  sellOutUnits: number;
};

export type BusinessExcellenceSpecialtyRow = {
  label: string;
  closeupRecetas: number;
};

export type BusinessExcellenceManagerRow = {
  label: string;
  pmmNetSales: number;
  pmmUnits: number;
};

export type BusinessExcellenceProductRow = {
  productKey: string;
  productId: string | null;
  canonicalProductName: string;
  marketGroup: string | null;
  pmmNetSales: number;
  pmmUnits: number;
  closeupRecetas: number;
  sellOutUnits: number;
  totalSignal: number;
};

export type BusinessExcellencePrivateSellOutOverview = {
  latestPeriod: string;
  ytdStartPeriod: string;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  lastMonthNetSales: number;
  lastMonthUnits: number;
  ytdNetSales: number;
  ytdUnits: number;
};

export type BusinessExcellencePrivateSellOutMartSummary = {
  reportingVersionId: string;
  marketGroup: string | null;
  lastAvailableMonth: string | null;
  ytdUnits: number;
  ytdNetSales: number;
  ytdRx: number;
  mthUnits: number;
  mthNetSales: number;
  mthRx: number;
};

export type BusinessExcellencePrivateChannelPerformance = {
  reportingVersionId: string;
  lastAvailableMonth: string | null;
  ytdUnits: number;
  ytdUnitsPy: number;
  ytdUnitsGrowthPct: number | null;
  ytdNetSales: number;
  ytdNetSalesPy: number;
  ytdNetSalesGrowthPct: number | null;
  ytdRx: number;
  ytdRxPy: number;
  ytdRxGrowthPct: number | null;
  mthUnits: number;
  mthUnitsPy: number;
  mthUnitsGrowthPct: number | null;
  mthNetSales: number;
  mthNetSalesPy: number;
  mthNetSalesGrowthPct: number | null;
  mthRx: number;
  mthRxPy: number;
  mthRxGrowthPct: number | null;
  ytdCoverageVsBudgetPct: number | null;
  mthCoverageVsBudgetPct: number | null;
  ytdVisitedUnitsRatio: number | null;
  ytdVisitedRxRatio: number | null;
};

export type BusinessExcellencePrivateMarketChartPoint = {
  reportingVersionId: string;
  marketGroup: string;
  scope: 'all' | 'chiesi';
  periodMonth: string;
  pmmUnits: number;
  pmmNetSales: number;
  closeupRx: number;
};

export type BusinessExcellencePrivateDddDimensionRankingRow = {
  reportingVersionId: string;
  marketGroup: string;
  scope: 'all' | 'chiesi';
  dimension: 'pack' | 'state' | 'manager' | 'territory';
  label: string;
  ytdUnits: number;
  ytdPyUnits: number;
  growthVsPyPct: number | null;
};

export type BusinessExcellencePrivatePrescriptionDimensionRankingRow = {
  reportingVersionId: string;
  marketGroup: string;
  scope: 'all' | 'chiesi';
  dimension: 'product' | 'specialty' | 'territory';
  label: string;
  ytdRx: number;
  ytdPyRx: number;
  growthVsPyPct: number | null;
};

export type BusinessExcellencePrivateSellOutMartRow = {
  reportingVersionId: string;
  marketGroup: string | null;
  brandName: string;
  lastAvailableMonth: string | null;
  ytdUnits: number;
  ytdUnitsPy: number;
  growthVsPyYtdUnitsPct: number | null;
  msYtdUnitsPct: number | null;
  eiYtdUnits: number | null;
  mthUnits: number;
  mthUnitsPy: number;
  growthVsPyMthUnitsPct: number | null;
  msMthUnitsPct: number | null;
  eiMthUnits: number | null;
  ytdNetSales: number;
  mthNetSales: number;
  ytdRx: number;
  mthRx: number;
  growthVsPyYtdRxPct: number | null;
  growthVsPyMthRxPct: number | null;
  ytdRxByMg: number;
  mthRxByMg: number;
  ytdRxByNeumo: number;
  mthRxByNeumo: number;
  budgetYtdUnits: number;
  budgetMthUnits: number;
  ytdUnitsVisitedRatio: number | null;
  mthUnitsVisitedRatio: number | null;
  ytdRxVisitedRatio: number | null;
  mthRxVisitedRatio: number | null;
  ytdRxMgRatio: number | null;
  mthRxMgRatio: number | null;
  ytdRxNeumoRatio: number | null;
  mthRxNeumoRatio: number | null;
  varianceVsBudgetYtdUnitsPct: number | null;
  varianceVsBudgetYtdNetSalesPct: number | null;
  varianceVsBudgetMthUnitsPct: number | null;
  varianceVsBudgetMthNetSalesPct: number | null;
};

export type BusinessExcellencePrivateSellOutFilters = {
  periodMonth?: string;
  marketGroup?: string;
  manager?: string;
  territory?: string;
};

export type BusinessExcellencePrivateWeeklySeriesRow = {
  weekRaw: string;
  units: number;
  netSales: number;
  visitedUnits: number;
  visitedUnitsRatio: number | null;
};

export type BusinessExcellencePrivateWeeklyTopPackRow = {
  packDes: string;
  units: number;
  netSales: number;
};

export type BusinessExcellencePrivateWeeklyZoom = {
  latestWeekRaw: string | null;
  rows: BusinessExcellencePrivateWeeklySeriesRow[];
  topPacks: BusinessExcellencePrivateWeeklyTopPackRow[];
};

export type BusinessExcellencePrivateWeeklyBenchmarkRow = {
  scope: 'all' | 'chiesi';
  marketGroup: string;
  brandLabel: string;
  week1Units: number;
  week2Units: number;
  week3Units: number;
  week4Units: number;
  wowGrowthPct: number | null;
  msWeekFromPct: number | null;
  msWeekToPct: number | null;
  evolutionIndex: number | null;
};

export type BusinessExcellencePrivateWeeklyBenchmarkTotal = {
  scope: 'all' | 'chiesi';
  marketGroup: string;
  week1Units: number;
  week2Units: number;
  week3Units: number;
  week4Units: number;
  wowGrowthPct: number | null;
};

export type BusinessExcellencePrivateWeeklyBenchmark = {
  week1Raw: string | null;
  week2Raw: string | null;
  week3Raw: string | null;
  week4Raw: string | null;
  rows: BusinessExcellencePrivateWeeklyBenchmarkRow[];
  totals: BusinessExcellencePrivateWeeklyBenchmarkTotal[];
};

export type BusinessExcellencePrivateSellOutFilterOptions = {
  periods: string[];
  marketGroups: string[];
  managers: string[];
  territories: string[];
};

export type BusinessExcellencePrivatePrescriptionsOverview = {
  latestPeriod: string;
  ytdStartPeriod: string;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  ytdRecetas: number;
};

export type BusinessExcellencePrivateBrandSpecialtySignal = {
  reportingVersionId: string;
  marketGroup: string;
  brandName: string;
  specialty: string;
  ytdRx: number;
  ytdPyRx: number;
  growthVsPyPct: number | null;
};

export type BusinessExcellencePrivateUploadContext = {
  reportingVersionId: string | null;
  pmmUploadId: string | null;
  pmmSourceFileName: string | null;
  pmmSourceKey: string | null;
  privateSellOutUploadId: string | null;
  privateSellOutSourceFileName: string | null;
};

export type BusinessExcellenceSourceOverview = {
  sourceKey: 'pmm' | 'closeup' | 'budget_sell_out';
  sourceLabel: string;
  latestPeriod: string | null;
  ytdStartPeriod: string | null;
  lastMonthPrimaryValue: number;
  ytdPrimaryValue: number;
  secondaryValue: number | null;
  primaryMode: 'currency' | 'units';
  secondaryMode: 'currency' | 'units' | 'recetas' | null;
  hasData: boolean;
};

export type BusinessExcellencePrivateManagerRow = {
  label: string;
  ytdNetSales: number;
  ytdUnits: number;
};

export type BusinessExcellencePrivateTerritoryRow = {
  label: string;
  ytdNetSales: number;
  ytdUnits: number;
};

export type BusinessExcellencePrivateProductRow = {
  productId: string | null;
  canonicalProductName: string;
  ytdNetSales: number;
  ytdUnits: number;
};

export type BusinessExcellencePrivateChannelRow = {
  label: string;
  ytdUnits: number;
};

export type BusinessExcellencePrivateScorecardRow = {
  productId: string | null;
  canonicalProductName: string;
  latestUnits: number;
  lyUnits: number | null;
  budgetUnits: number | null;
  growthPct: number | null;
  coveragePct: number | null;
  marketShareLyPct: number | null;
  marketShareLatestPct: number | null;
  evolutionIndex: number | null;
};

export type BusinessExcellencePrivateScorecard = {
  marketGroup: string | null;
  latestPeriod: string;
  lyPeriod: string;
  budgetAvailable: boolean;
  rows: BusinessExcellencePrivateScorecardRow[];
  totals: {
    latestUnits: number;
    lyUnits: number | null;
    budgetUnits: number | null;
    growthPct: number | null;
    coveragePct: number | null;
    marketShareLyPct: number | null;
    marketShareLatestPct: number | null;
    evolutionIndex: number | null;
  };
};

export type BusinessExcellencePublicMarketOverview = {
  latestDate: string | null;
  scSourceMonth: string | null;
  scSourceIsFallback: boolean;
  ytdPieces: number;
  ytdPiecesPy: number;
  ytdGrowthPct: number | null;
  mthPieces: number;
  mthPiecesPy: number;
  mthGrowthPct: number | null;
  cluesActive: number;
  cluesTotalYtd: number;
  chiesiCluesActiveYtd: number;
  chiesiClueCoveragePct: number | null;
};

export type BusinessExcellencePublicMarketTopProductRow = {
  marketGroup: string | null;
  brandName: string;
  productId: string | null;
  ytdPieces: number;
  ytdPiecesPy: number;
  ytdGrowthPct: number | null;
  ytdMsPct: number | null;
  ytdMsPctPy: number | null;
  ytdEvolutionIndex: number | null;
  mthPieces: number;
  mthPiecesPy: number;
  mthGrowthPct: number | null;
  mthMsPct: number | null;
  mthMsPctPy: number | null;
  mthEvolutionIndex: number | null;
  ytdBudgetUnits: number;
  mthBudgetUnits: number;
  ytdCoverageVsBudgetPct: number | null;
  mthCoverageVsBudgetPct: number | null;
  ytdVarianceVsBudgetPct: number | null;
  mthVarianceVsBudgetPct: number | null;
};

export type BusinessExcellencePublicMarketChartPoint = {
  marketGroup: string;
  scope: 'all' | 'chiesi';
  periodMonth: string;
  units: number;
};

export type BusinessExcellencePublicDimensionRankingRow = {
  marketGroup: string;
  scope: 'all' | 'chiesi';
  dimension: 'clue' | 'clave' | 'ruta';
  label: string;
  ytdUnits: number;
  ytdPyUnits: number;
  growthVsPyPct: number | null;
};

export type BusinessExcellenceBusinessUnitChannelRow = {
  businessUnitName: string;
  privateYtdUnits: number;
  privateYtdUnitsPy: number;
  privateYtdBudgetUnits: number;
  privateYtdCoveragePct: number | null;
  publicYtdUnits: number;
  publicYtdUnitsPy: number;
  publicYtdBudgetUnits: number;
  publicYtdCoveragePct: number | null;
  totalYtdUnits: number;
  totalYtdUnitsPy: number;
  totalYtdBudgetUnits: number;
  totalYtdCoveragePct: number | null;
  privateMthUnits: number;
  privateMthUnitsPy: number;
  privateMthBudgetUnits: number;
  privateMthCoveragePct: number | null;
  publicMthUnits: number;
  publicMthUnitsPy: number;
  publicMthBudgetUnits: number;
  publicMthCoveragePct: number | null;
  totalMthUnits: number;
  totalMthUnitsPy: number;
  totalMthBudgetUnits: number;
  totalMthCoveragePct: number | null;
};
