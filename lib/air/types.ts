export type AirReportingVersion = {
  reportingVersionId: string;
  periodMonth: string;
  versionName: string;
  status: string;
};

export type AirMedicalFileRow = {
  imsId: string | null;
  fullName: string | null;
  territory: string | null;
  district: string | null;
  objetivo: number;
  bu: string | null;
  accountType: string | null;
};

export type AirDoctorProfile = {
  imsId: string;
  fullName: string;
  territories: string[];
  districts: string[];
  territoriesCount: number;
  districtsCount: number;
  totalVisitObjective: number;
  medicalFileRows: number;
  isSharedBetweenTerritories: boolean;
};

export type AirGlobalMetrics = {
  totalRows: number;
  uniqueImsIds: number;
  uniquePhysiciansByName: number;
  uniqueTerritories: number;
  uniqueDistricts: number;
  totalVisitObjective: number;
  avgObjectivePerPhysician: number;
  avgPhysiciansPerTerritory: number;
  avgObjectivePerTerritory: number;
  sharedPhysiciansCount: number;
  sharedPhysiciansPercentage: number;
};

export type AirDistrictSummary = {
  district: string;
  territoryCount: number;
  uniqueImsIds: number;
  medicalFileRows: number;
  totalVisitObjective: number;
  avgObjectivePerPhysician: number;
  avgPhysiciansPerTerritory: number;
  sharedPhysiciansCount: number;
};

export type AirTerritorySummary = {
  territory: string;
  district: string;
  uniqueImsIds: number;
  medicalFileRows: number;
  totalVisitObjective: number;
  avgObjectivePerPhysician: number;
  sharedPhysiciansCount: number;
};

export type AirCallPlanMetrics = {
  global: AirGlobalMetrics;
  districts: AirDistrictSummary[];
  territories: AirTerritorySummary[];
  doctors: AirDoctorProfile[];
  issues: string[];
};

export type AirCloseupDoctor = {
  hcpName: string;
  marketGroup: string;
  visited: boolean | null;
  marketRxMat: number;
  chiesiRxMat: number;
  chiesiShareMat: number;
};

export type AirMatchConfidence = 'high' | 'medium' | 'low' | 'unmatched';

export type AirDoctorMatch = {
  medicalFileImsId: string;
  medicalFileFullName: string;
  closeupHcpName: string | null;
  matchScore: number;
  matchMethod: string;
  matchConfidence: AirMatchConfidence;
  matchedTokens: string[];
  unmatchedTokens: string[];
};

export type AirSegmentedDoctor = AirDoctorProfile & {
  closeupHcpName: string | null;
  matchScore: number;
  matchConfidence: AirMatchConfidence;
  matchedTokens: string[];
  unmatchedTokens: string[];
  marketRxMat: number;
  chiesiRxMat: number;
  chiesiShareMat: number;
  closeupVisited: boolean | null;
  marketVolumeSegment: string;
  chiesiAffinitySegment: string;
  airRelevanceSegment: string;
};

export type AirSegmentationMatrixCell = {
  marketVolumeSegment: string;
  chiesiAffinitySegment: string;
  doctorCount: number;
};

export type AirRelevanceSummary = {
  segment: string;
  total: number;
  visited: number;
  notVisited: number;
  objective: number;
  marketRx: number;
};

export type AirPublicClueSegment = {
  clue: string;
  unitName: string;
  territory: string;
  district: string;
  state: string;
  institution: string;
  reference: string;
  visited: boolean;
  marketGroup: string;
  publicDemandMat: number;
  chiesiPublicDemandMat: number;
  chiesiShareMat: number;
  demandSegment: string;
  visitCoverageSegment: string;
  chiesiAffinitySegment: string;
  airRelevanceSegment: string;
};

export type AirPublicMatrixCell = {
  demandSegment: string;
  chiesiAffinitySegment: string;
  clueCount: number;
};

export type AirPublicRelevanceSummary = {
  segment: string;
  total: number;
  visited: number;
  notVisited: number;
  publicDemandMat: number;
  chiesiPublicDemandMat: number;
};

export type AirPublicPageData = {
  selectedMarketGroup: string;
  marketGroups: string[];
  clues: AirPublicClueSegment[];
  matrix: AirPublicMatrixCell[];
  relevanceSummary: AirPublicRelevanceSummary[];
  totalClues: number;
  visitedClues: number;
  notVisitedClues: number;
  totalPublicDemandMat: number;
  totalChiesiPublicDemandMat: number;
  warnings: string[];
};

export type AirPublicRecommendationAction =
  | 'add_to_route'
  | 'maintain_coverage'
  | 'increase_priority'
  | 'decrease_priority'
  | 'remove_or_deprioritize'
  | 'review_manually';

export type AirPublicScenarioClueRow = {
  scenarioId: ScenarioId;
  clue: string;
  unitName: string;
  state: string;
  institution: string;
  marketGroup: string;
  currentTerritory: string;
  recommendedTerritory: string;
  district: string;
  visited: boolean;
  recommendedVisits: number;
  recommendationAction: AirPublicRecommendationAction;
  recommendationReason: string;
  opportunityScore: number;
  publicDemandMat: number;
  chiesiPublicDemandMat: number;
  chiesiShareMat: number;
  demandSegment: string;
  chiesiAffinitySegment: string;
  airRelevanceSegment: string;
};

export type AirPublicScenarioTerritoryRow = {
  scenarioId: ScenarioId;
  territory: string;
  district: string;
  state: string;
  visitedCluesBase: number;
  recommendedClues: number;
  recommendedVisits: number;
  availableCapacity: number;
  maxCapacity: number;
  capacityGap: number;
  capacityUtilization: number;
  capacityStatus: CapacityStatus;
  cluesAdded: number;
  cluesRemoved: number;
};

export type AirPublicScenarioSummary = {
  scenarioId: ScenarioId;
  scenarioName: string;
  totalCluesRecommended: number;
  totalRecommendedVisits: number;
  availableCapacity: number;
  maxCapacity: number;
  capacityGap: number;
  capacityUtilization: number;
  publicDemandMatCovered: number;
  chiesiPublicDemandMatCovered: number;
  highPotentialCluesIncluded: number;
  lowPriorityCluesIncluded: number;
  cluesAdded: number;
  cluesRemoved: number;
  cluesReview: number;
  territoriesOverMaxCapacity: number;
  warnings: string[];
};

export type AirPublicScenarioResult = {
  definition: AirScenarioDefinition;
  summary: AirPublicScenarioSummary;
  clueRows: AirPublicScenarioClueRow[];
  territoryRows: AirPublicScenarioTerritoryRow[];
};

export type CapacityStatus =
  | 'underutilized'
  | 'balanced'
  | 'moderately_overloaded'
  | 'critically_overloaded';

export type RecommendationAction =
  | 'increase_frequency'
  | 'maintain_frequency'
  | 'decrease_frequency'
  | 'remove_or_deprioritize'
  | 'add_to_call_plan'
  | 'review_manually';

export type ScenarioId =
  | 'baseline'
  | 'optimize_private_growth'
  | 'defend_chiesi_core'
  | 'deprioritize_low_roi'
  | 'balanced_redesign';

export type AirTerritoryCapacity = {
  territory: string;
  district: string;
  currentAssignedVisits: number;
  availableCapacity: number;
  capacityGap: number;
  capacityUtilization: number;
  capacityStatus: CapacityStatus;
};

export type AirDistrictCapacity = {
  district: string;
  territoryCount: number;
  districtCapacity: number;
  districtCurrentAssignedVisits: number;
  districtCapacityGap: number;
  districtCapacityUtilization: number;
  overloadedTerritoriesCount: number;
  underutilizedTerritoriesCount: number;
};

export type AirDoctorOpportunity = {
  imsId: string;
  opportunityScore: number;
  marketVolumeScore: number;
  conversionPotentialScore: number;
  chiesiAffinityScore: number;
  visitedGapScore: number;
  strategicPriorityScore: number;
  matchConfidenceScore: number;
};

export type AirDoctorRecommendation = AirDoctorOpportunity & {
  recommendedObjective: number;
  recommendationAction: RecommendationAction;
  recommendationReason: string;
};

export type AirScenarioDefinition = {
  scenarioId: ScenarioId;
  scenarioName: string;
  description: string;
};

export type AirScenarioDoctorRow = {
  scenarioId: ScenarioId;
  imsId: string;
  fullName: string;
  territory: string;
  district: string;
  currentObjective: number;
  scenarioObjective: number;
  objectiveDelta: number;
  recommendationAction: RecommendationAction;
  recommendationReason: string;
  opportunityScore: number;
  marketRxMat: number;
  chiesiRxMat: number;
  chiesiShareMat: number;
  visited: boolean | null;
  matchConfidence: AirMatchConfidence;
  marketVolumeSegment: string;
  chiesiAffinitySegment: string;
  airRelevanceSegment: string;
};

export type AirScenarioTerritoryRow = {
  scenarioId: ScenarioId;
  territory: string;
  district: string;
  currentObjectiveTotal: number;
  scenarioObjectiveTotal: number;
  availableCapacity: number;
  capacityGap: number;
  capacityUtilization: number;
  capacityStatus: CapacityStatus;
  doctorsAdded: number;
  doctorsIncreased: number;
  doctorsDecreased: number;
  doctorsRemoved: number;
};

export type AirScenarioSummary = {
  scenarioId: ScenarioId;
  scenarioName: string;
  totalDoctors: number;
  totalCurrentObjective: number;
  totalRecommendedObjective: number;
  availableCapacity: number;
  capacityGap: number;
  capacityUtilization: number;
  marketRxMatCovered: number;
  chiesiRxMatCovered: number;
  marketCoveragePercentage: number;
  chiesiCoveragePercentage: number;
  highPotentialDoctorsIncluded: number;
  lowPriorityDoctorsIncluded: number;
  doctorsAdded: number;
  doctorsIncreased: number;
  doctorsDecreased: number;
  doctorsRemoved: number;
  doctorsReview: number;
  territoriesOverloaded: number;
  territoriesUnderutilized: number;
  warnings: string[];
};

export type AirScenarioResult = {
  definition: AirScenarioDefinition;
  summary: AirScenarioSummary;
  doctorRows: AirScenarioDoctorRow[];
  territoryRows: AirScenarioTerritoryRow[];
};

export type AirPageData = {
  reportingVersion: AirReportingVersion | null;
  selectedMarketGroup: string;
  marketGroups: string[];
  medicalRows: AirMedicalFileRow[];
  closeupDoctors: AirCloseupDoctor[];
  callPlan: AirCallPlanMetrics;
  matches: AirDoctorMatch[];
  segmentedDoctors: AirSegmentedDoctor[];
  matrix: AirSegmentationMatrixCell[];
  relevanceSummary: AirRelevanceSummary[];
  warnings: string[];
  publicData?: AirPublicPageData;
};
