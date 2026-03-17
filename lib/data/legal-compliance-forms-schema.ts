export const LEGAL_COMPLIANCE_KPIS = [
  '# de juicios contra Chiesi',
  '% Proveedores Contratos firmados con proveedores (80/20)',
  '# Contratos actualizados Speakers AIR',
  '# Contratos actualizados Speakers CARE',
] as const;

export type LegalComplianceKpiName = (typeof LEGAL_COMPLIANCE_KPIS)[number];
export type LegalComplianceAnswerField = 'current_count' | 'active_count' | 'additional_amount_mxn';

export const LEGAL_COMPLIANCE_KPI_FIELDS: Record<LegalComplianceKpiName, ReadonlyArray<LegalComplianceAnswerField>> = {
  '# de juicios contra Chiesi': ['current_count', 'active_count', 'additional_amount_mxn'],
  '% Proveedores Contratos firmados con proveedores (80/20)': ['current_count', 'active_count'],
  '# Contratos actualizados Speakers AIR': ['current_count', 'active_count'],
  '# Contratos actualizados Speakers CARE': ['current_count', 'active_count'],
};

const LEGAL_FIELDS_SET = new Set<LegalComplianceAnswerField>([
  'current_count',
  'active_count',
  'additional_amount_mxn',
]);

const LEGAL_FIELDS_ALIASES: Record<string, LegalComplianceAnswerField> = {
  current: 'current_count',
  current_count: 'current_count',
  active: 'active_count',
  active_count: 'active_count',
  additional: 'additional_amount_mxn',
  additional_amount_mxn: 'additional_amount_mxn',
  liability: 'additional_amount_mxn',
  contingent_liability: 'additional_amount_mxn',
};

export function parseLegalComplianceFields(raw: string | null | undefined): LegalComplianceAnswerField[] {
  const value = String(raw ?? '').trim();
  if (!value) return [];
  const normalizedTokens = value
    .replace(/^\[|\]$/g, '')
    .split(/[,\n;|]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .map((token) => LEGAL_FIELDS_ALIASES[token] ?? token)
    .filter((token): token is LegalComplianceAnswerField => LEGAL_FIELDS_SET.has(token as LegalComplianceAnswerField));
  return [...new Set(normalizedTokens)];
}

export type LegalComplianceKpiInput = {
  kpiName: string;
  objectiveCount: number | null;
  currentCount: number | null;
  activeCount: number | null;
  additionalAmountMxn: number | null;
  comment: string;
};

export type LegalComplianceMonthlyInputRow = {
  inputId: string;
  periodMonth: string;
  sourceAsOfMonth: string;
  kpiName: string;
  objectiveCount: number | null;
  currentCount: number | null;
  activeCount: number | null;
  additionalAmountMxn: number | null;
  comment: string;
  reportedBy: string | null;
  updatedAt: string | null;
};
