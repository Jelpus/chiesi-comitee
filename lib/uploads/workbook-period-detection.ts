import type * as XLSX from 'xlsx';

function normalizeHeaderCandidate(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function normalizeWorkbookPeriod(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (/^\d{6}$/.test(digits)) {
    const month = Number(digits.slice(4, 6));
    if (month >= 1 && month <= 12) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-01`;
  }
  if (/^\d{4}$/.test(digits)) {
    const month = Number(digits.slice(0, 2));
    if (month >= 1 && month <= 12) return `20${digits.slice(2, 4)}-${digits.slice(0, 2)}-01`;
  }
  return null;
}

export function detectWorkbookPeriodMonths(
  xlsx: typeof XLSX,
  workbook: XLSX.WorkBook,
  moduleCode: string,
) {
  if (!['business_excellence_cuotas', 'cuotas'].includes(moduleCode)) return [];

  const periods = new Set<string>();
  for (const sheetName of workbook.SheetNames) {
    if (!['AIR', 'CARE'].includes(sheetName.trim().toUpperCase())) continue;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
    for (const row of rows) {
      const periodEntry = Object.entries(row).find(([key]) => normalizeHeaderCandidate(key) === 'periodo');
      const period = normalizeWorkbookPeriod(periodEntry?.[1]);
      if (period) periods.add(period);
    }
  }
  return [...periods].sort();
}
