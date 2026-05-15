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

export type ParsedExcelRowWithSheet = ParsedExcelRow & {
  sheetName: string;
};

function decodeCsvBuffer(buffer: Buffer) {
  const utf8 = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const replacementCharCount = (utf8.match(/\uFFFD/g) ?? []).length;
  if (replacementCharCount > 0) {
    return buffer.toString('latin1').replace(/^\uFEFF/, '');
  }
  return utf8;
}

function detectCsvDelimiter(lines: string[]) {
  const candidates = [',', ';', '\t', '|'];
  const sampleLine = lines.find((line) => line.trim().length > 0) ?? '';
  if (!sampleLine) return ',';

  let best = ',';
  let bestCount = -1;
  for (const delimiter of candidates) {
    const count = Math.max(0, sampleLine.split(delimiter).length - 1);
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function parseCsvLine(line: string, delimiter: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function parseCsvRows(
  buffer: Buffer,
  options?: ParseExcelOptions,
): ParsedExcelRow[] {
  const text = decodeCsvBuffer(buffer);
  const lines = text.split(/\r?\n/);
  const delimiter = detectCsvDelimiter(lines);
  const headerRow = Math.max(1, options?.headerRow ?? 1);

  if (lines.length < headerRow) return [];

  const headerLine = lines[headerRow - 1] ?? '';
  const headers = parseCsvLine(headerLine, delimiter).map((value, index) =>
    normalizeHeader(value, index),
  );
  if (headers.length === 0) return [];

  const rows: ParsedExcelRow[] = [];
  for (let i = headerRow; i < lines.length; i += 1) {
    const line = lines[i];
    if (line == null || line.trim().length === 0) continue;

    const cells = parseCsvLine(line, delimiter);
    const payload: Record<string, unknown> = {};
    headers.forEach((header, colIndex) => {
      const normalizedValue = normalizeCellValue(cells[colIndex] ?? null);
      payload[header] = normalizedValue;
      payload[`column_${colIndex + 1}`] = normalizedValue;
    });

    rows.push({
      rowNumber: i + 1,
      payload,
    });
  }

  return rows;
}

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

function getCellRawValue(cell: XLSX.CellObject | undefined): unknown {
  if (!cell) return null;
  if (cell.v == null || cell.v === '') return null;
  return normalizeCellValue(cell.v);
}

function toMatrix(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });
}

function parseCsvMatrixFallbacks(buffer: Buffer): unknown[][] {
  const textVariants = [
    buffer.toString('utf8').replace(/^\uFEFF/, ''),
    buffer.toString('latin1').replace(/^\uFEFF/, ''),
  ];
  const separators = [',', ';', '\t'];

  let best: unknown[][] = [];
  let bestScore = -1;

  for (const text of textVariants) {
    if (!text.trim()) continue;
    for (const fs of separators) {
      try {
        const wb = XLSX.read(text, { type: 'string', FS: fs } as XLSX.ParsingOptions);
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        if (!firstSheet) continue;
        const matrix = toMatrix(firstSheet);
        const rowCount = matrix.length;
        const colCount = Math.max(0, ...matrix.map((row) => (Array.isArray(row) ? row.length : 0)));
        const score = rowCount * 10 + colCount;
        if (score > bestScore) {
          best = matrix;
          bestScore = score;
        }
      } catch {
        // ignore parse attempts
      }
    }
  }

  return best;
}

function getTargetSheetName(workbook: XLSX.WorkBook, preferredSheetName?: string | null) {
  if (preferredSheetName && workbook.SheetNames.includes(preferredSheetName)) {
    return preferredSheetName;
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The source file does not contain parseable sheets/tabs.');
  }

  return firstSheetName;
}

function normalizeHeaderCandidate(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function detectExcelHeaderRow(
  buffer: Buffer,
  options: {
    sheetName?: string | null;
    requiredHeaders: string[];
    maxRowsToScan?: number;
  },
) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const targetSheetName = getTargetSheetName(workbook, options.sheetName);
  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet?.['!ref']) return null;

  const requiredHeaders = options.requiredHeaders.map(normalizeHeaderCandidate).filter(Boolean);
  if (requiredHeaders.length === 0) return null;

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const maxRowsToScan = Math.max(1, options.maxRowsToScan ?? 25);
  const lastRowToScan = Math.min(range.e.r, range.s.r + maxRowsToScan - 1);

  for (let rowIndex = range.s.r; rowIndex <= lastRowToScan; rowIndex += 1) {
    const normalizedCells = new Set<string>();
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      const normalizedValue = normalizeHeaderCandidate(getCellRawValue(sheet[address]));
      if (normalizedValue) normalizedCells.add(normalizedValue);
    }
    const hasRequiredHeaders = requiredHeaders.every((header) => normalizedCells.has(header));
    if (hasRequiredHeaders) {
      return rowIndex + 1;
    }
  }

  return null;
}

export function inspectExcelWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  return workbook.SheetNames;
}

export function parseExcelRows(buffer: Buffer, options?: ParseExcelOptions): ParsedExcelRow[] {
  if ((options?.sheetName ?? '').toUpperCase() === 'CSV') {
    return parseCsvRows(buffer, options);
  }

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const targetSheetName = getTargetSheetName(workbook, options?.sheetName);
  const headerRow = Math.max(1, options?.headerRow ?? 1);
  const readMatrix = (wb: XLSX.WorkBook) => toMatrix(wb.Sheets[targetSheetName]);

  let matrix = readMatrix(workbook);

  // CSV fallback: if parser produced one single semicolon-separated column, retry with FS=';'.
  const headerIndex = headerRow - 1;
  const headerCandidate = matrix[headerIndex]?.[0];
  if (
    Array.isArray(matrix[headerIndex]) &&
    (matrix[headerIndex]?.length ?? 0) <= 1 &&
    typeof headerCandidate === 'string' &&
    headerCandidate.includes(';')
  ) {
    const workbookSemicolon = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      FS: ';',
    } as XLSX.ParsingOptions);
    matrix = readMatrix(workbookSemicolon);
  }

  // Robust CSV fallback for edge encodings / separators.
  if (matrix.length === 0 || (matrix.length === 1 && (matrix[0]?.length ?? 0) <= 1)) {
    const csvFallbackMatrix = parseCsvMatrixFallbacks(buffer);
    if (csvFallbackMatrix.length > matrix.length) {
      matrix = csvFallbackMatrix;
    }
  }

  if (matrix.length < headerRow) return [];

  const headers = (matrix[headerIndex] ?? []).map((value, index) => normalizeHeader(value, index));
  const rows: ParsedExcelRow[] = [];

  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const cells = matrix[i] ?? [];
    const payload: Record<string, unknown> = {};

    headers.forEach((header, colIndex) => {
      const normalizedValue = normalizeCellValue(cells[colIndex]);
      payload[header] = normalizedValue;
      payload[`column_${colIndex + 1}`] = normalizedValue;
    });

    rows.push({
      rowNumber: i + 1,
      payload,
    });
  }

  return rows;
}

export function* iterateExcelRows(
  buffer: Buffer,
  options?: ParseExcelOptions,
): Generator<ParsedExcelRowWithSheet> {
  if ((options?.sheetName ?? '').toUpperCase() === 'CSV') {
    for (const row of parseCsvRows(buffer, options)) {
      yield { ...row, sheetName: 'CSV' };
    }
    return;
  }

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const targetSheetName = getTargetSheetName(workbook, options?.sheetName);
  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet?.['!ref']) return;

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headerRow = Math.max(1, options?.headerRow ?? 1);
  const headerIndex = headerRow - 1;
  if (headerIndex < range.s.r || headerIndex > range.e.r) return;

  const headers: string[] = [];
  for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
    const address = XLSX.utils.encode_cell({ r: headerIndex, c: colIndex });
    headers.push(normalizeHeader(getCellRawValue(sheet[address]), colIndex - range.s.c));
  }
  if (headers.length === 0) return;

  for (let rowIndex = headerIndex + 1; rowIndex <= range.e.r; rowIndex += 1) {
    const payload: Record<string, unknown> = {};
    let hasValue = false;

    headers.forEach((header, relativeColIndex) => {
      const colIndex = range.s.c + relativeColIndex;
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      const normalizedValue = getCellRawValue(sheet[address]);
      if (normalizedValue != null && normalizedValue !== '') hasValue = true;
      payload[header] = normalizedValue;
      payload[`column_${relativeColIndex + 1}`] = normalizedValue;
    });

    if (!hasValue) continue;

    yield {
      rowNumber: rowIndex + 1,
      payload,
      sheetName: targetSheetName,
    };
  }
}
