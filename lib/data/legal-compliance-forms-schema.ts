export const LEGAL_COMPLIANCE_KPIS = [
  '# de juicios contra Chiesi',
  '% Proveedores Contratos firmados con proveedores (80/20)',
  '# Contratos actualizados Speakers AIR',
  '# Contratos actualizados Speakers CARE',
] as const;

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
