export type HumanResourcesAuditSource = {
  sourceKey: 'turnover' | 'training';
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

export type HumanResourcesTurnoverDepartmentRow = {
  department: string;
  exits: number;
  voluntaryExits: number;
  involuntaryExits: number;
};

export type HumanResourcesTrainingUserRow = {
  userName: string;
  peopleId: string | null;
  totalHours: number;
  completedRecords: number;
  totalRecords: number;
  completionRate: number | null;
};

