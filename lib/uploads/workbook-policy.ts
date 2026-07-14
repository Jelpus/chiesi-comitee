export type WorkbookSheetMode = 'single_user_selected' | 'multi_required' | 'single_system_selected';

export type WorkbookSheetRequirement = {
  label: string;
  aliases: string[];
  match: 'exact' | 'includes';
};

export type WorkbookPolicy = {
  mode: WorkbookSheetMode;
  requirements: WorkbookSheetRequirement[];
};

export type WorkbookSheetCheck = WorkbookSheetRequirement & {
  resolvedSheetName: string | null;
};

const MANUAL_SINGLE_POLICY: WorkbookPolicy = {
  mode: 'single_user_selected',
  requirements: [],
};

const POLICY_BY_MODULE: Record<string, WorkbookPolicy> = {
  business_excellence_cuotas: {
    mode: 'multi_required',
    requirements: [
      { label: 'AIR', aliases: ['air'], match: 'exact' },
      { label: 'CARE', aliases: ['care'], match: 'exact' },
    ],
  },
  cuotas: {
    mode: 'multi_required',
    requirements: [
      { label: 'AIR', aliases: ['air'], match: 'exact' },
      { label: 'CARE', aliases: ['care'], match: 'exact' },
    ],
  },
  opex_by_cc: {
    mode: 'multi_required',
    requirements: [
      { label: 'Ant', aliases: ['ant', 'previous', 'prev', 'prior'], match: 'includes' },
      { label: 'Budget', aliases: ['budget', 'presupuesto', 'plan'], match: 'includes' },
      { label: 'Current', aliases: ['current', 'actual', 'real'], match: 'includes' },
    ],
  },
  commercial_operations_aging: {
    mode: 'multi_required',
    requirements: [
      { label: 'Aging', aliases: ['aging'], match: 'exact' },
      { label: 'Forecast', aliases: ['forecast'], match: 'exact' },
      { label: 'Cobranza', aliases: ['cobranza'], match: 'exact' },
    ],
  },
  commercial_operations_ar: {
    mode: 'multi_required',
    requirements: [
      { label: 'Aging', aliases: ['aging'], match: 'exact' },
      { label: 'Forecast', aliases: ['forecast'], match: 'exact' },
      { label: 'Cobranza', aliases: ['cobranza'], match: 'exact' },
    ],
  },
  ar: {
    mode: 'multi_required',
    requirements: [
      { label: 'Aging', aliases: ['aging'], match: 'exact' },
      { label: 'Forecast', aliases: ['forecast'], match: 'exact' },
      { label: 'Cobranza', aliases: ['cobranza'], match: 'exact' },
    ],
  },
  business_excellence_recompra_lexicomp: {
    mode: 'single_system_selected',
    requirements: [
      { label: 'DETALLE DESPLAZAMIENTO', aliases: ['detalledesplazamiento'], match: 'exact' },
    ],
  },
};

export function normalizeWorkbookSheetName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function getWorkbookPolicy(moduleCode: string): WorkbookPolicy {
  return POLICY_BY_MODULE[moduleCode.trim().toLowerCase()] ?? MANUAL_SINGLE_POLICY;
}

export function inspectWorkbookSheets(moduleCode: string, sheetNames: string[]) {
  const policy = getWorkbookPolicy(moduleCode);
  const available = sheetNames.map((sheetName) => ({
    original: sheetName,
    normalized: normalizeWorkbookSheetName(sheetName),
  }));
  const checks: WorkbookSheetCheck[] = policy.requirements.map((requirement) => {
    const match = available.find((sheet) => requirement.aliases.some((alias) => (
      requirement.match === 'exact'
        ? sheet.normalized === alias
        : sheet.normalized.includes(alias)
    )));
    return { ...requirement, resolvedSheetName: match?.original ?? null };
  });

  return {
    policy,
    checks,
    resolvedSheetNames: checks.flatMap((check) => check.resolvedSheetName ? [check.resolvedSheetName] : []),
    missingLabels: checks.filter((check) => !check.resolvedSheetName).map((check) => check.label),
  };
}

export function assertWorkbookSheets(moduleCode: string, sheetNames: string[]) {
  const inspection = inspectWorkbookSheets(moduleCode, sheetNames);
  if (inspection.policy.mode !== 'single_user_selected' && inspection.missingLabels.length > 0) {
    throw new Error(
      `El archivo de ${moduleCode} no contiene las hojas requeridas: ${inspection.missingLabels.join(', ')}.`,
    );
  }
  return inspection;
}
