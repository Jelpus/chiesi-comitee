export const RA_TOPICS = [
  'Liberaciones',
  'Registros Sanitarios',
  'Modificaciones Regulatorias',
  'Permisos de Importacion',
  'Procedimientos',
  'Auditorias Externas',
] as const;

export type RaTopicName = (typeof RA_TOPICS)[number];
export type RaCountMetric = 'on_time' | 'late' | 'pending' | 'active' | 'overdue' | 'ytd';

export const RA_TOPIC_COUNT_FIELDS: Record<RaTopicName, ReadonlyArray<RaCountMetric>> = {
  Liberaciones: ['on_time', 'late', 'pending', 'ytd'],
  'Registros Sanitarios': ['on_time', 'late', 'pending', 'ytd'],
  'Modificaciones Regulatorias': ['on_time', 'late', 'pending', 'ytd'],
  'Permisos de Importacion': ['ytd'],
  Procedimientos: ['on_time', 'late', 'pending', 'active', 'overdue', 'ytd'],
  'Auditorias Externas': ['active'],
};

const RA_COUNT_METRICS = new Set<RaCountMetric>(['on_time', 'late', 'pending', 'active', 'overdue', 'ytd']);

const RA_COUNT_FIELD_ALIASES: Record<string, RaCountMetric> = {
  on_time: 'on_time',
  ontime: 'on_time',
  'on-time': 'on_time',
  on_time_count: 'on_time',
  late: 'late',
  late_count: 'late',
  pending: 'pending',
  pending_count: 'pending',
  active: 'active',
  active_count: 'active',
  overdue: 'overdue',
  overdue_count: 'overdue',
  ytd: 'ytd',
  ytd_count: 'ytd',
  ytd_total: 'ytd',
};

export function parseRaCountFields(raw: string | null | undefined): RaCountMetric[] {
  const value = String(raw ?? '').trim();
  if (!value) return [];
  const normalizedTokens = value
    .replace(/^\[|\]$/g, '')
    .split(/[,\n;|]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .map((token) => RA_COUNT_FIELD_ALIASES[token] ?? token)
    .filter((token): token is RaCountMetric => RA_COUNT_METRICS.has(token as RaCountMetric));
  return [...new Set(normalizedTokens)];
}

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
