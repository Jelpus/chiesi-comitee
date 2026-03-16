export const RA_TOPICS = [
  'Liberaciones',
  'Registros Sanitarios',
  'Modificaciones Regulatorias',
  'Permisos de Importacion',
  'Procedimientos',
  'Auditorias Externas',
] as const;

export type RaTopicName = (typeof RA_TOPICS)[number];

export type RaTopicInput = {
  topic: string;
  targetLabel: string;
  resultSummary: string;
  onTimeCount: number | null;
  lateCount: number | null;
  pendingCount: number | null;
  activeCount: number | null;
  overdueCount: number | null;
  ytdCount: number | null;
  comment: string;
};

export type RaMonthlyInputRow = {
  inputId: string;
  periodMonth: string;
  sourceAsOfMonth: string;
  topic: string;
  targetLabel: string;
  resultSummary: string;
  onTimeCount: number | null;
  lateCount: number | null;
  pendingCount: number | null;
  activeCount: number | null;
  overdueCount: number | null;
  ytdCount: number | null;
  comment: string;
  reportedBy: string | null;
  updatedAt: string | null;
};

