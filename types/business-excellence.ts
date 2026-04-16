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
  dimension: 'pack' | 'brand' | 'state' | 'manager' | 'territory';
  label: string;
  ytdUnits: number;
  ytdPyUnits: number;
  growthVsPyPct: number | null;
};

export type BusinessExcellencePrivatePrescriptionDimensionRankingRow = {
  reportingVersionId: string;
  marketGroup: string;
  scope: 'all' | 'chiesi';
  dimension: 'product' | 'brand' | 'specialty' | 'territory';
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
  mthUnits: number;
  mthPyUnits: number;
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

export type BusinessExcellenceFieldForceExcellenceRow = {
  bu: 'total' | 'air' | 'care';
  totalTerritories: number;
  portfolioAccounts: number;
  targetVisitsYtd: number;
  targetVisitsMth: number;
  targetVisitsAdjustedYtd: number;
  targetVisitsAdjustedMth: number;
  sentInteractionsYtd: number;
  sentInteractionsMth: number;
  coverageYtdPct: number | null;
  coverageMthPct: number | null;
  coverageAdjustedYtdPct: number | null;
  coverageAdjustedMthPct: number | null;
  tftDaysYtd: number;
  tftDaysMth: number;
  workingDaysYtd: number;
  workingDaysMth: number;
  effectiveDaysYtd: number;
  effectiveDaysMth: number;
  avgDailyVisitsYtd: number | null;
  avgDailyVisitsMth: number | null;
  noVisitadosYtd: number;
  noVisitadosMth: number;
  subvisitadosYtd: number;
  subvisitadosMth: number;
  enObjetivoYtd: number;
  enObjetivoMth: number;
  sobrevisitadosYtd: number;
  sobrevisitadosMth: number;
  indiceEvolucionBuYtd: number | null;
  indiceEvolucionBuMth: number | null;
};

export type BusinessExcellenceFieldForceSummaryRow = {
  periodScope: 'YTD' | 'MTH';
  aggregationLevel: 'territory' | 'district' | 'bu' | 'total';
  bu: 'total' | 'air' | 'care';
  district: string | null;
  territoryName: string | null;
  territoryNormalized: string | null;
  clients: number;
  objetivoBase: number;
  objetivoAdjusted: number;
  interacciones: number;
  coberturaBasePct: number | null;
  coberturaAdjustedPct: number | null;
  diasFuera: number;
  indiceEvolucionBuPct: number | null;
};

export type BusinessExcellenceFieldForceDoctorDetailRow = {
  periodScope: 'YTD' | 'MTH';
  bu: 'air' | 'care';
  district: string | null;
  territoryName: string | null;
  territoryNormalized: string | null;
  potencial: string | null;
  clientName: string | null;
  doctorId: string;
  objetivoBase: number;
  objetivoAdjusted: number;
  interacciones: number;
  coberturaBasePct: number | null;
  coberturaAdjustedPct: number | null;
  statusVisita: 'no_visitado' | 'subvisitado' | 'en_objetivo' | 'sobrevisitado' | 'sin_clasificacion';
};

export type BusinessExcellenceFieldForceInteractionMixRow = {
  periodScope: 'YTD' | 'MTH';
  bu: 'total' | 'air' | 'care';
  channel: string;
  visitType: string;
  interactions: number;
};

export type BusinessExcellenceFieldForceExcellenceData = {
  reportingVersionId: string;
  reportPeriodMonth: string;
  ficheroAsOfMonth: string | null;
  interactionsAsOfMonth: string | null;
  tftAsOfMonth: string | null;
  effectiveAsOfMonth: string | null;
  ytdStartMonth: string | null;
  territoriesSnapshotMonth: string | null;
  rawSentInteractionsYtdAllBu: number;
  rawSentInteractionsMthAllBu: number;
  usedSentInteractionsYtdAirCare: number;
  usedSentInteractionsMthAirCare: number;
  rows: BusinessExcellenceFieldForceExcellenceRow[];
  summaryRows: BusinessExcellenceFieldForceSummaryRow[];
  doctorDetailRows: BusinessExcellenceFieldForceDoctorDetailRow[];
  interactionMixRows: BusinessExcellenceFieldForceInteractionMixRow[];
};

export type BusinessExcellenceFieldForceTopCardKpis = {
  coverageYtdTftPct: number | null;
  activeTimeYtdPct: number | null;
};
