import * as XLSX from 'xlsx';

export const GOB360_SNAPSHOT_MODULES = {
  business_excellence_gob360_air: 'pc',
  business_excellence_gob360_care: 'sc',
} as const;

export type Gob360SnapshotModule = keyof typeof GOB360_SNAPSHOT_MODULES;

export function isGob360SnapshotModule(value: string): value is Gob360SnapshotModule {
  return Object.hasOwn(GOB360_SNAPSHOT_MODULES, value);
}

export type Gob360SnapshotRow = {
  clave: string;
  claveNormalized: string;
  clue: string;
  periodMonth: string;
  pieces: number;
};

export type Gob360SnapshotPreview = {
  sheetName: string;
  validatedThroughMonth: string;
  includedMonths: Array<{ periodMonth: string; sourceTotal: number; parsedTotal: number; values: number; zeros: number }>;
  excludedMonths: string[];
  sourceRows: number;
  controlRows: number;
  rows: Gob360SnapshotRow[];
};

const monthNames: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

function normalized(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cellValue(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v ?? null;
}

function mergedAnchor(sheet: XLSX.WorkSheet, row: number, col: number) {
  const merge = sheet['!merges']?.find((range) =>
    row >= range.s.r && row <= range.e.r && col >= range.s.c && col <= range.e.c);
  return merge ? cellValue(sheet, merge.s.r, merge.s.c) : null;
}

function valueIncludingMerge(sheet: XLSX.WorkSheet, row: number, col: number) {
  return cellValue(sheet, row, col) ?? mergedAnchor(sheet, row, col);
}

function mergedValuesForColumn(sheet: XLSX.WorkSheet, col: number) {
  const values = new Map<number, unknown>();
  for (const merge of sheet['!merges'] ?? []) {
    if (col < merge.s.c || col > merge.e.c) continue;
    const anchor = cellValue(sheet, merge.s.r, merge.s.c);
    for (let row = merge.s.r; row <= merge.e.r; row += 1) values.set(row, anchor);
  }
  return values;
}

function monthCell(value: unknown) {
  const text = normalized(value);
  return monthNames[text] ?? null;
}

function monthDate(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function normalizedClave(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toPieces(value: unknown, address: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${address}: PIEZAS debe ser un numero; se encontro ${String(value)}.`);
  }
  // Excel exports route allocations with binary floating-point tails.
  return Math.round(value * 1e9) / 1e9;
}

function assertValidatedThroughMonth(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(value)) {
    throw new Error('Selecciona el ultimo mes validado con formato AAAA-MM.');
  }
}

/** Parse only the explicitly validated months. A blank cell has no override; zero is an override. */
export function parseGob360Snapshot(
  buffer: Buffer,
  moduleCode: Gob360SnapshotModule,
  validatedThroughMonth: string,
  preferredSheetName?: string,
): Gob360SnapshotPreview {
  assertValidatedThroughMonth(validatedThroughMonth);
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true });
  const sheetName = preferredSheetName && workbook.Sheets[preferredSheetName]
    ? preferredSheetName : workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet?.['!ref']) throw new Error('El archivo GOB360 no contiene una hoja con datos.');
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const header = 2; // Excel row 3
  const claveCol = Array.from({ length: range.e.c + 1 }, (_, col) => col)
    .find((col) => ['clave', 'clave_'].includes(normalized(cellValue(sheet, header, col))));
  const clueCol = Array.from({ length: range.e.c + 1 }, (_, col) => col)
    .find((col) => normalized(cellValue(sheet, header, col)) === 'clue');
  if (claveCol == null || clueCol == null) {
    throw new Error(`La hoja ${sheetName} necesita encabezados CLAVE y CLUE en la fila 3.`);
  }
  const headers = new Set(Array.from({ length: range.e.c + 1 }, (_, col) => normalized(cellValue(sheet, header, col))));
  if (moduleCode === 'business_excellence_gob360_air' && !headers.has('representante')) {
    throw new Error('El archivo seleccionado no tiene la estructura esperada de GOB360 Air.');
  }
  if (moduleCode === 'business_excellence_gob360_care' && !headers.has('ruta')) {
    throw new Error('El archivo seleccionado no tiene la estructura esperada de GOB360 Care.');
  }

  const pieceColumns: Array<{ col: number; periodMonth: string }> = [];
  const seenPeriods = new Set<string>();
  for (let col = 0; col <= range.e.c; col += 1) {
    if (normalized(valueIncludingMerge(sheet, 0, col)) !== 'piezas') continue;
    const year = Number(valueIncludingMerge(sheet, 1, col));
    const month = monthCell(cellValue(sheet, header, col));
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || month == null) continue;
    const periodMonth = monthDate(year, month);
    if (seenPeriods.has(periodMonth)) throw new Error(`PIEZAS contiene dos columnas para ${periodMonth}.`);
    seenPeriods.add(periodMonth);
    pieceColumns.push({ col, periodMonth });
  }
  pieceColumns.sort((a, b) => a.periodMonth.localeCompare(b.periodMonth));
  if (!seenPeriods.has(validatedThroughMonth)) {
    throw new Error(`El mes validado ${validatedThroughMonth} no existe en las columnas PIEZAS.`);
  }

  const selected = pieceColumns.filter((column) => column.periodMonth <= validatedThroughMonth);
  const excludedMonths = pieceColumns.filter((column) => column.periodMonth > validatedThroughMonth)
    .map((column) => column.periodMonth);
  const totals = new Map(selected.map((column) => [column.periodMonth, {
    periodMonth: column.periodMonth,
    sourceTotal: toPieces(cellValue(sheet, 3, column.col), `${XLSX.utils.encode_col(column.col)}4`),
    parsedTotal: 0, values: 0, zeros: 0,
  }]));
  const controls = new Map<string, Gob360SnapshotRow>();
  const claveMergedValues = mergedValuesForColumn(sheet, claveCol);
  const clueMergedValues = mergedValuesForColumn(sheet, clueCol);
  let sourceRows = 0;
  for (let row = 4; row <= range.e.r; row += 1) {
    const claveValue = cellValue(sheet, row, claveCol) ?? claveMergedValues.get(row);
    const clueValue = cellValue(sheet, row, clueCol) ?? clueMergedValues.get(row);
    const clave = String(claveValue ?? '').trim();
    const clue = String(clueValue ?? '').trim();
    if (!clave && !clue) continue;
    if (!clave || !clue) throw new Error(`Fila ${row + 1}: faltan CLAVE o CLUE.`);
    sourceRows += 1;
    for (const column of selected) {
      const value = cellValue(sheet, row, column.col);
      if (value == null || value === '') continue;
      const pieces = toPieces(value, `${XLSX.utils.encode_col(column.col)}${row + 1}`);
      const total = totals.get(column.periodMonth)!;
      total.parsedTotal += pieces;
      total.values += 1;
      if (pieces === 0) total.zeros += 1;
      const claveKey = normalizedClave(clave);
      const key = `${claveKey}\u0000${clue.toUpperCase()}\u0000${column.periodMonth}`;
      const existing = controls.get(key);
      if (existing) existing.pieces += pieces;
      else controls.set(key, { clave, claveNormalized: claveKey, clue, periodMonth: column.periodMonth, pieces });
    }
  }
  if (sourceRows === 0 || controls.size === 0) throw new Error('El snapshot no contiene piezas en los meses validados.');
  for (const total of totals.values()) {
    total.parsedTotal = Math.round(total.parsedTotal * 1e9) / 1e9;
    if (Math.abs(total.parsedTotal - total.sourceTotal) > 1e-6) {
      throw new Error(`PIEZAS ${total.periodMonth}: suma ${total.parsedTotal}, total del archivo ${total.sourceTotal}.`);
    }
  }
  const rows = [...controls.values()].map((row) => ({ ...row, pieces: Math.round(row.pieces * 1e9) / 1e9 }));
  return {
    sheetName,
    validatedThroughMonth,
    includedMonths: [...totals.values()],
    excludedMonths,
    sourceRows,
    controlRows: rows.length,
    rows,
  };
}
