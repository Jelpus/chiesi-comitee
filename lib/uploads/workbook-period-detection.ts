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
  if (moduleCode === 'business_excellence_gob360_air' || moduleCode === 'business_excellence_gob360_care') {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet?.['!ref']) return [];
    const range = xlsx.utils.decode_range(sheet['!ref']);
    const names: Record<string, number> = {
      enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
      julio: 7, agosto: 8, septiembre: 9, setiembre: 9,
      octubre: 10, noviembre: 11, diciembre: 12,
    };
    const value = (row: number, col: number) => {
      const direct = sheet[xlsx.utils.encode_cell({ r: row, c: col })]?.v;
      if (direct != null) return direct;
      const merge = sheet['!merges']?.find((item) => row >= item.s.r && row <= item.e.r && col >= item.s.c && col <= item.e.c);
      return merge ? sheet[xlsx.utils.encode_cell(merge.s)]?.v : null;
    };
    const periods = new Set<string>();
    for (let col = 0; col <= range.e.c; col += 1) {
      if (normalizeHeaderCandidate(value(0, col)) !== 'piezas') continue;
      const year = Number(value(1, col));
      const month = names[String(value(2, col) ?? '').trim().toLowerCase()];
      if (Number.isInteger(year) && year >= 2000 && year <= 2100 && month) {
        periods.add(`${year}-${String(month).padStart(2, '0')}-01`);
      }
    }
    return [...periods].sort();
  }
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
