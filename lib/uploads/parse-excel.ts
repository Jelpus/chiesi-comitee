import 'server-only';
import * as XLSX from 'xlsx';

export type ParseExcelOptions = {
  sheetName?: string | null;
  headerRow?: number | null;
};

type ParsedExcelRow = {
  rowNumber: number;
  payload: Record<string, unknown>;
};

function normalizeHeader(header: unknown, index: number) {
  const raw = String(header ?? '').trim();
  if (!raw) {
    return `column_${index + 1}`;
  }

  return raw;
}

function normalizeCellValue(value: unknown): unknown {
  if (value == null || value === '') return null;

  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  return String(value);
}

function getTargetSheetName(workbook: XLSX.WorkBook, preferredSheetName?: string | null) {
  if (preferredSheetName && workbook.SheetNames.includes(preferredSheetName)) {
    return preferredSheetName;
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El archivo Excel no contiene hojas.');
  }

  return firstSheetName;
}

export function inspectExcelWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  return workbook.SheetNames;
}

export function parseExcelRows(buffer: Buffer, options?: ParseExcelOptions): ParsedExcelRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const targetSheetName = getTargetSheetName(workbook, options?.sheetName);
  const headerRow = Math.max(1, options?.headerRow ?? 1);

  const sheet = workbook.Sheets[targetSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });

  if (matrix.length < headerRow) return [];

  const headerIndex = headerRow - 1;
  const headers = (matrix[headerIndex] ?? []).map((value, index) => normalizeHeader(value, index));
  const rows: ParsedExcelRow[] = [];

  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const cells = matrix[i] ?? [];
    const payload: Record<string, unknown> = {};

    headers.forEach((header, colIndex) => {
      payload[header] = normalizeCellValue(cells[colIndex]);
    });

    rows.push({
      rowNumber: i + 1,
      payload,
    });
  }

  return rows;
}
