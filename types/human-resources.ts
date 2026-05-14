export type HumanResourcesAuditSource = {
  sourceKey: 'turnover' | 'training' | 'open_vacancy';
  sourceLabel: string;
  reportingVersionId: string;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
};

export type HumanResourcesTurnoverOverview = {
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  ytdExits: number;
  ytdVoluntaryExits: number;
  ytdInvoluntaryExits: number;
};

export type HumanResourcesTrainingOverview = {
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  ytdTotalHours: number;
  ytdCompleted: number;
  ytdTotalRecords: number;
  ytdCompletionRate: number | null;
  ytdActiveUsers: number;
};

export type HumanResourcesOpenVacancyOverview = {
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  ytdOpened: number;
  openPositions: number;
  coveredPositions: number;
  pausedPositions: number;
  aboutToEnterPositions: number;
  avgTimeToFillDays: number | null;
  targetHitRate: number | null;
};

export type HumanResourcesOpenVacancyMonthlyTrendRow = {
  monthLabel: string;
  monthOrder: number;
  opened: number;
  covered: number;
  open: number;
  paused: number;
  aboutToEnter: number;
  avgTimeToFillDays: number | null;
};

export type HumanResourcesOpenVacancyBreakdownRow = {
  label: string;
  opened: number;
  covered: number;
  open: number;
  paused: number;
  aboutToEnter: number;
  avgTimeToFillDays: number | null;
  targetHitRate: number | null;
};

export type HumanResourcesOpenVacancyDetailRow = {
  status: string | null;
  area: string | null;
  openingType: string | null;
  vacancyType: string | null;
  subtype: string | null;
  manager: string | null;
  respHr: string | null;
  agency: string | null;
  assignedRecruiter: string | null;
  searchStartDate: string | null;
  endDate: string | null;
  hireDate: string | null;
  timeToFillDays: number | null;
  targetDays: number | null;
  withinTarget: boolean | null;
};

export type HumanResourcesOpenVacancyData = {
  overview: HumanResourcesOpenVacancyOverview | null;
  monthlyTrend: HumanResourcesOpenVacancyMonthlyTrendRow[];
  byArea: HumanResourcesOpenVacancyBreakdownRow[];
  byType: HumanResourcesOpenVacancyBreakdownRow[];
  details: HumanResourcesOpenVacancyDetailRow[];
};

export type HumanResourcesTurnoverDepartmentRow = {
  department: string;
  exits: number;
  voluntaryExits: number;
  involuntaryExits: number;
};

export type HumanResourcesTrainingUserRow = {
  userName: string;
  peopleId: string | null;
  employeeName: string | null;
  area: string | null;
  totalHours: number;
  completedRecords: number;
  totalRecords: number;
  completionRate: number | null;
};

export type HumanResourcesTrainingScope = 'total' | 'online' | 'face_to_face';
export type HumanResourcesTrainingMetricMode = 'events' | 'hours' | 'employees';

export type HumanResourcesTrainingSummary = {
  trainedEmployeesYtd: number;
  activeEmployeesYtd: number;
  coverageRateYtd: number | null;
  completedEventsYtd: number;
  learningHoursYtd: number;
  avgHoursPerTrainedEmployeeYtd: number | null;
  avgTrainingsPerTrainedEmployeeYtd: number | null;
  avgHoursPerEventYtd: number | null;
  trainedEmployeesPy: number;
  completedEventsPy: number;
  learningHoursPy: number;
  growthVsPyTrainedEmployeesPct: number | null;
  growthVsPyCompletedEventsPct: number | null;
  growthVsPyLearningHoursPct: number | null;
};

export type HumanResourcesTrainingMixRow = {
  label: string;
  ytdEvents: number;
  ytdHours: number;
  ytdEmployees: number;
  eventsSharePct: number | null;
  hoursSharePct: number | null;
};

export type HumanResourcesTrainingMonthlyTrendRow = {
  monthLabel: string;
  monthOrder: number;
  currentYearEvents: number;
  previousYearEvents: number;
  currentYearHours: number;
  previousYearHours: number;
  currentYearEmployees: number;
  previousYearEmployees: number;
};

export type HumanResourcesTrainingContentRow = {
  entityTitle: string;
  ytdEvents: number;
  ytdHours: number;
  ytdEmployees: number;
  latestRevisionMonth: string | null;
  latestCompletionMonth: string | null;
};

export type HumanResourcesTrainingInsights = {
  type: 'performance' | 'coverage' | 'concentration' | 'mix' | 'quality' | 'freshness' | 'economic';
  title: string;
  message: string;
  severity: 'positive' | 'warning' | 'negative' | 'neutral';
};

export type HumanResourcesTrainingThemeData = {
  scope: HumanResourcesTrainingScope;
  summary: HumanResourcesTrainingSummary;
  itemTypeMix: HumanResourcesTrainingMixRow[];
  completionStatusMix: HumanResourcesTrainingMixRow[];
  topContent: HumanResourcesTrainingContentRow[];
  monthlyTrend: HumanResourcesTrainingMonthlyTrendRow[];
  top10UsersHoursSharePct: number | null;
  top20UsersEventsSharePct: number | null;
  totalProfessionalCreditsYtd: number;
  totalContactHoursYtd: number;
  totalCpeYtd: number;
  creditsEventSharePct: number | null;
  tuitionYtd: number;
  paidTrainingSharePct: number | null;
  zeroCostTrainingSharePct: number | null;
  recentRevisionSharePct: number | null;
  contentOlderThan12MonthsSharePct: number | null;
  insights: HumanResourcesTrainingInsights[];
};

export type HumanResourcesTrainingRankingDimension =
  | 'area'
  | 'entity_title'
  | 'item_type'
  | 'instructor';

export type HumanResourcesTrainingRankingRow = {
  label: string;
  events: number;
  hours: number;
  employees: number;
};

export type HumanResourcesTurnoverQuarterRow = {
  quarter: string;
  exitsCurrentYear: number;
  exitsPreviousYear: number;
  cumulativeCurrentYearPct: number | null;
  cumulativePreviousYearPct: number | null;
};

export type HumanResourcesTurnoverReasonRow = {
  reason: string;
  voluntaryExits: number;
  involuntaryExits: number;
  totalExits: number;
};

export type HumanResourcesTurnoverSeniorityRow = {
  seniorityBand: string;
  voluntaryExits: number;
  involuntaryExits: number;
  totalExits: number;
};

export type HumanResourcesTurnoverScope = 'total' | 'voluntary' | 'involuntary';

export type HumanResourcesTurnoverThemeSummary = {
  currentYtdExits: number;
  previousYtdExits: number;
  targetYtdExits: number;
  varianceVsTarget: number;
  varianceVsPy: number;
  growthVsPyPct: number | null;
  onTrackToTarget: boolean;
};

export type HumanResourcesTurnoverThemeItem = {
  label: string;
  currentYtdExits: number;
  previousYtdExits: number;
  growthVsPyPct: number | null;
  contributionPct: number | null;
  sampleEmployeeNames: string[];
};

export type HumanResourcesTurnoverMonthlyTrendRow = {
  monthLabel: string;
  monthOrder: number;
  currentYearExits: number;
  previousYearExits: number;
  currentYearCumulativeExits: number;
  previousYearCumulativeExits: number;
};

export type HumanResourcesTurnoverKeyRoleMetrics = {
  keyPeopleExits: number;
  keyPeopleSharePct: number | null;
  keyPositionExits: number;
  keyPositionSharePct: number | null;
};

export type HumanResourcesTurnoverRiskIndices = {
  attritionRiskIndex: number;
  compensationRiskIndex: number;
  hiringQualityRiskIndex: number;
};

export type HumanResourcesTurnoverInsightItem = {
  type: 'performance' | 'structural' | 'risk' | 'compensation';
  title: string;
  message: string;
  severity: 'positive' | 'warning' | 'negative' | 'neutral';
};

export type HumanResourcesTurnoverThemeData = {
  scope: HumanResourcesTurnoverScope;
  summary: HumanResourcesTurnoverThemeSummary;
  topReasons: HumanResourcesTurnoverThemeItem[];
  topDepartments: HumanResourcesTurnoverThemeItem[];
  topTerritories: HumanResourcesTurnoverThemeItem[];
  topManagers: HumanResourcesTurnoverThemeItem[];
  seniorityMix: HumanResourcesTurnoverThemeItem[];
  ageMix: HumanResourcesTurnoverThemeItem[];
  genderMix: HumanResourcesTurnoverThemeItem[];
  compensationMix: HumanResourcesTurnoverThemeItem[];
  earlyAttritionMix: HumanResourcesTurnoverThemeItem[];
  keyRoleMetrics: HumanResourcesTurnoverKeyRoleMetrics;
  riskIndices: HumanResourcesTurnoverRiskIndices;
  monthlyTrend: HumanResourcesTurnoverMonthlyTrendRow[];
  insights: HumanResourcesTurnoverInsightItem[];
};
