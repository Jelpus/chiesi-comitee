export type MedicalTargetRow = {
  targetId: string;
  kpiName: string;
  kpiLabel: string;
  qtyUnit: string;
  objectiveValueText: string;
  objectiveValueNumeric: number | null;
};

export type MedicalInputRow = {
  inputId: string;
  periodMonth: string;
  sourceAsOfMonth: string;
  kpiName: string;
  resultValueNumeric: number | null;
  resultValueText: string;
  comment: string;
  reportedBy: string | null;
  updatedAt: string | null;
};

export type MedicalInputUpsert = {
  kpiName: string;
  resultValueNumeric: number | null;
  resultValueText: string;
  comment: string;
};
