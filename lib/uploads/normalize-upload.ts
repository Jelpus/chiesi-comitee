import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';

type RawUploadRow = {
  row_number: number;
  row_payload_json: unknown;
};

type RowValidationResult = {
  rowNumber: number;
  validationStatus: 'valid' | 'error' | 'skipped';
  errors: string[];
};

type SalesInternalNormalizedRow = {
  rowNumber: number;
  keyValue: string | null;
  bu: string | null;
  channel: string | null;
  fpnaCode: string | null;
  fpnaDescription: string | null;
  salesGroup: string | null;
  profitCenter: string | null;
  profitCenterName: string | null;
  account: string | null;
  accountDescription: string | null;
  customer: string | null;
  customerName: string | null;
  material: string | null;
  materialName: string | null;
  distributionChannel: string | null;
  distributionChannelName: string | null;
  periodMonth: string;
  amountValue: number;
  payload: Record<string, unknown>;
};

type CloseupNormalizedRow = {
  rowNumber: number;
  productCloseupRaw: string;
  productCloseupNormalized: string;
  productId: string | null;
  canonicalProductName: string | null;
  marketGroup: string | null;
  specialty: string | null;
  sourceDateRaw: string | null;
  sourceDate: string;
  periodRaw: string | null;
  periodMonth: string;
  visitedSourceRaw: string | null;
  visited: boolean;
  recetasValue: number;
};

type PmmNormalizedRow = {
  rowNumber: number;
  packDesRaw: string;
  packDesNormalized: string;
  productId: string | null;
  canonicalProductName: string | null;
  marketGroup: string | null;
  brick: string | null;
  sourceMonthRaw: string | null;
  sourceYearRaw: string | null;
  sourceDate: string;
  periodMonth: string;
  salesGroup: 'Units' | 'Net Sales';
  amountValue: number;
};

type SellOutNormalizedRow = {
  rowNumber: number;
  sourceProductRaw: string;
  sourceProductNormalized: string;
  productId: string | null;
  canonicalProductName: string | null;
  marketGroup: string | null;
  channel: string | null;
  periodMonth: string;
  salesGroup: 'Units';
  amountValue: number;
  payload: Record<string, unknown>;
};

type BrickAssignmentNormalizedRow = {
  rowNumber: number;
  brickCode: string;
  brickDescription: string | null;
  state: string | null;
  category: string | null;
  district: string | null;
  territoryId: string | null;
  manager: string | null;
  territory: string | null;
  visited: boolean;
  periodMonth: string;
};

type WeeklyTrackingNormalizedRow = {
  rowNumber: number;
  weekRaw: string | null;
  periodMonth: string;
  brickCode: string | null;
  brickDescription: string | null;
  prodDes: string | null;
  prodCode: string | null;
  packDes: string | null;
  atcivCode: string | null;
  atcivDesc: string | null;
  packCode: string | null;
  marketCode: string | null;
  salesGroup: 'Units' | 'Net Sales';
  amountValue: number;
  payload: Record<string, unknown>;
};

type HumanResourcesMetricNormalizedRow = {
  rowNumber: number;
  metricType: 'turnover' | 'training';
  area: string | null;
  periodMonth: string;
  metricValue: number;
  payload: Record<string, unknown>;
};

type HumanResourcesTurnoverNormalizedRow = {
  rowNumber: number;
  periodMonth: string;
  volNonVol: string | null;
  lastName: string | null;
  firstName: string | null;
  positionName: string | null;
  department: string | null;
  territory: string | null;
  manager: string | null;
  salary: number | null;
  salaryBands: string | null;
  salaryBandsPct: number | null;
  internalOrExternal: string | null;
  keyPeople: string | null;
  keyPosition: string | null;
  hiringDateMonth: string | null;
  lastWorkingDayMonth: string | null;
  quarter: string | null;
  year: number | null;
  years: number | null;
  seniorityCluster: string | null;
  ageAsOfDate: number | null;
  seniority: number | null;
  gender: string | null;
  grade: string | null;
  terminationAdRationale: string | null;
  payload: Record<string, unknown>;
};

type HumanResourcesTrainingNormalizedRow = {
  rowNumber: number;
  periodMonth: string;
  userName: string | null;
  activeUser: string | null;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  entityId: string | null;
  itemType: string | null;
  entityType: string | null;
  itemRevisionDateMonth: string | null;
  revisionNumber: string | null;
  entityTitle: string | null;
  classId: string | null;
  completionDateMonth: string | null;
  grade: string | null;
  completionStatusId: string | null;
  completionStatus: string | null;
  totalHours: number | null;
  creditHoursProfessionalAssociations: number | null;
  contactHours: number | null;
  cpe: number | null;
  tuition: number | null;
  currencySymbol: string | null;
  currencyId: string | null;
  instructor: string | null;
  lastUpdateUser: string | null;
  lastUpdateTimeMonth: string | null;
  eSignatureMeaningCode: string | null;
  comments: string | null;
  payload: Record<string, unknown>;
};

let ensureCloseupStagingSchemaPromise: Promise<void> | null = null;

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function runChunksInParallel<T>(
  chunks: T[][],
  worker: (chunk: T[]) => Promise<void>,
  maxConcurrency: number,
) {
  let nextChunkIndex = 0;

  async function runWorker() {
    while (true) {
      const chunkIndex = nextChunkIndex;
      nextChunkIndex += 1;
      if (chunkIndex >= chunks.length) return;
      await worker(chunks[chunkIndex]);
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrency, Math.max(chunks.length, 1)) },
    () => runWorker(),
  );
  await Promise.all(workers);
}

function isConcurrentUpdateError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('could not serialize access to table') ||
    message.includes('concurrent update') ||
    message.includes('exceeded quota for table update operations') ||
    message.includes('rate limits')
  );
}

async function runQueryWithRetryOnConcurrentUpdate<T>(
  fn: () => Promise<T>,
  retries = 4,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isConcurrentUpdateError(error) || attempt === retries) {
        break;
      }
      const waitMs = 300 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError;
}

async function ensureCloseupStagingSchema() {
  if (!ensureCloseupStagingSchemaPromise) {
    ensureCloseupStagingSchemaPromise = (async () => {
      const client = getBigQueryClient();

      await runQueryWithRetryOnConcurrentUpdate(() =>
        client.query({
          query: `
            CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_closeup\` (
              upload_id STRING,
              row_number INT64,
              product_closeup_raw STRING,
              product_closeup_normalized STRING,
              product_id STRING,
              canonical_product_name STRING,
              market_group STRING,
              specialty STRING,
              source_date_raw STRING,
              source_date DATE,
              period_raw STRING,
              period_month DATE,
              visited_source_raw STRING,
              visited BOOL,
              recetas_value NUMERIC,
              source_payload_json JSON,
              normalized_at TIMESTAMP
            )
          `,
        }),
      );

      await runQueryWithRetryOnConcurrentUpdate(() =>
        client.query({
          query: `
            ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_closeup\`
            ADD COLUMN IF NOT EXISTS period_raw STRING
          `,
        }),
      );

      await runQueryWithRetryOnConcurrentUpdate(() =>
        client.query({
          query: `
            ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_closeup\`
            ADD COLUMN IF NOT EXISTS visited_source_raw STRING
          `,
        }),
      );

      await runQueryWithRetryOnConcurrentUpdate(() =>
        client.query({
          query: `
            ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_closeup\`
            ADD COLUMN IF NOT EXISTS visited BOOL
          `,
        }),
      );
    })();
  }

  await ensureCloseupStagingSchemaPromise;
}

export type NormalizeUploadResult = {
  ok: true;
  normalizedRows: number;
  rowsValid: number;
  rowsSkipped: number;
  rowsError: number;
  topValidationIssues: Array<{
    reason: string;
    count: number;
  }>;
};

function countValidRows(validations: RowValidationResult[]) {
  return validations.filter((item) => item.validationStatus === 'valid').length;
}

function countErrorRows(validations: RowValidationResult[]) {
  return validations.filter((item) => item.validationStatus === 'error').length;
}

function countSkippedRows(validations: RowValidationResult[]) {
  return validations.filter((item) => item.validationStatus === 'skipped').length;
}

function summarizeValidationIssues(validations: RowValidationResult[], limit = 3) {
  const counts = new Map<string, number>();

  for (const validation of validations) {
    for (const error of validation.errors) {
      const reason = error.trim();
      if (!reason) continue;
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
    .slice(0, limit);
}

function buildNormalizeUploadResult(
  validations: RowValidationResult[],
  normalizedRowCount: number,
): NormalizeUploadResult {
  return {
    ok: true,
    normalizedRows: normalizedRowCount,
    rowsValid: countValidRows(validations),
    rowsSkipped: countSkippedRows(validations),
    rowsError: countErrorRows(validations),
    topValidationIssues: summarizeValidationIssues(validations),
  };
}

const MONTHS: Record<string, string> = {
  january: '01',
  jan: '01',
  enero: '01',
  february: '02',
  feb: '02',
  febrero: '02',
  march: '03',
  mar: '03',
  marzo: '03',
  april: '04',
  apr: '04',
  abril: '04',
  may: '05',
  mayo: '05',
  june: '06',
  jun: '06',
  junio: '06',
  july: '07',
  jul: '07',
  julio: '07',
  august: '08',
  aug: '08',
  agosto: '08',
  september: '09',
  sep: '09',
  sept: '09',
  septiembre: '09',
  setiembre: '09',
  october: '10',
  oct: '10',
  octubre: '10',
  november: '11',
  nov: '11',
  noviembre: '11',
  december: '12',
  dec: '12',
  diciembre: '12',
};

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function asNullableString(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function asNullableNumber(value: unknown) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const compact = raw
    .replace(/\s/g, '')
    .replace(/[$€£]/g, '')
    .replace(/[^\d,.\-]/g, '');
  if (!compact) return null;

  const commaCount = (compact.match(/,/g) ?? []).length;
  const dotCount = (compact.match(/\./g) ?? []).length;
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  let normalized = compact;

  // If both separators exist, whichever appears last is treated as decimal separator.
  if (commaCount > 0 && dotCount > 0) {
    if (lastComma > lastDot) {
      normalized = compact.replace(/\./g, '').replace(/,/g, '.');
    } else {
      normalized = compact.replace(/,/g, '');
    }
  } else if (commaCount > 0) {
    const lastChunk = compact.slice(lastComma + 1);
    // Single comma with 1-2 decimals => decimal separator; otherwise thousands separator.
    normalized =
      commaCount === 1 && lastChunk.length <= 2
        ? compact.replace(/,/g, '.')
        : compact.replace(/,/g, '');
  } else if (dotCount > 0) {
    const lastChunk = compact.slice(lastDot + 1);
    // Single dot with 1-2 decimals => decimal separator; otherwise thousands separator.
    normalized =
      dotCount === 1 && lastChunk.length <= 2
        ? compact
        : compact.replace(/\./g, '');
  }

  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function deriveVisitedFromTerritory(value: string | null) {
  const normalized = value ? normalizeText(value) : '';
  if (!normalized) return false;

  if (
    normalized.includes('no visitado') ||
    normalized.includes('sin visitar') ||
    normalized.includes('no visitar') ||
    normalized.includes('not visited') ||
    normalized.includes('n visitado') ||
    normalized.includes('sin visistar')
  ) {
    return false;
  }

  return true;
}

function buildPayloadIndex(payload: Record<string, unknown>) {
  const index = new Map<string, unknown>();
  for (const [key, value] of Object.entries(payload)) {
    index.set(normalizeKey(key), value);
  }
  return index;
}

function unwrapJsonValue(input: unknown): unknown {
  if (input == null) return null;

  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }

  if (typeof input === 'object') {
    const maybeWrapped = input as Record<string, unknown>;
    if ('value' in maybeWrapped && Object.keys(maybeWrapped).length <= 2) {
      return unwrapJsonValue(maybeWrapped.value);
    }
  }

  return input;
}

function toPayloadObject(input: unknown): Record<string, unknown> {
  const unwrapped = unwrapJsonValue(input);

  if (!unwrapped || typeof unwrapped !== 'object' || Array.isArray(unwrapped)) {
    return {};
  }

  return Object.fromEntries(Object.entries(unwrapped as Record<string, unknown>));
}

function pickValue(index: Map<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const found = index.get(normalizeKey(alias));
    if (found !== undefined) return found;
  }
  return null;
}

function parseMonthHeader(header: string): string | null {
  const cleanHeader = header
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const match = cleanHeader.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;

  const monthToken = match[1].toLowerCase();
  const year = match[2];
  const month = MONTHS[monthToken];
  if (!month) return null;

  return `${year}-${month}-01`;
}

function toMonthStartFromDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function parseExcelSerialDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const utcEpoch = Date.UTC(1899, 11, 30);
  const millis = utcEpoch + Math.round(serial * 86400000);
  const parsed = new Date(millis);
  if (Number.isNaN(parsed.getTime())) return null;
  return toMonthStartFromDate(parsed);
}

function parseDateField(value: unknown): string | null {
  if (value == null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toMonthStartFromDate(value);
  }

  if (typeof value === 'number') {
    return parseExcelSerialDate(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const isoUtc = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/,
  );
  if (isoUtc) {
    const parsedUtc = new Date(raw);
    if (!Number.isNaN(parsedUtc.getTime())) {
      const hour = Number(isoUtc[4]);
      // Excel -> JSON conversions can shift midnight local dates to 22:xx/23:xx UTC.
      // When that happens, recover the intended calendar date before month truncation.
      if (hour >= 22) {
        parsedUtc.setUTCDate(parsedUtc.getUTCDate() + 1);
      }
      return toMonthStartFromDate(parsedUtc);
    }
  }

  const numericValue = Number(raw);
  if (Number.isFinite(numericValue) && /^\d+(\.\d+)?$/.test(raw)) {
    const fromExcel = parseExcelSerialDate(numericValue);
    if (fromExcel) return fromExcel;
  }

  const yyyyMmDd = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (yyyyMmDd) {
    const year = Number(yyyyMmDd[1]);
    const month = Number(yyyyMmDd[2]);
    const day = Number(yyyyMmDd[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(parsed.getTime())) return toMonthStartFromDate(parsed);
  }

  const ddMmYyyy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddMmYyyy) {
    const day = Number(ddMmYyyy[1]);
    const month = Number(ddMmYyyy[2]);
    const year = Number(ddMmYyyy[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(parsed.getTime())) return toMonthStartFromDate(parsed);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return toMonthStartFromDate(parsed);
  }

  return null;
}

function parseDateFieldMonthFirst(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date || typeof value === 'number') {
    return parseDateField(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const mmDdYyyy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mmDdYyyy) {
    const month = Number(mmDdYyyy[1]);
    const day = Number(mmDdYyyy[2]);
    const year = Number(mmDdYyyy[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(parsed.getTime())) return toMonthStartFromDate(parsed);
  }

  return parseDateField(value);
}

function parseMonthToken(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber >= 1 && asNumber <= 12) {
      return String(Math.trunc(asNumber)).padStart(2, '0');
    }
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const numericMatch = raw.match(/^\d{1,2}$/);
  if (numericMatch) {
    const monthNumber = Number(raw);
    if (monthNumber >= 1 && monthNumber <= 12) {
      return String(monthNumber).padStart(2, '0');
    }
  }

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return MONTHS[normalized] ?? null;
}

function parseYearToken(value: unknown): number | null {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const fullYearMatch = raw.match(/^\d{4}$/);
  if (fullYearMatch) {
    const year = Number(raw);
    if (year >= 1900 && year <= 2200) return year;
  }

  const shortYearMatch = raw.match(/^\d{2}$/);
  if (shortYearMatch) {
    const yy = Number(raw);
    return yy >= 70 ? 1900 + yy : 2000 + yy;
  }

  return null;
}

function parseMonthYearField(monthValue: unknown, yearValue: unknown): string | null {
  const month = parseMonthToken(monthValue);
  const year = parseYearToken(yearValue);
  if (!month || !year) return null;
  return `${year}-${month}-01`;
}

function parseCloseupPeriodField(value: unknown): string | null {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const parsedAsDate = parseDateField(raw);
  if (parsedAsDate) return parsedAsDate;

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();

  const match = normalized.match(/([A-Za-z]{3,})\s+(\d{2,4})$/);
  if (!match) return null;

  const month = parseMonthToken(match[1]);
  const year = parseYearToken(match[2]);
  if (!month || !year) return null;
  return `${year}-${month}-01`;
}

function shiftMonths(periodMonth: string, deltaMonths: number) {
  const date = new Date(`${periodMonth}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return periodMonth;
  date.setUTCMonth(date.getUTCMonth() + deltaMonths);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function toIsoWeekStartDate(year: number, isoWeek: number): Date | null {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return null;
  if (!Number.isInteger(isoWeek) || isoWeek < 1 || isoWeek > 53) return null;

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4IsoDay = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4IsoDay + 1);

  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (isoWeek - 1) * 7);
  if (Number.isNaN(target.getTime())) return null;
  return target;
}

function parseWeeklyPeriodField(value: unknown): string | null {
  if (value == null || value === '') return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, '').toUpperCase();
  const sixDigit = compact.match(/^(\d{4})(\d{2})$/);
  const isoWeekPattern = compact.match(/^(\d{4})[-_/]?W?(\d{1,2})$/);
  const parsed =
    sixDigit ??
    isoWeekPattern;

  if (parsed) {
    const year = Number(parsed[1]);
    const week = Number(parsed[2]);
    const weekStart = toIsoWeekStartDate(year, week);
    if (weekStart) return toMonthStartFromDate(weekStart);
  }

  return parseDateField(value);
}

function extractMonthlyValues(payload: Record<string, unknown>) {
  const values: { periodMonth: string; amountValue: number | null }[] = [];

  for (const [header, rawValue] of Object.entries(payload)) {
    const periodMonth = parseMonthHeader(header);
    if (!periodMonth) continue;

    values.push({
      periodMonth,
      amountValue: asNullableNumber(rawValue),
    });
  }

  return values;
}

function hasBusinessContent(payload: Record<string, unknown>) {
  return Object.values(payload).some((value) => {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  });
}

async function getRawRows(uploadId: string): Promise<RawUploadRow[]> {
  const client = getBigQueryClient();
  const query = `
    SELECT
      row_number,
      row_payload_json
    FROM \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\`
    WHERE upload_id = @uploadId
    ORDER BY row_number
  `;

  const [rows] = await client.query({ query, params: { uploadId } });
  return rows as RawUploadRow[];
}

async function getUploadAsOfMonth(uploadId: string) {
  const client = getBigQueryClient();
  const query = `
    SELECT
      CAST(COALESCE(source_as_of_month, period_month) AS STRING) AS as_of_month
    FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
    WHERE upload_id = @uploadId
    LIMIT 1
  `;

  try {
    const [rows] = await client.query({ query, params: { uploadId } });
    const row = (rows as Array<Record<string, unknown>>)[0];
    return row?.as_of_month ? String(row.as_of_month) : null;
  } catch {
    return null;
  }
}

async function getUploadSourceTag(uploadId: string) {
  const client = getBigQueryClient();
  const query = `
    SELECT
      COALESCE(NULLIF(TRIM(ddd_source), ''), '') AS source_tag,
      source_file_name
    FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
    WHERE upload_id = @uploadId
    LIMIT 1
  `;

  try {
    const [rows] = await client.query({ query, params: { uploadId } });
    const row = (rows as Array<Record<string, unknown>>)[0];
    const sourceTag = String(row?.source_tag ?? '').trim().toLowerCase();
    if (sourceTag) return sourceTag;
    const fileName = String(row?.source_file_name ?? '').toLowerCase();
    if (fileName.includes('privado') || fileName.includes('private')) return 'privado';
    if (fileName.includes('gobierno') || fileName.includes('government')) return 'gobierno';
    return null;
  } catch {
    return null;
  }
}

async function updateRawValidationStatus(uploadId: string, validations: RowValidationResult[]) {
  if (validations.length === 0) return;

  const client = getBigQueryClient();
  const query = `
    UPDATE \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\` AS target
    SET
      validation_status = source.validation_status,
      validation_error_json = PARSE_JSON(source.validation_error_json)
    FROM UNNEST(@rows) AS source
    WHERE
      target.upload_id = @uploadId
      AND target.row_number = source.row_number
  `;

  const chunks = chunkItems(validations, 2000);
  for (const chunk of chunks) {
    await runQueryWithRetryOnConcurrentUpdate(() =>
      client.query({
        query,
        params: {
          uploadId,
          rows: chunk.map((item) => ({
            row_number: item.rowNumber,
            validation_status: item.validationStatus,
            validation_error_json: JSON.stringify(item.errors),
          })),
        },
      }),
    );
  }
}

async function loadSalesInternalStaging(uploadId: string, rows: SalesInternalNormalizedRow[]) {
  const client = getBigQueryClient();

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_sales_internal\`
      WHERE upload_id IN (
        WITH current_upload AS (
          SELECT reporting_version_id, period_month
          FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
          WHERE upload_id = @uploadId
          LIMIT 1
        )
        SELECT u.upload_id
        FROM \`chiesi-committee.chiesi_committee_raw.uploads\` u
        JOIN current_upload c
          ON u.reporting_version_id = c.reporting_version_id
         AND u.period_month = c.period_month
        WHERE LOWER(TRIM(u.module_code)) = 'sales_internal'
          AND u.upload_id != @uploadId
      )
    `,
    params: { uploadId },
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_sales_internal\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId },
  });

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_sales_internal\`
    (
      upload_id,
      row_number,
      key_value,
      bu,
      channel,
      fpna_code,
      fpna_description,
      sales_group,
      profit_center,
      profit_center_name,
      account,
      account_description,
      customer,
      customer_name,
      material,
      material_name,
      distribution_channel,
      distribution_channel_name,
      period_month,
      amount_value,
      source_payload_json,
      normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      row.key_value,
      row.bu,
      row.channel,
      row.fpna_code,
      row.fpna_description,
      row.sales_group,
      row.profit_center,
      row.profit_center_name,
      row.account,
      row.account_description,
      row.customer,
      row.customer_name,
      row.material,
      row.material_name,
      row.distribution_channel,
      row.distribution_channel_name,
      DATE(row.period_month),
      SAFE_CAST(row.amount_value AS FLOAT64),
      PARSE_JSON(row.source_payload_json),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItems(rows, 1200);
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await client.query({
        query,
        params: {
          uploadId,
          rows: chunk.map((row) => ({
            row_number: row.rowNumber,
            key_value: row.keyValue,
            bu: row.bu,
            channel: row.channel,
            fpna_code: row.fpnaCode,
            fpna_description: row.fpnaDescription,
            sales_group: row.salesGroup,
            profit_center: row.profitCenter,
            profit_center_name: row.profitCenterName,
            account: row.account,
            account_description: row.accountDescription,
            customer: row.customer,
            customer_name: row.customerName,
            material: row.material,
            material_name: row.materialName,
            distribution_channel: row.distributionChannel,
            distribution_channel_name: row.distributionChannelName,
            period_month: row.periodMonth,
            amount_value: String(row.amountValue),
            source_payload_json: JSON.stringify(row.payload),
          })),
        },
      });
    },
    4,
  );
}

async function loadCloseupStaging(uploadId: string, rows: CloseupNormalizedRow[]) {
  const client = getBigQueryClient();
  await ensureCloseupStagingSchema();

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_closeup\`
      WHERE upload_id IN (
        WITH current_upload AS (
          SELECT reporting_version_id, period_month
          FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
          WHERE upload_id = @uploadId
          LIMIT 1
        )
        SELECT u.upload_id
        FROM \`chiesi-committee.chiesi_committee_raw.uploads\` u
        JOIN current_upload c
          ON u.reporting_version_id = c.reporting_version_id
         AND u.period_month = c.period_month
        WHERE LOWER(TRIM(u.module_code)) IN ('business_excellence_closeup', 'closeup')
          AND u.upload_id != @uploadId
      )
    `,
    params: { uploadId },
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_closeup\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId },
  });

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_closeup\`
    (
      upload_id,
      row_number,
      product_closeup_raw,
      product_closeup_normalized,
      product_id,
      canonical_product_name,
      market_group,
      specialty,
      source_date_raw,
      source_date,
      period_raw,
      period_month,
      visited_source_raw,
      visited,
      recetas_value,
      source_payload_json,
      normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      row.product_closeup_raw,
      row.product_closeup_normalized,
      NULLIF(row.product_id, ''),
      NULLIF(row.canonical_product_name, ''),
      NULLIF(row.market_group, ''),
      row.specialty,
      row.source_date_raw,
      DATE(row.source_date),
      row.period_raw,
      DATE(row.period_month),
      row.visited_source_raw,
      row.visited,
      SAFE_CAST(row.recetas_value AS NUMERIC),
      PARSE_JSON('{}'),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItems(rows, 1500);
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await client.query({
        query,
        params: {
          uploadId,
          rows: chunk.map((row) => ({
            row_number: row.rowNumber,
            product_closeup_raw: row.productCloseupRaw,
            product_closeup_normalized: row.productCloseupNormalized,
            product_id: row.productId ?? '',
            canonical_product_name: row.canonicalProductName ?? '',
            market_group: row.marketGroup ?? '',
            specialty: row.specialty,
            source_date_raw: row.sourceDateRaw,
            source_date: row.sourceDate,
            period_raw: row.periodRaw ?? '',
            period_month: row.periodMonth,
            visited_source_raw: row.visitedSourceRaw ?? '',
            visited: row.visited,
            recetas_value: String(row.recetasValue),
          })),
        },
      });
    },
    4,
  );
}

async function loadPmmStaging(uploadId: string, rows: PmmNormalizedRow[]) {
  const client = getBigQueryClient();
  await client.query({
    query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_pmm\`
      ADD COLUMN IF NOT EXISTS brick STRING
    `,
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_pmm\`
      WHERE upload_id IN (
        WITH current_upload AS (
          SELECT
            reporting_version_id,
            period_month,
            COALESCE(
              NULLIF(TRIM(ddd_source), ''),
              CASE
                WHEN LOWER(source_file_name) LIKE '%innovair%' THEN 'innovair'
                WHEN LOWER(source_file_name) LIKE '%ribuspir%' THEN 'ribuspir'
                WHEN LOWER(source_file_name) LIKE '%rinoclenil%' THEN 'rinoclenil'
                ELSE 'unknown'
              END
            ) AS source_key
          FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
          WHERE upload_id = @uploadId
          LIMIT 1
        )
        SELECT u.upload_id
        FROM \`chiesi-committee.chiesi_committee_raw.uploads\` u
        JOIN current_upload c
          ON u.reporting_version_id = c.reporting_version_id
         AND u.period_month = c.period_month
         AND COALESCE(
           NULLIF(TRIM(u.ddd_source), ''),
           CASE
             WHEN LOWER(u.source_file_name) LIKE '%innovair%' THEN 'innovair'
             WHEN LOWER(u.source_file_name) LIKE '%ribuspir%' THEN 'ribuspir'
             WHEN LOWER(u.source_file_name) LIKE '%rinoclenil%' THEN 'rinoclenil'
             ELSE 'unknown'
           END
         ) = c.source_key
        WHERE LOWER(TRIM(u.module_code)) IN ('business_excellence_ddd', 'business_excellence_pmm', 'pmm', 'ddd')
          AND u.upload_id != @uploadId
      )
    `,
    params: { uploadId },
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_pmm\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId },
  });

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_pmm\`
    (
      upload_id,
      row_number,
      pack_des_raw,
      pack_des_normalized,
      product_id,
      canonical_product_name,
      market_group,
      brick,
      source_month_raw,
      source_year_raw,
      source_date,
      period_month,
      sales_group,
      amount_value,
      source_payload_json,
      normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      row.pack_des_raw,
      row.pack_des_normalized,
      NULLIF(row.product_id, ''),
      NULLIF(row.canonical_product_name, ''),
      NULLIF(row.market_group, ''),
      row.brick,
      row.source_month_raw,
      row.source_year_raw,
      DATE(row.source_date),
      DATE(row.period_month),
      row.sales_group,
      SAFE_CAST(row.amount_value AS NUMERIC),
      PARSE_JSON('{}'),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItems(rows, 1600);
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await client.query({
        query,
        params: {
          uploadId,
          rows: chunk.map((row) => ({
            row_number: row.rowNumber,
            pack_des_raw: row.packDesRaw,
            pack_des_normalized: row.packDesNormalized,
            product_id: row.productId ?? '',
            canonical_product_name: row.canonicalProductName ?? '',
            market_group: row.marketGroup ?? '',
            brick: row.brick,
            source_month_raw: row.sourceMonthRaw,
            source_year_raw: row.sourceYearRaw,
            source_date: row.sourceDate,
            period_month: row.periodMonth,
            sales_group: row.salesGroup,
            amount_value: String(row.amountValue),
          })),
        },
      });
    },
    4,
  );
}

async function loadSellOutStaging(uploadId: string, rows: SellOutNormalizedRow[]) {
  const client = getBigQueryClient();
  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_budget_sell_out\` (
        upload_id STRING,
        row_number INT64,
        source_product_raw STRING,
        source_product_normalized STRING,
        product_id STRING,
        canonical_product_name STRING,
        market_group STRING,
        channel STRING,
        period_month DATE,
        sales_group STRING,
        amount_value NUMERIC,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_budget_sell_out\`
      WHERE upload_id IN (
        WITH current_upload AS (
          SELECT
            reporting_version_id,
            period_month,
            COALESCE(
              NULLIF(TRIM(ddd_source), ''),
              CASE
                WHEN LOWER(source_file_name) LIKE '%privado%' THEN 'privado'
                WHEN LOWER(source_file_name) LIKE '%gobierno%' THEN 'gobierno'
                ELSE 'unknown'
              END
            ) AS source_key
          FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
          WHERE upload_id = @uploadId
          LIMIT 1
        )
        SELECT u.upload_id
        FROM \`chiesi-committee.chiesi_committee_raw.uploads\` u
        JOIN current_upload c
          ON u.reporting_version_id = c.reporting_version_id
         AND u.period_month = c.period_month
         AND COALESCE(
           NULLIF(TRIM(u.ddd_source), ''),
           CASE
             WHEN LOWER(u.source_file_name) LIKE '%privado%' THEN 'privado'
             WHEN LOWER(u.source_file_name) LIKE '%gobierno%' THEN 'gobierno'
             ELSE 'unknown'
           END
         ) = c.source_key
        WHERE LOWER(TRIM(u.module_code)) IN (
          'business_excellence_budget_sell_out',
          'business_excellence_sell_out',
          'sell_out'
        )
          AND u.upload_id != @uploadId
      )
    `,
    params: { uploadId },
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_budget_sell_out\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId },
  });

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_budget_sell_out\`
    (
      upload_id,
      row_number,
      source_product_raw,
      source_product_normalized,
      product_id,
      canonical_product_name,
      market_group,
      channel,
      period_month,
      sales_group,
      amount_value,
      source_payload_json,
      normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      row.source_product_raw,
      row.source_product_normalized,
      NULLIF(row.product_id, ''),
      NULLIF(row.canonical_product_name, ''),
      NULLIF(row.market_group, ''),
      row.channel,
      DATE(row.period_month),
      row.sales_group,
      SAFE_CAST(row.amount_value AS NUMERIC),
      PARSE_JSON(row.source_payload_json),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItems(rows, 1800);
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await client.query({
        query,
        params: {
          uploadId,
          rows: chunk.map((row) => ({
            row_number: row.rowNumber,
            source_product_raw: row.sourceProductRaw,
            source_product_normalized: row.sourceProductNormalized,
            product_id: row.productId ?? '',
            canonical_product_name: row.canonicalProductName ?? '',
            market_group: row.marketGroup ?? '',
            channel: row.channel,
            period_month: row.periodMonth,
            sales_group: row.salesGroup,
            amount_value: String(row.amountValue),
            source_payload_json: JSON.stringify(row.payload),
          })),
        },
      });
    },
    4,
  );
}

async function loadBrickAssignmentStaging(uploadId: string, rows: BrickAssignmentNormalizedRow[]) {
  const client = getBigQueryClient();

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_brick_assignment\` (
        upload_id STRING,
        row_number INT64,
        brick_code STRING,
        brick_description STRING,
        state STRING,
        category STRING,
        district STRING,
        territory_id STRING,
        manager STRING,
        territory STRING,
        visited BOOL,
        period_month DATE,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_brick_assignment\`
      WHERE upload_id IN (
        WITH current_upload AS (
          SELECT reporting_version_id, period_month
          FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
          WHERE upload_id = @uploadId
          LIMIT 1
        )
        SELECT u.upload_id
        FROM \`chiesi-committee.chiesi_committee_raw.uploads\` u
        JOIN current_upload c
          ON u.reporting_version_id = c.reporting_version_id
         AND u.period_month = c.period_month
        WHERE LOWER(TRIM(u.module_code)) IN (
          'business_excellence_brick_assignment',
          'business_excellence_bricks_visited',
          'bricks_visited'
        )
          AND u.upload_id != @uploadId
      )
    `,
    params: { uploadId },
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_brick_assignment\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId },
  });

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_brick_assignment\`
    (
      upload_id,
      row_number,
      brick_code,
      brick_description,
      state,
      category,
      district,
      territory_id,
      manager,
      territory,
      visited,
      period_month,
      source_payload_json,
      normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      row.brick_code,
      row.brick_description,
      row.state,
      row.category,
      row.district,
      row.territory_id,
      row.manager,
      row.territory,
      row.visited,
      DATE(row.period_month),
      PARSE_JSON('{}'),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItems(rows, 1800);
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await client.query({
        query,
        params: {
          uploadId,
          rows: chunk.map((row) => ({
            row_number: row.rowNumber,
            brick_code: row.brickCode,
            brick_description: row.brickDescription,
            state: row.state,
            category: row.category,
            district: row.district,
            territory_id: row.territoryId,
            manager: row.manager,
            territory: row.territory,
            visited: row.visited,
            period_month: row.periodMonth,
          })),
        },
      });
    },
    4,
  );
}

function normalizeSalesInternal(rows: RawUploadRow[]) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: SalesInternalNormalizedRow[] = [];

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);
    const monthlyValues = extractMonthlyValues(payload);
    const errors: string[] = [];

    const rowHasBusinessContent = hasBusinessContent(payload);

    // Trailing rows with only null/whitespace should be ignored, not marked as errors.
    if (!rowHasBusinessContent) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'valid',
        errors: [],
      });
      continue;
    }

    const keyValue = asNullableString(pickValue(index, ['Key']));
    const fpnaCode = asNullableString(pickValue(index, ['Code for FP&A', 'Code for FPA']));
    const fpnaDescription = asNullableString(
      pickValue(index, ['Description for FP&A', 'Description for FPA']),
    );

    if (!keyValue) {
      errors.push('Missing required column: Key.');
    }

    if (!fpnaCode && !fpnaDescription) {
      errors.push('Missing required FP&A identifier (Code/Description).');
    }

    if (monthlyValues.length === 0) {
      errors.push('No monthly columns detected (e.g. January 2026).');
    }

    const validMonthlyValues = monthlyValues.filter((item) => item.amountValue != null) as Array<{
      periodMonth: string;
      amountValue: number;
    }>;

    if (validMonthlyValues.length === 0) {
      errors.push('No numeric monthly values found.');
    }

    const status: RowValidationResult['validationStatus'] = errors.length > 0 ? 'error' : 'valid';
    validations.push({
      rowNumber: row.row_number,
      validationStatus: status,
      errors,
    });

    if (status === 'error') continue;

    const baseData = {
      rowNumber: row.row_number,
      keyValue,
      bu: asNullableString(pickValue(index, ['BU'])),
      channel: asNullableString(pickValue(index, ['Channel'])),
      fpnaCode,
      fpnaDescription,
      salesGroup: asNullableString(pickValue(index, ['Sales Group'])),
      profitCenter: asNullableString(pickValue(index, ['Profit Center'])),
      profitCenterName: asNullableString(pickValue(index, ['Profit Center name'])),
      account: asNullableString(pickValue(index, ['Account'])),
      accountDescription: asNullableString(pickValue(index, ['Account Description'])),
      customer: asNullableString(pickValue(index, ['Customer'])),
      customerName: asNullableString(pickValue(index, ['Customer Name'])),
      material: asNullableString(pickValue(index, ['Material'])),
      materialName: asNullableString(pickValue(index, ['Material name'])),
      distributionChannel: asNullableString(pickValue(index, ['Distribution Channel'])),
      distributionChannelName: asNullableString(pickValue(index, ['Distribution Channel name'])),
      payload,
    };

    for (const monthValue of validMonthlyValues) {
      normalizedRows.push({
        ...baseData,
        periodMonth: monthValue.periodMonth,
        amountValue: monthValue.amountValue,
      });
    }
  }

  return { validations, normalizedRows };
}

async function normalizeBusinessExcellenceCloseup(rows: RawUploadRow[]) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: CloseupNormalizedRow[] = [];

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);
    const errors: string[] = [];

    if (!hasBusinessContent(payload)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'valid',
        errors: [],
      });
      continue;
    }

    const productRaw = asNullableString(
      pickValue(index, [
        'Producto',
        'Product',
        'producto_closeup',
        'PRODUCTO_NAME',
        'Producto Name',
      ]),
    );

    const rawDateValue = pickValue(index, ['Date', 'Fecha']);
    const parsedSourceDate = parseDateField(rawDateValue);
    const rawPeriodValue = pickValue(index, ['Period', 'Periodo', 'Month', 'Mes']);
    const parsedPeriodLabelMonth = parseCloseupPeriodField(rawPeriodValue);
    const parsedPeriodMonth = parsedSourceDate ?? parsedPeriodLabelMonth;
    const recetasValue = asNullableNumber(
      pickValue(index, ['Recetas', 'Receta', 'Rx', 'Prescripciones']),
    );
    const specialty = asNullableString(
      pickValue(index, ['Especialidad', 'Especilidad', 'Specialty']),
    );
    const visitedSourceRaw = asNullableString(
      pickValue(index, ['Visitado en ficheros', 'Visitado', 'Visited', 'Territory', 'Territorio']),
    );

    if (!productRaw) {
      errors.push('Missing required closeup product column (Producto/Product).');
    }
    if (!parsedPeriodMonth) {
      errors.push('Unable to parse Closeup prescription period. Expected Date/Fecha, with Period/Month as fallback.');
    }
    if (recetasValue == null) {
      errors.push('Missing numeric recetas value.');
    }

    const status: RowValidationResult['validationStatus'] = errors.length > 0 ? 'error' : 'valid';

    validations.push({
      rowNumber: row.row_number,
      validationStatus: status,
      errors,
    });

    if (status === 'error') continue;

    normalizedRows.push({
      rowNumber: row.row_number,
      productCloseupRaw: productRaw!,
      productCloseupNormalized: normalizeText(productRaw!),
      productId: null,
      canonicalProductName: null,
      marketGroup: null,
      specialty,
      sourceDateRaw: rawDateValue == null ? null : String(rawDateValue),
      sourceDate: parsedSourceDate ?? parsedPeriodMonth!,
      periodRaw: rawPeriodValue == null ? null : String(rawPeriodValue),
      periodMonth: parsedPeriodMonth!,
      visitedSourceRaw,
      visited: deriveVisitedFromTerritory(visitedSourceRaw),
      recetasValue: recetasValue!,
    });
  }

  return { validations, normalizedRows };
}

async function normalizeBusinessExcellencePmm(
  rows: RawUploadRow[],
  asOfMonth: string | null,
) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: PmmNormalizedRow[] = [];
  const effectiveAsOfMonth = asOfMonth && /^\d{4}-\d{2}-01$/.test(asOfMonth) ? asOfMonth : null;
  const minIncludedMonth = effectiveAsOfMonth ? shiftMonths(effectiveAsOfMonth, -23) : null;

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);
    const errors: string[] = [];

    if (!hasBusinessContent(payload)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'valid',
        errors: [],
      });
      continue;
    }

    const packDesRaw = asNullableString(
      pickValue(index, [
        'PACK_DES',
        'pack_des',
        'Pack Description',
        'Producto',
        'Product',
      ]),
    );
    const monthRaw = pickValue(index, ['MONTH', 'Month', 'MES', 'Mes']);
    const yearRaw = pickValue(index, ['YEAR', 'Year', 'ANO', 'AÃ‘O', 'Anio']);
    const brick = asNullableString(
      pickValue(index, ['BRICK_COD', 'BRICK', 'Brick', 'BRICK_DES']),
    );
    const parsedPeriodMonth = parseMonthYearField(monthRaw, yearRaw);
    const unitsValue = asNullableNumber(pickValue(index, ['UN', 'Units', 'UNITS']));
    const netSalesValue = asNullableNumber(pickValue(index, ['LC', 'Local Currency', 'NET_SALES']));

    if (!packDesRaw) {
      errors.push('Missing required PMM product column (PACK_DES).');
    }
    if (!parsedPeriodMonth) {
      errors.push('Unable to parse PMM MONTH/YEAR values.');
    }
    if (unitsValue == null && netSalesValue == null) {
      errors.push('No numeric PMM values found (UN/LC).');
    }

    if (
      parsedPeriodMonth &&
      effectiveAsOfMonth &&
      minIncludedMonth &&
      (parsedPeriodMonth < minIncludedMonth || parsedPeriodMonth > effectiveAsOfMonth)
    ) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: [
          `Skipped: outside 24-month window (${minIncludedMonth} to ${effectiveAsOfMonth}).`,
        ],
      });
      continue;
    }

    const status: RowValidationResult['validationStatus'] = errors.length > 0 ? 'error' : 'valid';
    validations.push({
      rowNumber: row.row_number,
      validationStatus: status,
      errors,
    });

    if (status === 'error') continue;

    const baseRow = {
      rowNumber: row.row_number,
      packDesRaw: packDesRaw!,
      packDesNormalized: normalizeText(packDesRaw!),
      productId: null,
      canonicalProductName: null,
      marketGroup: null,
      brick,
      sourceMonthRaw: monthRaw == null ? null : String(monthRaw),
      sourceYearRaw: yearRaw == null ? null : String(yearRaw),
      sourceDate: parsedPeriodMonth!,
      periodMonth: parsedPeriodMonth!,
    };

    if (unitsValue != null) {
      normalizedRows.push({
        ...baseRow,
        salesGroup: 'Units',
        amountValue: unitsValue,
      });
    }

    if (netSalesValue != null) {
      normalizedRows.push({
        ...baseRow,
        salesGroup: 'Net Sales',
        amountValue: netSalesValue,
      });
    }
  }

  return { validations, normalizedRows };
}

async function normalizeBusinessExcellenceSellOut(
  rows: RawUploadRow[],
  _asOfMonth: string | null,
  sourceTag: string | null,
) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: SellOutNormalizedRow[] = [];
  const dedupedByProductPeriod = new Map<string, SellOutNormalizedRow>();

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);
    const errors: string[] = [];
    const dateValue = pickValue(index, ['Date', 'DATE', 'Fecha', 'Period', 'Periodo']);
    const parsedPeriodMonth = parseDateFieldMonthFirst(dateValue);

    if (!hasBusinessContent(payload)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'valid',
        errors: [],
      });
      continue;
    }

    if (!parsedPeriodMonth) {
      errors.push('Unable to parse Sell Out period date.');
    }

    const numericCells = Object.entries(payload)
      .filter(([key]) => {
        const normalizedKey = normalizeKey(key);
        const trimmedKey = key.trim();
        if (['date', 'fecha', 'period', 'periodo'].includes(normalizedKey)) return false;
        if (normalizedKey.includes('date') || normalizedKey.includes('fecha')) return false;
        if (parseDateField(trimmedKey)) return false;
        return !normalizedKey.startsWith('column');
      })
      .map(([key, value]) => ({
        sourceProductRaw: key.trim(),
        amountValue: asNullableNumber(value),
      }))
      .filter((item) => item.sourceProductRaw && item.amountValue != null);

    if (numericCells.length === 0) {
      errors.push('No numeric product columns detected in Sell Out row.');
    }

    const status: RowValidationResult['validationStatus'] = errors.length > 0 ? 'error' : 'valid';
    validations.push({
      rowNumber: row.row_number,
      validationStatus: status,
      errors,
    });

    if (status === 'error') continue;

    for (const cell of numericCells) {
      const normalizedKey = normalizeText(cell.sourceProductRaw);
      const dedupKey = [
        parsedPeriodMonth!,
        sourceTag ?? '',
        'Units',
        normalizedKey,
      ].join('|||');
      const existing = dedupedByProductPeriod.get(dedupKey);
      if (existing) {
        existing.amountValue += cell.amountValue!;
        continue;
      }

      dedupedByProductPeriod.set(dedupKey, {
        rowNumber: row.row_number,
        sourceProductRaw: cell.sourceProductRaw,
        sourceProductNormalized: normalizedKey,
        productId: null,
        canonicalProductName: null,
        marketGroup: null,
        channel: sourceTag,
        periodMonth: parsedPeriodMonth!,
        salesGroup: 'Units',
        amountValue: cell.amountValue!,
        payload,
      });
    }
  }

  normalizedRows.push(...dedupedByProductPeriod.values());
  return { validations, normalizedRows };
}

function normalizeBusinessExcellenceBrickAssignment(
  rows: RawUploadRow[],
  periodMonth: string | null,
) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: BrickAssignmentNormalizedRow[] = [];
  const effectivePeriodMonth =
    periodMonth && /^\d{4}-\d{2}-01$/.test(periodMonth) ? periodMonth : '1970-01-01';

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);
    const errors: string[] = [];

    if (!hasBusinessContent(payload)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'valid',
        errors: [],
      });
      continue;
    }

    const brickCode = asNullableString(
      pickValue(index, ['BRICK_COD', 'BRICK_CODIGO', 'BRICK', 'ID BRICK', 'Brick']),
    );
    const territory = asNullableString(
      pickValue(index, ['TERRITORY', 'Territory', 'Territorio', 'REFERENCIA', 'PRIORIDAD']),
    );
    const brickDescription = asNullableString(
      pickValue(index, ['BRICK_DES', 'BRICK _DES', 'BRICK_DESCRIPCION', 'Brick Description']),
    );
    const state = asNullableString(pickValue(index, ['STATE', 'Estado']));
    const category = asNullableString(pickValue(index, ['CATEGORY', 'Categoria', 'Categoría']));
    const district = asNullableString(pickValue(index, ['DISTRICT', 'Distrito']));
    const territoryId = asNullableString(
      pickValue(index, ['ID TERRITORY', 'ID_TERRITORY', 'TERRITORY_ID']),
    );
    const manager = asNullableString(pickValue(index, ['MANAGER', 'Manager', 'Gerente']));

    if (!brickCode) {
      errors.push('Missing required BRICK_COD column.');
    }
    if (!territory) {
      errors.push('Missing required TERRITORY column.');
    }

    const status: RowValidationResult['validationStatus'] = errors.length > 0 ? 'error' : 'valid';
    validations.push({
      rowNumber: row.row_number,
      validationStatus: status,
      errors,
    });

    if (status === 'error') continue;

    normalizedRows.push({
      rowNumber: row.row_number,
      brickCode: brickCode!,
      brickDescription,
      state,
      category,
      district,
      territoryId,
      manager,
      territory,
      visited: deriveVisitedFromTerritory(territory),
      periodMonth: effectivePeriodMonth,
    });
  }

  return { validations, normalizedRows };
}

function normalizeBusinessExcellenceWeeklyTracking(
  rows: RawUploadRow[],
  asOfMonth: string | null,
) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: WeeklyTrackingNormalizedRow[] = [];
  const effectiveAsOfMonth = asOfMonth && /^\d{4}-\d{2}-01$/.test(asOfMonth) ? asOfMonth : null;
  const minIncludedMonth = effectiveAsOfMonth ? shiftMonths(effectiveAsOfMonth, -23) : null;

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);
    const weekValue = pickValue(index, ['Week', 'WEEK', 'Date', 'Fecha', 'DATE', 'Period', 'Periodo']);
    const periodMonth = parseWeeklyPeriodField(weekValue);
    const weekRaw = asNullableString(weekValue);
    const unitsValue = asNullableNumber(pickValue(index, ['Un', 'UN', 'Units']));
    const netSalesValue = asNullableNumber(pickValue(index, ['Lc', 'LC', 'Net Sales', 'NetSales']));
    const errors: string[] = [];

    if (!periodMonth) {
      errors.push('Missing or invalid Week column.');
    }
    if (unitsValue == null && netSalesValue == null) {
      errors.push('Missing numeric UN/LC values.');
    }

    if (
      periodMonth &&
      effectiveAsOfMonth &&
      minIncludedMonth &&
      (periodMonth < minIncludedMonth || periodMonth > effectiveAsOfMonth)
    ) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: [
          `Skipped: outside 24-month window (${minIncludedMonth} to ${effectiveAsOfMonth}).`,
        ],
      });
      continue;
    }

    const status: RowValidationResult['validationStatus'] = errors.length > 0 ? 'error' : 'valid';
    validations.push({
      rowNumber: row.row_number,
      validationStatus: status,
      errors,
    });

    if (status === 'error') continue;
    const base = {
      rowNumber: row.row_number,
      weekRaw,
      periodMonth: periodMonth!,
      brickCode: asNullableString(pickValue(index, ['BRICK_COD', 'Brick Cod', 'BrickCode'])),
      brickDescription: asNullableString(pickValue(index, ['BRICK_DES', 'Brick Des', 'Brick Description'])),
      prodDes: asNullableString(pickValue(index, ['PROD_DES', 'Prod Des'])),
      prodCode: asNullableString(pickValue(index, ['PRODCODE', 'ProdCode', 'Prod Code'])),
      packDes: asNullableString(pickValue(index, ['PACK_DES', 'Pack Des'])),
      atcivCode: asNullableString(pickValue(index, ['ATCIV_CODE', 'Atciv Code'])),
      atcivDesc: asNullableString(pickValue(index, ['ATCIV_DESC', 'Atciv Desc'])),
      packCode: asNullableString(pickValue(index, ['PACKCODE', 'Pack Code'])),
      marketCode: asNullableString(pickValue(index, ['MKT_COD', 'Mkt Cod', 'Market Code'])),
      payload,
    };

    if (unitsValue != null) {
      normalizedRows.push({
        ...base,
        salesGroup: 'Units',
        amountValue: unitsValue,
      });
    }
    if (netSalesValue != null) {
      normalizedRows.push({
        ...base,
        salesGroup: 'Net Sales',
        amountValue: netSalesValue,
      });
    }
  }

  return { validations, normalizedRows };
}

async function loadWeeklyTrackingStaging(uploadId: string, rows: WeeklyTrackingNormalizedRow[]) {
  const client = getBigQueryClient();

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_weekly_tracking\` (
        upload_id STRING,
        row_number INT64,
        week_raw STRING,
        period_month DATE,
        brick_code STRING,
        brick_description STRING,
        prod_des STRING,
        prod_code STRING,
        pack_des STRING,
        atciv_code STRING,
        atciv_desc STRING,
        pack_code STRING,
        market_code STRING,
        sales_group STRING,
        amount_value NUMERIC,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_weekly_tracking\`
      WHERE upload_id IN (
        WITH current_upload AS (
          SELECT reporting_version_id, period_month
          FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
          WHERE upload_id = @uploadId
          LIMIT 1
        )
        SELECT u.upload_id
        FROM \`chiesi-committee.chiesi_committee_raw.uploads\` u
        JOIN current_upload c
          ON u.reporting_version_id = c.reporting_version_id
         AND u.period_month = c.period_month
        WHERE LOWER(TRIM(u.module_code)) IN (
          'business_excellence_iqvia_weekly',
          'business_excellence_weekly_tracking',
          'iqvia_weekly',
          'weekly_tracking'
        )
          AND u.upload_id != @uploadId
      )
    `,
    params: { uploadId },
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_weekly_tracking\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId },
  });

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_weekly_tracking\`
    (
      upload_id,
      row_number,
      week_raw,
      period_month,
      brick_code,
      brick_description,
      prod_des,
      prod_code,
      pack_des,
      atciv_code,
      atciv_desc,
      pack_code,
      market_code,
      sales_group,
      amount_value,
      source_payload_json,
      normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      row.week_raw,
      DATE(row.period_month),
      NULLIF(row.brick_code, ''),
      NULLIF(row.brick_description, ''),
      NULLIF(row.prod_des, ''),
      NULLIF(row.prod_code, ''),
      NULLIF(row.pack_des, ''),
      NULLIF(row.atciv_code, ''),
      NULLIF(row.atciv_desc, ''),
      NULLIF(row.pack_code, ''),
      NULLIF(row.market_code, ''),
      row.sales_group,
      SAFE_CAST(row.amount_value AS NUMERIC),
      PARSE_JSON(row.source_payload_json),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItems(rows, 1800);
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await client.query({
        query,
        params: {
          uploadId,
          rows: chunk.map((row) => ({
            row_number: row.rowNumber,
            week_raw: row.weekRaw,
            period_month: row.periodMonth,
            brick_code: row.brickCode ?? '',
            brick_description: row.brickDescription ?? '',
            prod_des: row.prodDes ?? '',
            prod_code: row.prodCode ?? '',
            pack_des: row.packDes ?? '',
            atciv_code: row.atcivCode ?? '',
            atciv_desc: row.atcivDesc ?? '',
            pack_code: row.packCode ?? '',
            market_code: row.marketCode ?? '',
            sales_group: row.salesGroup,
            amount_value: String(row.amountValue),
            source_payload_json: JSON.stringify(row.payload),
          })),
        },
      });
    },
    4,
  );
}

function detectHumanResourcesArea(payload: Record<string, unknown>) {
  const index = buildPayloadIndex(payload);
  const area = asNullableString(
    pickValue(index, ['Area', 'AREA', 'Business Unit', 'BU', 'Departamento', 'Department', 'Equipo']),
  );
  return area;
}

function detectHumanResourcesPeriodMonth(payload: Record<string, unknown>, asOfMonth: string | null) {
  const index = buildPayloadIndex(payload);
  const direct = pickValue(index, ['Date', 'DATE', 'Fecha', 'FECHA', 'Period', 'Periodo', 'Month', 'Mes']);
  const parsedDirect = parseDateFieldMonthFirst(direct) ?? parseDateField(direct);
  if (parsedDirect) return parsedDirect;

  const parsedMonthYear = parseMonthYearField(
    pickValue(index, ['Month', 'Mes']),
    pickValue(index, ['Year', 'Año', 'Ano']),
  );
  if (parsedMonthYear) return parsedMonthYear;

  return asOfMonth;
}

function detectHumanResourcesMetricValue(payload: Record<string, unknown>, metricType: 'turnover' | 'training') {
  const index = buildPayloadIndex(payload);
  const preferred = metricType === 'turnover'
    ? ['Turnover', 'Rotacion', 'Rotación', 'Attrition', 'Rotation']
    : ['Training', 'Entrenamiento', 'Capacitacion', 'Capacitación', 'Hours', 'Horas'];

  const preferredValue = asNullableNumber(pickValue(index, preferred));
  if (preferredValue != null) return preferredValue;

  for (const value of Object.values(payload)) {
    const numeric = asNullableNumber(value);
    if (numeric != null) return numeric;
  }
  return null;
}

function normalizeHumanResourcesMetric(
  rows: RawUploadRow[],
  asOfMonth: string | null,
  metricType: 'turnover' | 'training',
) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: HumanResourcesMetricNormalizedRow[] = [];

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);

    if (!hasBusinessContent(payload)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: empty row payload.'],
      });
      continue;
    }

    const periodMonth = detectHumanResourcesPeriodMonth(payload, asOfMonth);
    if (!periodMonth) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: period not detected.'],
      });
      continue;
    }

    const metricValue = detectHumanResourcesMetricValue(payload, metricType);
    if (metricValue == null) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: [`Skipped: ${metricType} metric value not detected.`],
      });
      continue;
    }

    validations.push({
      rowNumber: row.row_number,
      validationStatus: 'valid',
      errors: [],
    });

    normalizedRows.push({
      rowNumber: row.row_number,
      metricType,
      area: detectHumanResourcesArea(payload),
      periodMonth,
      metricValue,
      payload,
    });
  }

  return { validations, normalizedRows };
}

async function loadHumanResourcesMetricStaging(uploadId: string, rows: HumanResourcesMetricNormalizedRow[]) {
  const client = getBigQueryClient();

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_human_resources_metrics\` (
        upload_id STRING,
        row_number INT64,
        metric_type STRING,
        area STRING,
        period_month DATE,
        metric_value NUMERIC,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_human_resources_metrics\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId },
  });

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_human_resources_metrics\`
    (
      upload_id,
      row_number,
      metric_type,
      area,
      period_month,
      metric_value,
      source_payload_json,
      normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      row.metric_type,
      NULLIF(row.area, ''),
      DATE(row.period_month),
      SAFE_CAST(row.metric_value AS NUMERIC),
      PARSE_JSON(row.source_payload_json),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItems(rows, 1800);
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await client.query({
        query,
        params: {
          uploadId,
          rows: chunk.map((row) => ({
            row_number: row.rowNumber,
            metric_type: row.metricType,
            area: row.area ?? '',
            period_month: row.periodMonth,
            metric_value: String(row.metricValue),
            source_payload_json: JSON.stringify(row.payload),
          })),
        },
      });
    },
    4,
  );
}

function normalizeHumanResourcesTurnover(
  rows: RawUploadRow[],
  asOfMonth: string | null,
) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: HumanResourcesTurnoverNormalizedRow[] = [];

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);

    if (!hasBusinessContent(payload)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: empty row payload.'],
      });
      continue;
    }

    const lastWorkingDayMonth = parseDateFieldMonthFirst(
      pickValue(index, ['Last Working day', 'Last Working Day', 'Last day', 'Termination Date']),
    );
    const hiringDateMonth = parseDateFieldMonthFirst(
      pickValue(index, ['Hiring date', 'Hiring Date', 'Hire Date']),
    );
    const periodMonth = lastWorkingDayMonth ?? hiringDateMonth ?? asOfMonth;

    if (!periodMonth) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: period not detected from Last Working day / Hiring date / as_of_month.'],
      });
      continue;
    }

    const department = asNullableString(pickValue(index, ['DEPARTMENT', 'Department']));
    const positionName = asNullableString(pickValue(index, ['Position Name', 'Position']));
    const lastName = asNullableString(pickValue(index, ['Last Name', 'Apellido']));
    const firstName = asNullableString(pickValue(index, ['First Name', 'Nombre']));

    if (!department && !positionName && !lastName && !firstName) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: no turnover business columns detected.'],
      });
      continue;
    }

    validations.push({
      rowNumber: row.row_number,
      validationStatus: 'valid',
      errors: [],
    });

    normalizedRows.push({
      rowNumber: row.row_number,
      periodMonth,
      volNonVol: asNullableString(pickValue(index, ['Vol/NonVol', 'Vol NonVol', 'Voluntary', 'Involuntary'])),
      lastName,
      firstName,
      positionName,
      department,
      territory: asNullableString(pickValue(index, ['TERRITORY', 'Territory'])),
      manager: asNullableString(pickValue(index, ['MANAGER', 'Manager'])),
      salary: asNullableNumber(pickValue(index, ['SALARY', 'Salary'])),
      salaryBands: asNullableString(pickValue(index, ['SALARY BANDS', 'Salary Bands'])),
      salaryBandsPct: asNullableNumber(pickValue(index, ['SALARY BANDS %', 'Salary Bands %'])),
      internalOrExternal: asNullableString(pickValue(index, ['Internal Or External', 'Internal/External'])),
      keyPeople: asNullableString(pickValue(index, ['KEY PEOPLE?', 'Key People'])),
      keyPosition: asNullableString(pickValue(index, ['KEY POSITION', 'Key Position'])),
      hiringDateMonth,
      lastWorkingDayMonth,
      quarter: asNullableString(pickValue(index, ['Quarter', 'QUARTER'])),
      year: asNullableNumber(pickValue(index, ['YEAR', 'Year'])),
      years: asNullableNumber(pickValue(index, ['Years', 'YEARS'])),
      seniorityCluster: asNullableString(pickValue(index, ['Seniority Cluster', 'SENIORITY CLUSTER'])),
      ageAsOfDate: asNullableNumber(pickValue(index, ['Age (as of Date)', 'Age'])),
      seniority: asNullableNumber(pickValue(index, ['Seniority', 'SENIORITY'])),
      gender: asNullableString(pickValue(index, ['Gender', 'GENDER'])),
      grade: asNullableString(pickValue(index, ['Grade', 'GRADE'])),
      terminationAdRationale: asNullableString(pickValue(index, ['Termination Ad. Rationale', 'Termination Rationale'])),
      payload,
    });
  }

  return { validations, normalizedRows };
}

async function loadHumanResourcesTurnoverStaging(
  uploadId: string,
  rows: HumanResourcesTurnoverNormalizedRow[],
) {
  const client = getBigQueryClient();

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_human_resources_turnover\` (
        upload_id STRING,
        row_number INT64,
        period_month DATE,
        vol_non_vol STRING,
        last_name STRING,
        first_name STRING,
        position_name STRING,
        department STRING,
        territory STRING,
        manager STRING,
        salary NUMERIC,
        salary_bands STRING,
        salary_bands_pct NUMERIC,
        internal_or_external STRING,
        key_people STRING,
        key_position STRING,
        hiring_date_month DATE,
        last_working_day_month DATE,
        quarter STRING,
        year INT64,
        years NUMERIC,
        seniority_cluster STRING,
        age_as_of_date NUMERIC,
        seniority NUMERIC,
        gender STRING,
        grade STRING,
        termination_ad_rationale STRING,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_human_resources_turnover\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId },
  });

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_human_resources_turnover\`
    (
      upload_id, row_number, period_month, vol_non_vol, last_name, first_name, position_name, department,
      territory, manager, salary, salary_bands, salary_bands_pct, internal_or_external, key_people, key_position,
      hiring_date_month, last_working_day_month, quarter, year, years, seniority_cluster, age_as_of_date, seniority,
      gender, grade, termination_ad_rationale, source_payload_json, normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      DATE(row.period_month),
      NULLIF(row.vol_non_vol, ''),
      NULLIF(row.last_name, ''),
      NULLIF(row.first_name, ''),
      NULLIF(row.position_name, ''),
      NULLIF(row.department, ''),
      NULLIF(row.territory, ''),
      NULLIF(row.manager, ''),
      SAFE_CAST(row.salary AS NUMERIC),
      NULLIF(row.salary_bands, ''),
      SAFE_CAST(row.salary_bands_pct AS NUMERIC),
      NULLIF(row.internal_or_external, ''),
      NULLIF(row.key_people, ''),
      NULLIF(row.key_position, ''),
      IF(row.hiring_date_month = '', NULL, DATE(row.hiring_date_month)),
      IF(row.last_working_day_month = '', NULL, DATE(row.last_working_day_month)),
      NULLIF(row.quarter, ''),
      SAFE_CAST(row.year AS INT64),
      SAFE_CAST(row.years AS NUMERIC),
      NULLIF(row.seniority_cluster, ''),
      SAFE_CAST(row.age_as_of_date AS NUMERIC),
      SAFE_CAST(row.seniority AS NUMERIC),
      NULLIF(row.gender, ''),
      NULLIF(row.grade, ''),
      NULLIF(row.termination_ad_rationale, ''),
      PARSE_JSON(row.source_payload_json),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItems(rows, 1500);
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await client.query({
        query,
        params: {
          uploadId,
          rows: chunk.map((row) => ({
            row_number: row.rowNumber,
            period_month: row.periodMonth,
            vol_non_vol: row.volNonVol ?? '',
            last_name: row.lastName ?? '',
            first_name: row.firstName ?? '',
            position_name: row.positionName ?? '',
            department: row.department ?? '',
            territory: row.territory ?? '',
            manager: row.manager ?? '',
            salary: row.salary == null ? '' : String(row.salary),
            salary_bands: row.salaryBands ?? '',
            salary_bands_pct: row.salaryBandsPct == null ? '' : String(row.salaryBandsPct),
            internal_or_external: row.internalOrExternal ?? '',
            key_people: row.keyPeople ?? '',
            key_position: row.keyPosition ?? '',
            hiring_date_month: row.hiringDateMonth ?? '',
            last_working_day_month: row.lastWorkingDayMonth ?? '',
            quarter: row.quarter ?? '',
            year: row.year == null ? '' : String(row.year),
            years: row.years == null ? '' : String(row.years),
            seniority_cluster: row.seniorityCluster ?? '',
            age_as_of_date: row.ageAsOfDate == null ? '' : String(row.ageAsOfDate),
            seniority: row.seniority == null ? '' : String(row.seniority),
            gender: row.gender ?? '',
            grade: row.grade ?? '',
            termination_ad_rationale: row.terminationAdRationale ?? '',
            source_payload_json: JSON.stringify(row.payload),
          })),
        },
      });
    },
    4,
  );
}

function normalizeHumanResourcesTraining(
  rows: RawUploadRow[],
  asOfMonth: string | null,
) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: HumanResourcesTrainingNormalizedRow[] = [];

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);

    if (!hasBusinessContent(payload)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: empty row payload.'],
      });
      continue;
    }

    const completionDateMonth = parseDateFieldMonthFirst(
      pickValue(index, ['Completion Date', 'CompletionDate']),
    );
    const itemRevisionDateMonth = parseDateFieldMonthFirst(
      pickValue(index, ['Item Revision Date', 'Revision Date']),
    );
    const lastUpdateTimeMonth = parseDateFieldMonthFirst(
      pickValue(index, ['Last Update Time', 'LastUpdateTime']),
    );
    const periodMonth = completionDateMonth ?? itemRevisionDateMonth ?? lastUpdateTimeMonth ?? asOfMonth;

    if (!periodMonth) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: period not detected from Completion/Revision/Update dates.'],
      });
      continue;
    }

    const firstName = asNullableString(pickValue(index, ['First Name', 'FirstName']));
    const lastName = asNullableString(pickValue(index, ['Last Name', 'LastName']));
    const entityTitle = asNullableString(pickValue(index, ['Entity Title', 'Course Title']));
    const completionStatus = asNullableString(
      pickValue(index, ['Completion Status', 'Status']),
    );

    if (!firstName && !lastName && !entityTitle && !completionStatus) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: no training business columns detected.'],
      });
      continue;
    }

    validations.push({
      rowNumber: row.row_number,
      validationStatus: 'valid',
      errors: [],
    });

    normalizedRows.push({
      rowNumber: row.row_number,
      periodMonth,
      userName: asNullableString(pickValue(index, ['User'])),
      activeUser: asNullableString(pickValue(index, ['Active User', 'ActiveUser'])),
      firstName,
      lastName,
      middleName: asNullableString(pickValue(index, ['Middle Name', 'MiddleName'])),
      entityId: asNullableString(pickValue(index, ['Entity ID', 'EntityID'])),
      itemType: asNullableString(pickValue(index, ['Item Type', 'ItemType'])),
      entityType: asNullableString(pickValue(index, ['Entity Type', 'EntityType'])),
      itemRevisionDateMonth,
      revisionNumber: asNullableString(pickValue(index, ['Revision Number', 'RevisionNumber'])),
      entityTitle,
      classId: asNullableString(pickValue(index, ['Class ID', 'ClassID'])),
      completionDateMonth,
      grade: asNullableString(pickValue(index, ['Grade'])),
      completionStatusId: asNullableString(
        pickValue(index, ['Completion Status ID', 'CompletionStatusID']),
      ),
      completionStatus,
      totalHours: asNullableNumber(pickValue(index, ['Total Hours', 'TotalHours'])),
      creditHoursProfessionalAssociations: asNullableNumber(
        pickValue(index, [
          'Credit Hours for professional associations',
          'Credit Hours Professional Associations',
        ]),
      ),
      contactHours: asNullableNumber(pickValue(index, ['Contact Hours', 'ContactHours'])),
      cpe: asNullableNumber(pickValue(index, ['CPE'])),
      tuition: asNullableNumber(pickValue(index, ['Tuition'])),
      currencySymbol: asNullableString(pickValue(index, ['Currency Symbol', 'CurrencySymbol'])),
      currencyId: asNullableString(pickValue(index, ['Currency ID', 'CurrencyID'])),
      instructor: asNullableString(pickValue(index, ['Instructor'])),
      lastUpdateUser: asNullableString(pickValue(index, ['Last Update User', 'LastUpdateUser'])),
      lastUpdateTimeMonth,
      eSignatureMeaningCode: asNullableString(
        pickValue(index, ['E-signature Meaning Code', 'E Signature Meaning Code']),
      ),
      comments: asNullableString(pickValue(index, ['Comments', 'Comment'])),
      payload,
    });
  }

  return { validations, normalizedRows };
}

async function loadHumanResourcesTrainingStaging(
  uploadId: string,
  rows: HumanResourcesTrainingNormalizedRow[],
) {
  const client = getBigQueryClient();

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_human_resources_training\` (
        upload_id STRING,
        row_number INT64,
        period_month DATE,
        user_name STRING,
        active_user STRING,
        first_name STRING,
        last_name STRING,
        middle_name STRING,
        entity_id STRING,
        item_type STRING,
        entity_type STRING,
        item_revision_date_month DATE,
        revision_number STRING,
        entity_title STRING,
        class_id STRING,
        completion_date_month DATE,
        grade STRING,
        completion_status_id STRING,
        completion_status STRING,
        total_hours NUMERIC,
        credit_hours_professional_associations NUMERIC,
        contact_hours NUMERIC,
        cpe NUMERIC,
        tuition NUMERIC,
        currency_symbol STRING,
        currency_id STRING,
        instructor STRING,
        last_update_user STRING,
        last_update_time_month DATE,
        e_signature_meaning_code STRING,
        comments STRING,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_human_resources_training\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId },
  });

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_human_resources_training\`
    (
      upload_id, row_number, period_month, user_name, active_user, first_name, last_name, middle_name,
      entity_id, item_type, entity_type, item_revision_date_month, revision_number, entity_title, class_id,
      completion_date_month, grade, completion_status_id, completion_status, total_hours,
      credit_hours_professional_associations, contact_hours, cpe, tuition, currency_symbol, currency_id,
      instructor, last_update_user, last_update_time_month, e_signature_meaning_code, comments,
      source_payload_json, normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      DATE(row.period_month),
      NULLIF(row.user_name, ''),
      NULLIF(row.active_user, ''),
      NULLIF(row.first_name, ''),
      NULLIF(row.last_name, ''),
      NULLIF(row.middle_name, ''),
      NULLIF(row.entity_id, ''),
      NULLIF(row.item_type, ''),
      NULLIF(row.entity_type, ''),
      IF(row.item_revision_date_month = '', NULL, DATE(row.item_revision_date_month)),
      NULLIF(row.revision_number, ''),
      NULLIF(row.entity_title, ''),
      NULLIF(row.class_id, ''),
      IF(row.completion_date_month = '', NULL, DATE(row.completion_date_month)),
      NULLIF(row.grade, ''),
      NULLIF(row.completion_status_id, ''),
      NULLIF(row.completion_status, ''),
      SAFE_CAST(row.total_hours AS NUMERIC),
      SAFE_CAST(row.credit_hours_professional_associations AS NUMERIC),
      SAFE_CAST(row.contact_hours AS NUMERIC),
      SAFE_CAST(row.cpe AS NUMERIC),
      SAFE_CAST(row.tuition AS NUMERIC),
      NULLIF(row.currency_symbol, ''),
      NULLIF(row.currency_id, ''),
      NULLIF(row.instructor, ''),
      NULLIF(row.last_update_user, ''),
      IF(row.last_update_time_month = '', NULL, DATE(row.last_update_time_month)),
      NULLIF(row.e_signature_meaning_code, ''),
      NULLIF(row.comments, ''),
      PARSE_JSON(row.source_payload_json),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItems(rows, 1500);
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await client.query({
        query,
        params: {
          uploadId,
          rows: chunk.map((row) => ({
            row_number: row.rowNumber,
            period_month: row.periodMonth,
            user_name: row.userName ?? '',
            active_user: row.activeUser ?? '',
            first_name: row.firstName ?? '',
            last_name: row.lastName ?? '',
            middle_name: row.middleName ?? '',
            entity_id: row.entityId ?? '',
            item_type: row.itemType ?? '',
            entity_type: row.entityType ?? '',
            item_revision_date_month: row.itemRevisionDateMonth ?? '',
            revision_number: row.revisionNumber ?? '',
            entity_title: row.entityTitle ?? '',
            class_id: row.classId ?? '',
            completion_date_month: row.completionDateMonth ?? '',
            grade: row.grade ?? '',
            completion_status_id: row.completionStatusId ?? '',
            completion_status: row.completionStatus ?? '',
            total_hours: row.totalHours == null ? '' : String(row.totalHours),
            credit_hours_professional_associations:
              row.creditHoursProfessionalAssociations == null ? '' : String(row.creditHoursProfessionalAssociations),
            contact_hours: row.contactHours == null ? '' : String(row.contactHours),
            cpe: row.cpe == null ? '' : String(row.cpe),
            tuition: row.tuition == null ? '' : String(row.tuition),
            currency_symbol: row.currencySymbol ?? '',
            currency_id: row.currencyId ?? '',
            instructor: row.instructor ?? '',
            last_update_user: row.lastUpdateUser ?? '',
            last_update_time_month: row.lastUpdateTimeMonth ?? '',
            e_signature_meaning_code: row.eSignatureMeaningCode ?? '',
            comments: row.comments ?? '',
            source_payload_json: JSON.stringify(row.payload),
          })),
        },
      });
    },
    4,
  );
}

export async function normalizeUpload(uploadId: string, moduleCode: string): Promise<NormalizeUploadResult> {
  const rows = await getRawRows(uploadId);

  if (moduleCode === 'sales_internal') {
    const { validations, normalizedRows } = normalizeSalesInternal(rows);
    await updateRawValidationStatus(uploadId, validations);
    await loadSalesInternalStaging(uploadId, normalizedRows);
    return buildNormalizeUploadResult(validations, normalizedRows.length);
  }

  if (moduleCode === 'business_excellence_closeup' || moduleCode === 'closeup') {
    const { validations, normalizedRows } = await normalizeBusinessExcellenceCloseup(rows);
    await updateRawValidationStatus(uploadId, validations);
    await loadCloseupStaging(uploadId, normalizedRows);
    return buildNormalizeUploadResult(validations, normalizedRows.length);
  }

  if (moduleCode === 'business_excellence_ddd' || moduleCode === 'business_excellence_pmm' || moduleCode === 'pmm' || moduleCode === 'ddd') {
    const asOfMonth = await getUploadAsOfMonth(uploadId);
    const { validations, normalizedRows } = await normalizeBusinessExcellencePmm(rows, asOfMonth);
    await updateRawValidationStatus(uploadId, validations);
    await loadPmmStaging(uploadId, normalizedRows);
    return buildNormalizeUploadResult(validations, normalizedRows.length);
  }

  if (
    moduleCode === 'business_excellence_budget_sell_out' ||
    moduleCode === 'business_excellence_sell_out' ||
    moduleCode === 'sell_out'
  ) {
    const asOfMonth = await getUploadAsOfMonth(uploadId);
    const sourceTag = await getUploadSourceTag(uploadId);
    const { validations, normalizedRows } = await normalizeBusinessExcellenceSellOut(
      rows,
      asOfMonth,
      sourceTag,
    );
    await updateRawValidationStatus(uploadId, validations);
    await loadSellOutStaging(uploadId, normalizedRows);
    return buildNormalizeUploadResult(validations, normalizedRows.length);
  }

  if (
    moduleCode === 'business_excellence_brick_assignment' ||
    moduleCode === 'business_excellence_bricks_visited' ||
    moduleCode === 'bricks_visited'
  ) {
    const periodMonth = await getUploadAsOfMonth(uploadId);
    const { validations, normalizedRows } = normalizeBusinessExcellenceBrickAssignment(
      rows,
      periodMonth,
    );
    await updateRawValidationStatus(uploadId, validations);
    await loadBrickAssignmentStaging(uploadId, normalizedRows);
    return buildNormalizeUploadResult(validations, normalizedRows.length);
  }

  if (
    moduleCode === 'business_excellence_iqvia_weekly' ||
    moduleCode === 'business_excellence_weekly_tracking' ||
    moduleCode === 'iqvia_weekly' ||
    moduleCode === 'weekly_tracking'
  ) {
    const asOfMonth = await getUploadAsOfMonth(uploadId);
    const { validations, normalizedRows } = normalizeBusinessExcellenceWeeklyTracking(
      rows,
      asOfMonth,
    );
    await updateRawValidationStatus(uploadId, validations);
    await loadWeeklyTrackingStaging(uploadId, normalizedRows);
    return buildNormalizeUploadResult(validations, normalizedRows.length);
  }

  if (moduleCode === 'human_resources_turnover') {
    const asOfMonth = await getUploadAsOfMonth(uploadId);
    const { validations, normalizedRows } = normalizeHumanResourcesTurnover(rows, asOfMonth);
    await updateRawValidationStatus(uploadId, validations);
    await loadHumanResourcesTurnoverStaging(uploadId, normalizedRows);
    return buildNormalizeUploadResult(validations, normalizedRows.length);
  }

  if (moduleCode === 'human_resources_training' || moduleCode === 'human_resources_entrenamiento') {
    const asOfMonth = await getUploadAsOfMonth(uploadId);
    const { validations, normalizedRows } = normalizeHumanResourcesTraining(rows, asOfMonth);
    await updateRawValidationStatus(uploadId, validations);
    await loadHumanResourcesTrainingStaging(uploadId, normalizedRows);
    return buildNormalizeUploadResult(validations, normalizedRows.length);
  }

  throw new Error(`No normalizer configured for module "${moduleCode}".`);
}



