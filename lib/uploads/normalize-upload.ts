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

type BusinessExcellenceSalesforceMedicalFileNormalizedRow = {
  rowNumber: number;
  onekeyId: string;
  territory: string;
  territoryNormalized: string;
  bu: string | null;
  district: string | null;
  imsId: string | null;
  fullName: string | null;
  specialtyConsolidated: string | null;
  periodMonth: string;
  objetivo: number | null;
  potencial: string | null;
  payload: Record<string, unknown>;
};

type BusinessExcellenceSalesforceTftNormalizedRow = {
  rowNumber: number;
  territorio: string;
  territoryNormalized: string;
  territoryOwnerName: string | null;
  absenceType: string | null;
  absenceName: string | null;
  daysValue: number | null;
  startDateRaw: string | null;
  endDateRaw: string | null;
  periodMonth: string;
  payload: Record<string, unknown>;
};

type BusinessExcellenceSalesforceInteractionNormalizedRow = {
  rowNumber: number;
  interactionId: string;
  onekeyId: string;
  territory: string;
  territoryNormalized: string;
  accountName: string | null;
  ownerName: string | null;
  channel: string | null;
  visitType: string | null;
  interactionDateRaw: string | null;
  submitDateRaw: string | null;
  interactionPeriodMonth: string;
  submitPeriodMonth: string | null;
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

type CommercialOperationsDsoNormalizedRow = {
  rowNumber: number;
  groupName: string;
  periodMonth: string;
  dsoValue: number;
  payload: Record<string, unknown>;
};

type CommercialOperationsStocksNormalizedRow = {
  rowNumber: number;
  businessType: string | null;
  market: string | null;
  businessUnit: string | null;
  clientInstitution: string | null;
  stockType: string | null;
  sourceProductRaw: string;
  sourceProductNormalized: string;
  periodMonth: string;
  stockValue: number;
  payload: Record<string, unknown>;
};

type CommercialOperationsDeliveryOrdersNormalizedRow = {
  rowNumber: number;
  orderScope: 'government' | 'private';
  businessType: string | null;
  market: string | null;
  businessUnit: string | null;
  unidadNegocioChiesi?: string | null;
  clientInstitution: string | null;
  orderType: string | null;
  documentNumber?: string | null;
  contractNumber?: string | null;
  customerOrderNumber?: string | null;
  salesDocument?: string | null;
  salesDocumentPosition?: string | null;
  sku?: string | null;
  ccb?: string | null;
  laboratory?: string | null;
  status?: string | null;
  orderStatus?: string | null;
  rejectionReason?: string | null;
  deliveryId?: string | null;
  deliveryPoint?: string | null;
  recipient?: string | null;
  clues?: string | null;
  fechaPedidoSapMonth?: string | null;
  fechaPedidoMonth?: string | null;
  fechaCreacionDeliveryMonth?: string | null;
  fechaSalidaMercanciaMonth?: string | null;
  fechaMaximaEntregaMonth?: string | null;
  fechaConfirmacionEntregaMonth?: string | null;
  tiempoEntregaDiasNaturales?: number | null;
  entregaVsVencimientoDiasNaturales?: number | null;
  precioUnitario?: number | null;
  importe?: number | null;
  cantidadTotalPedido?: number | null;
  confirmadas?: number | null;
  cantidadSuministrada?: number | null;
  cantidadEntregada?: number | null;
  cantidadFacturada?: number | null;
  sancion?: string | null;
  montoSancion?: number | null;
  facturadoChiesi?: string | null;
  cuentaDias?: number | null;
  precioReal?: number | null;
  cantidadFacturadaChiesi?: number | null;
  montoFacturadoChiesi?: number | null;
  tipoEntrega?: string | null;
  cpm?: string | null;
  posiblesCanjes?: number | null;
  sourceProductRaw: string;
  sourceProductNormalized: string;
  periodMonth: string;
  orderValue: number | null;
  payload: Record<string, unknown>;
};

type CommercialOperationsGovernmentContractProgressNormalizedRow = {
  rowNumber: number;
  contractKey: string | null;
  contractType: string | null;
  vigencia: string | null;
  category: string | null;
  responsible: string | null;
  cbCode: string | null;
  sourceProductRaw: string;
  sourceProductNormalized: string;
  tenderNumber: string | null;
  contractNumber: string | null;
  eventType: string | null;
  centralizedOpd: string | null;
  centralInstitution: string | null;
  institution: string | null;
  assignedTo: string | null;
  businessModel: string | null;
  assignmentStatus: string | null;
  businessUnit: string | null;
  periodMonth: string;
  deliveredQuantity: number;
  maxQuantity2025: number | null;
  maxQuantity2026: number | null;
  total2025: number | null;
  total2026: number | null;
  total2025_2026: number | null;
  progressPctTotal: number | null;
  progressPct2025: number | null;
  progressPct2026: number | null;
  maxContractQuantity: number | null;
  contractTotalQuantity: number | null;
  payload: Record<string, unknown>;
};

type OpexMasterCatalogNormalizedRow = {
  rowNumber: number;
  key1: string;
  key2: string | null;
  account: string | null;
  plGroup: string | null;
  area: string | null;
  ceco: string | null;
  cecoName: string | null;
  costElement: string | null;
  element: string | null;
  businessUnit: string | null;
  owner: string | null;
  responsible: string | null;
  payload: Record<string, unknown>;
};

type OpexMovementNormalizedRow = {
  rowNumber: number;
  key1: string;
  key2: string | null;
  periodMonth: string;
  metricName: 'actuals_2025' | 'budget_2026' | 'actuals_2026';
  amountValue: number;
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

function chunkItemsByApproxBytes<T>(
  items: T[],
  options: {
    maxBytesPerChunk: number;
    maxItemsPerChunk: number;
    estimateBytes: (item: T) => number;
  },
) {
  const chunks: T[][] = [];
  let currentChunk: T[] = [];
  let currentBytes = 0;

  for (const item of items) {
    const itemBytes = Math.max(1, options.estimateBytes(item));
    const exceedsItems = currentChunk.length >= options.maxItemsPerChunk;
    const exceedsBytes = currentBytes + itemBytes > options.maxBytesPerChunk;

    if (currentChunk.length > 0 && (exceedsItems || exceedsBytes)) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentBytes = 0;
    }

    currentChunk.push(item);
    currentBytes += itemBytes;
  }

  if (currentChunk.length > 0) chunks.push(currentChunk);
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

function isTableUpdateQuotaError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('exceeded quota for table update operations') ||
    message.includes('job exceeded rate limits')
  );
}

async function runQueryWithRetryOnConcurrentUpdate<T>(
  fn: () => Promise<T>,
  retries = 10,
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
      const baseMs = isTableUpdateQuotaError(error) ? 5000 : 1000;
      const maxMs = isTableUpdateQuotaError(error) ? 120000 : 30000;
      const exponential = baseMs * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * (isTableUpdateQuotaError(error) ? 2000 : 500));
      const waitMs = Math.min(maxMs, exponential + jitter);
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
  ene: '01',
  enero: '01',
  february: '02',
  feb: '02',
  febrero: '02',
  march: '03',
  mar: '03',
  marzo: '03',
  april: '04',
  apr: '04',
  abr: '04',
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
  ago: '08',
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
  dic: '12',
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
    // Dot-only numbers are treated as decimal representation to preserve precision
    // from sources like DSO (e.g. 107.410206...).
    normalized = compact;
  }

  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function asNullableQuantityNumber(value: unknown) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const compact = raw
    .replace(/\s/g, '')
    .replace(/[$â‚¬Â£]/g, '')
    .replace(/[^\d,.\-]/g, '');
  if (!compact) return null;

  // Pattern like 1.234 or 12.345.678 => thousands separators.
  if (/^-?\d{1,3}(\.\d{3})+$/.test(compact)) {
    const parsed = Number(compact.replace(/\./g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  // Pattern like 1,234 or 12,345,678 => thousands separators.
  if (/^-?\d{1,3}(,\d{3})+$/.test(compact)) {
    const parsed = Number(compact.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return asNullableNumber(value);
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeTerritoryForKey(value: string | null) {
  if (!value) return null;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  return normalized.length > 0 ? normalized : null;
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

function pickPayloadValueByExactNormalizedHeader(
  payload: Record<string, unknown>,
  normalizedHeader: string,
) {
  for (const [key, value] of Object.entries(payload)) {
    if (normalizeText(key) === normalizedHeader) return value;
  }
  return null;
}

function pickPayloadContractQuantityByYear(
  payload: Record<string, unknown>,
  year: 2025 | 2026,
) {
  const include = new RegExp(`\\bcantidad\\b.*\\bmaxima\\b.*\\b${year}\\b`);
  const exclude = /\bmaypo\b|\bminima\b|\btotal\b/;
  for (const [key, value] of Object.entries(payload)) {
    const normalized = normalizeText(key);
    if (!include.test(normalized)) continue;
    if (exclude.test(normalized)) continue;
    return value;
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

function parseMonthHeaderFlexible(header: string): string | null {
  const cleanHeader = header
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const match = cleanHeader.match(/^([A-Za-z]{3,})\s+(\d{2,4})$/);
  if (!match) return null;

  const month = parseMonthToken(match[1]);
  const year = parseYearToken(match[2]);
  if (!month || !year) return null;
  return `${year}-${month}-01`;
}

function parseMonthHeaderWithExcelSerial(header: string): string | null {
  const fromText = parseMonthHeaderFlexible(header);
  if (fromText) return fromText;
  const clean = header.trim();
  // For header parsing, only treat literal date-like strings as dates.
  // Avoid coercing plain year tokens like "2023" into Excel serial dates (1905-xx).
  const looksLikeDateLiteral =
    /^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}(?:\s|$)/.test(clean) ||
    /^\d{4}-\d{2}-\d{2}T/.test(clean) ||
    /^(?:[A-Za-z]{3}\s+)?[A-Za-z]{3,}\s+\d{1,2}\s+\d{4}\b/.test(clean);
  if (looksLikeDateLiteral) {
    const fromDateField = parseDateField(clean);
    if (fromDateField) return fromDateField;
  }
  // Only accept pure Excel serial-like headers (e.g. "45658", "45658.0"),
  // not numbers embedded in descriptive headers (e.g. "TOTAL 2025").
  const serialOnly = clean.match(/^-?\d{4,6}(?:\.\d+)?$/);
  if (!serialOnly) return null;
  const serial = Number(serialOnly[0]);
  if (!Number.isFinite(serial)) return null;
  // Guardrails to avoid interpreting year-like values (2025, 2026) as Excel dates.
  if (serial < 30000 || serial > 70000) return null;
  return parseExcelSerialDate(serial);
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
    if (value >= 30000 && value <= 70000) {
      return parseExcelSerialDate(value);
    }
    return null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // Headers coming from Excel-to-JSON can look like:
  // "Sun Feb 01 2026 00:00:44 GMT+0100 (...)"
  // If parsed as UTC Date, month can shift backwards (e.g. Jan 31 UTC).
  // Prefer extracting month/year directly from the textual header.
  const weekdayMonthYear = raw.match(
    /^(?:[A-Za-z]{3}\s+)?([A-Za-z]{3,})\s+\d{1,2}\s+(\d{4})\b/,
  );
  if (weekdayMonthYear) {
    const month = parseMonthToken(weekdayMonthYear[1]);
    const year = parseYearToken(weekdayMonthYear[2]);
    if (month && year) {
      return `${year}-${month}-01`;
    }
  }

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
    if (numericValue < 30000 || numericValue > 70000) return null;
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

function toMonthStartFromLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function parseDateMonthLocal(value: unknown, order: 'month-first' | 'day-first'): string | null {
  if (value == null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toMonthStartFromLocalDate(value);
  }

  if (typeof value === 'number') {
    return parseDateField(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const dateToken = raw
    .replace(',', ' ')
    .trim()
    .split(/\s+/)[0] ?? '';
  const match = dateToken.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = parseYearToken(match[3]);
    if (year == null) return null;
    const month = order === 'month-first' ? first : second;
    const day = order === 'month-first' ? second : first;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-01`;
  }

  return parseDateField(value);
}

function parseDateFieldMonthFirstNoTimezone(value: unknown) {
  return parseDateMonthLocal(value, 'month-first');
}

function parseDateFieldDayFirstNoTimezone(value: unknown) {
  return parseDateMonthLocal(value, 'day-first');
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

function isOpexSummaryValue(value: string | null) {
  if (!value) return false;
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return (
    normalized === 'total' ||
    normalized === 'totales' ||
    normalized === 'subtotal' ||
    normalized === 'sub total' ||
    normalized === 'grand total' ||
    normalized.startsWith('total ') ||
    normalized.startsWith('subtotal ')
  );
}

function normalizeOpexByCcMasterCatalog(rows: RawUploadRow[]) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: OpexMasterCatalogNormalizedRow[] = [];
  const dedup = new Set<string>();

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);

    const key1 = asNullableString(pickValue(index, ['Key1', 'Key 1', 'Llave 1']));
    if (!key1) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: Key1 is empty (master catalog boundary).'],
      });
      continue;
    }
    const key2 = asNullableString(pickValue(index, ['Key2', 'Key 2', 'Llave 2']));
    if (!key2) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: Key2 is empty (detail row required).'],
      });
      continue;
    }
    const account = asNullableString(pickValue(index, ['Account', 'Cuenta']));
    if (isOpexSummaryValue(key1) || isOpexSummaryValue(key2) || isOpexSummaryValue(account)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: summary/total row in OPEX catalog.'],
      });
      continue;
    }

    const normalizedRow: OpexMasterCatalogNormalizedRow = {
      rowNumber: row.row_number,
      key1,
      key2,
      account,
      plGroup: asNullableString(pickValue(index, ['P&L Group', 'P L Group', 'PL Group'])),
      area: asNullableString(pickValue(index, ['Area', 'Área'])),
      ceco: asNullableString(pickValue(index, ['CeCo', 'CECO', 'Centro de Costo'])),
      cecoName: asNullableString(pickValue(index, ['CeCo Name', 'CECO Name', 'Nombre CeCo', 'Nombre CECO'])),
      costElement: asNullableString(pickValue(index, ['Cost Element', 'Elemento de Costo'])),
      element: asNullableString(pickValue(index, ['Element', 'Elemento'])),
      businessUnit: asNullableString(pickValue(index, ['BU', 'Business Unit', 'Unidad de Negocio'])),
      owner: asNullableString(pickValue(index, ['Owner', 'Dueño'])),
      responsible: asNullableString(pickValue(index, ['Responsible', 'Responsable'])),
      payload,
    };

    const dedupKey = [
      normalizeText(normalizedRow.key1),
      normalizeText(normalizedRow.key2 ?? ''),
      normalizeText(normalizedRow.account ?? ''),
      normalizeText(normalizedRow.ceco ?? ''),
      normalizeText(normalizedRow.costElement ?? ''),
    ].join('|');

    if (dedup.has(dedupKey)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: duplicated master catalog row.'],
      });
      continue;
    }

    dedup.add(dedupKey);
    normalizedRows.push(normalizedRow);
    validations.push({
      rowNumber: row.row_number,
      validationStatus: 'valid',
      errors: [],
    });
  }

  return { validations, normalizedRows };
}

function normalizeOpexByCcMovements(rows: RawUploadRow[]) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: OpexMovementNormalizedRow[] = [];
  const dedup = new Set<string>();
  const resolved2025MonthColumns: Array<{
    periodMonth: string;
    payloadKey: string;
    columnIndex: number | null;
  }> = Array.from({ length: 12 }, (_, index) => ({
    periodMonth: `2025-${String(index + 1).padStart(2, '0')}-01`,
    payloadKey: `column_${14 + index}`, // O:Z when B is column_1
    columnIndex: 14 + index,
  }));
  let resolved2026BudgetMonthColumns:
    | Array<{ periodMonth: string; payloadKey: string; columnIndex: number | null }>
    | null = null;
  let resolved2026ActualMonthColumns:
    | Array<{ periodMonth: string; payloadKey: string; columnIndex: number | null }>
    | null = null;

  function parseColumnIndexFromPayloadKey(payloadKey: string): number | null {
    const match = payloadKey.match(/^column_(\d+)$/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function resolveYearMonthColumns(
    payload: Record<string, unknown>,
    year: 2025 | 2026,
    preferredMarkers: string[],
    minColumnIndexExclusive?: number,
  ) {
    const monthCandidates = new Map<
      string,
      {
        payloadKey: string;
        columnIndex: number | null;
        hasPreferredMarker: boolean;
        keyLength: number;
      }
    >();

    for (const key of Object.keys(payload)) {
      const parsedPeriod =
        parseMonthHeaderWithExcelSerial(key) ?? parseMonthHeaderFlexible(key);
      if (!parsedPeriod || !parsedPeriod.startsWith(`${year}-`)) continue;

      const normalizedHeader = normalizeText(key);
      const hasPreferredMarker = preferredMarkers.some((marker) =>
        normalizedHeader.includes(marker),
      );
      const columnIndex = parseColumnIndexFromPayloadKey(key);
      if (
        minColumnIndexExclusive != null &&
        columnIndex != null &&
        columnIndex <= minColumnIndexExclusive
      ) {
        continue;
      }

      const current = monthCandidates.get(parsedPeriod);
      if (
        !current ||
        (hasPreferredMarker && !current.hasPreferredMarker) ||
        (hasPreferredMarker === current.hasPreferredMarker &&
          (columnIndex ?? Number.MAX_SAFE_INTEGER) <
            (current.columnIndex ?? Number.MAX_SAFE_INTEGER)) ||
        (hasPreferredMarker === current.hasPreferredMarker &&
          columnIndex === current.columnIndex &&
          key.length < current.keyLength)
      ) {
        monthCandidates.set(parsedPeriod, {
          payloadKey: key,
          columnIndex,
          hasPreferredMarker,
          keyLength: key.length,
        });
      }
    }

    const dynamicColumns = Array.from(monthCandidates.entries())
      .map(([periodMonth, meta]) => ({
        periodMonth,
        payloadKey: meta.payloadKey,
        columnIndex: meta.columnIndex,
      }))
      .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth));

    if (dynamicColumns.length > 0) return dynamicColumns;

    // Fallbacks by block:
    // 2025 actuals: O:Z => column_15:column_26
    // 2025 actuals: O:Z => column_14:column_25 (B is column_1)
    // 2026 budget: AC:AN => column_28:column_39 (B is column_1)
    if (year === 2025) {
      return Array.from({ length: 12 }, (_, index) => ({
        periodMonth: `2025-${String(index + 1).padStart(2, '0')}-01`,
        payloadKey: `column_${14 + index}`,
        columnIndex: 14 + index,
      }));
    }

    return Array.from({ length: 12 }, (_, index) => ({
      periodMonth: `2026-${String(index + 1).padStart(2, '0')}-01`,
      payloadKey: `column_${28 + index}`,
      columnIndex: 28 + index,
    }));
  }

  function resolveContiguousYearBlockFromJan(
    payload: Record<string, unknown>,
    year: 2025 | 2026,
    options?: {
      preferredMarkers?: string[];
      minColumnIndexExclusive?: number;
    },
  ): Array<{ periodMonth: string; payloadKey: string; columnIndex: number | null }> | null {
    const janCandidates: Array<{ payloadKey: string; columnIndex: number; hasMarker: boolean }> = [];
    for (const key of Object.keys(payload)) {
      const parsedPeriod = parseMonthHeaderWithExcelSerial(key) ?? parseMonthHeaderFlexible(key);
      if (parsedPeriod !== `${year}-01-01`) continue;
      const columnIndex = parseColumnIndexFromPayloadKey(key);
      if (!columnIndex) continue;
      if (
        options?.minColumnIndexExclusive != null &&
        columnIndex <= options.minColumnIndexExclusive
      ) {
        continue;
      }
      const normalizedHeader = normalizeText(key);
      const hasMarker =
        (options?.preferredMarkers ?? []).some((marker) => normalizedHeader.includes(marker));
      janCandidates.push({ payloadKey: key, columnIndex, hasMarker });
    }

    if (janCandidates.length === 0) return null;
    janCandidates.sort((a, b) => {
      if (a.hasMarker !== b.hasMarker) return a.hasMarker ? -1 : 1;
      return a.columnIndex - b.columnIndex;
    });
    const chosen = janCandidates[0];
    if (!chosen) return null;

    const block = Array.from({ length: 12 }, (_, offset) => {
      const month = String(offset + 1).padStart(2, '0');
      const columnIndex = chosen.columnIndex + offset;
      return {
        periodMonth: `${year}-${month}-01`,
        payloadKey: `column_${columnIndex}`,
        columnIndex,
      };
    });
    return block;
  }

  function resolveActuals2026ByFourthMonthOccurrence(
    payload: Record<string, unknown>,
  ): Array<{ periodMonth: string; payloadKey: string; columnIndex: number | null }> | null {
    const monthKeyBuckets = new Map<string, Array<{ payloadKey: string; columnIndex: number | null }>>();

    for (const key of Object.keys(payload)) {
      const parsedPeriod = parseMonthHeaderWithExcelSerial(key) ?? parseMonthHeaderFlexible(key);
      if (!parsedPeriod || !parsedPeriod.startsWith('2026-')) continue;
      if (!monthKeyBuckets.has(parsedPeriod)) monthKeyBuckets.set(parsedPeriod, []);
      monthKeyBuckets.get(parsedPeriod)?.push({
        payloadKey: key,
        columnIndex: parseColumnIndexFromPayloadKey(key),
      });
    }

    const periodMonths = Array.from({ length: 12 }, (_, idx) => `2026-${String(idx + 1).padStart(2, '0')}-01`);
    // Need the 4th Jan/Ene/01 occurrence equivalent for all months.
    for (const periodMonth of periodMonths) {
      const bucket = monthKeyBuckets.get(periodMonth) ?? [];
      if (bucket.length < 4) return null;
      bucket.sort((a, b) => (a.columnIndex ?? Number.MAX_SAFE_INTEGER) - (b.columnIndex ?? Number.MAX_SAFE_INTEGER));
    }

    const resolved = periodMonths.map((periodMonth) => {
      const bucket = monthKeyBuckets.get(periodMonth)!;
      return bucket[3];
    });

    const janHeaderNormalized = normalizeText(resolved[0].payloadKey);
    const hasActualMarker =
      janHeaderNormalized.includes('actual') ||
      janHeaderNormalized.includes('act') ||
      janHeaderNormalized.includes('real') ||
      janHeaderNormalized.includes('current');
    if (!hasActualMarker) return null;

    return resolved.map((item, idx) => ({
      periodMonth: `2026-${String(idx + 1).padStart(2, '0')}-01`,
      payloadKey: item.payloadKey,
      columnIndex: item.columnIndex,
    }));
  }

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);

    const key1 = asNullableString(pickValue(index, ['Key1', 'Key 1', 'Llave 1']));
    if (!key1) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: Key1 is empty (movement boundary).'],
      });
      continue;
    }

    const key2 = asNullableString(pickValue(index, ['Key2', 'Key 2', 'Llave 2']));
    if (!key2) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: Key2 is empty (detail row required).'],
      });
      continue;
    }
    const account = asNullableString(pickValue(index, ['Account', 'Cuenta']));
    if (isOpexSummaryValue(key1) || isOpexSummaryValue(key2) || isOpexSummaryValue(account)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: summary/total row in OPEX movements.'],
      });
      continue;
    }
    let movementCount = 0;

    if (!resolved2026BudgetMonthColumns) {
      const maxActual2025ColumnIndex = resolved2025MonthColumns.reduce(
        (max, item) =>
          item.columnIndex != null && item.columnIndex > max ? item.columnIndex : max,
        0,
      );
      resolved2026BudgetMonthColumns =
        resolveContiguousYearBlockFromJan(payload, 2026, {
          preferredMarkers: ['budget', 'presupuesto', 'plan', 'target', 'bud'],
          minColumnIndexExclusive: maxActual2025ColumnIndex,
        }) ??
        resolveYearMonthColumns(
          payload,
          2026,
          ['budget', 'presupuesto', 'plan', 'target', 'bud'],
          maxActual2025ColumnIndex,
        );
    }
    if (!resolved2026ActualMonthColumns) {
      resolved2026ActualMonthColumns =
        resolveActuals2026ByFourthMonthOccurrence(payload) ??
        // Fallback fixed block BE:BP => column_56:column_67 => Jan..Dec 2026 (B is column_1)
        Array.from({ length: 12 }, (_, index) => ({
          periodMonth: `2026-${String(index + 1).padStart(2, '0')}-01`,
          payloadKey: `column_${56 + index}`,
          columnIndex: 56 + index,
        }));
    }

    for (const monthColumn of resolved2025MonthColumns) {
      const amountValue = asNullableNumber(payload[monthColumn.payloadKey]);
      if (amountValue == null) continue;

      const periodMonth = monthColumn.periodMonth;
      const dedupKey = `${normalizeText(key1)}|${normalizeText(key2 ?? '')}|${periodMonth}|actuals_2025`;
      if (dedup.has(dedupKey)) continue;
      dedup.add(dedupKey);

      normalizedRows.push({
        rowNumber: row.row_number,
        key1,
        key2,
        periodMonth,
        metricName: 'actuals_2025',
        amountValue,
        payload: {},
      });
      movementCount += 1;
    }
    for (const monthColumn of resolved2026BudgetMonthColumns) {
      const amountValue = asNullableNumber(payload[monthColumn.payloadKey]);
      if (amountValue == null) continue;

      const periodMonth = monthColumn.periodMonth;
      const dedupKey = `${normalizeText(key1)}|${normalizeText(key2 ?? '')}|${periodMonth}|budget_2026`;
      if (dedup.has(dedupKey)) continue;
      dedup.add(dedupKey);

      normalizedRows.push({
        rowNumber: row.row_number,
        key1,
        key2,
        periodMonth,
        metricName: 'budget_2026',
        amountValue,
        payload: {},
      });
      movementCount += 1;
    }
    for (const monthColumn of resolved2026ActualMonthColumns) {
      const amountValue = asNullableNumber(payload[monthColumn.payloadKey]);
      if (amountValue == null) continue;

      const periodMonth = monthColumn.periodMonth;
      const dedupKey = `${normalizeText(key1)}|${normalizeText(key2 ?? '')}|${periodMonth}|actuals_2026`;
      if (dedup.has(dedupKey)) continue;
      dedup.add(dedupKey);

      normalizedRows.push({
        rowNumber: row.row_number,
        key1,
        key2,
        periodMonth,
        metricName: 'actuals_2026',
        amountValue,
        payload: {},
      });
      movementCount += 1;
    }

    validations.push({
      rowNumber: row.row_number,
      validationStatus: movementCount > 0 ? 'valid' : 'skipped',
      errors:
        movementCount > 0
          ? []
          : ['Skipped: no monthly values found for 2025 ACT/Actual, 2026 Budget, or 2026 Actuals blocks.'],
    });
  }

  return { validations, normalizedRows };
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

  const chunks = chunkItems(validations, 5000);
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
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
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

  const chunks = chunkItemsByApproxBytes(rows, {
    maxBytesPerChunk: 2_000_000,
    maxItemsPerChunk: 1000,
    estimateBytes: (row) =>
      String(row.productCloseupRaw ?? '').length +
      String(row.productCloseupNormalized ?? '').length +
      String(row.productId ?? '').length +
      String(row.canonicalProductName ?? '').length +
      String(row.marketGroup ?? '').length +
      String(row.specialty ?? '').length +
      String(row.sourceDateRaw ?? '').length +
      String(row.sourceDate ?? '').length +
      String(row.periodRaw ?? '').length +
      String(row.periodMonth ?? '').length +
      String(row.visitedSourceRaw ?? '').length +
      256,
  });
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
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
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
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
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

function normalizeBusinessExcellenceSalesforceMedicalFile(rows: RawUploadRow[]) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: BusinessExcellenceSalesforceMedicalFileNormalizedRow[] = [];

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);
    const errors: string[] = [];

    const onekeyId = asNullableString(
      pickValue(index, ['Onekey ID', 'OneKey ID', 'ONEKEY ID', 'OnEkey ID']),
    );
    const territory = asNullableString(pickValue(index, ['Territory', 'Territorio']));
    const territoryNormalized = normalizeTerritoryForKey(territory);
    const bu = asNullableString(
      pickValue(index, ['BU', 'Business Unit', 'Unidad de Negocio', 'Unidad Negocio']),
    );
    const district = asNullableString(pickValue(index, ['District', 'Distrito']));
    const imsId = asNullableString(
      pickValue(index, ['IMS ID', 'IMS Id', 'IMD ID', 'IMD Id', 'IMDID', 'IMSID']),
    );
    const fullName = asNullableString(pickValue(index, ['Full Name', 'Nombre completo']));
    const specialtyConsolidated = asNullableString(
      pickValue(index, ['Especialidad Consolidada', 'Specialty Consolidated']),
    );
    const mesRaw = pickValue(index, ['Mes', 'Month', 'Periodo', 'Period']);
    const periodMonth = parseDateFieldMonthFirstNoTimezone(mesRaw);
    const objetivo = asNullableNumber(pickValue(index, ['Objetivo', 'Objective']));
    const potencial = asNullableString(pickValue(index, ['Potencial', 'Potential']));

    if (!onekeyId) errors.push('Missing required Onekey ID column.');
    if (!territory) errors.push('Missing required Territory column.');
    if (!territoryNormalized) errors.push('Could not derive territorio_normalizado from Territory.');
    if (!periodMonth) errors.push('Missing or invalid Mes period value (expected mm/dd/yyyy).');

    const validationStatus: RowValidationResult['validationStatus'] = errors.length > 0 ? 'error' : 'valid';
    validations.push({
      rowNumber: row.row_number,
      validationStatus,
      errors,
    });

    if (validationStatus === 'error') continue;

    normalizedRows.push({
      rowNumber: row.row_number,
      onekeyId: onekeyId!,
      territory: territory!,
      territoryNormalized: territoryNormalized!,
      bu,
      district,
      imsId,
      fullName,
      specialtyConsolidated,
      periodMonth: periodMonth!,
      objetivo,
      potencial,
      payload,
    });
  }

  return { validations, normalizedRows };
}

async function loadBusinessExcellenceSalesforceMedicalFileStaging(
  uploadId: string,
  rows: BusinessExcellenceSalesforceMedicalFileNormalizedRow[],
) {
  const client = getBigQueryClient();

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file\` (
        upload_id STRING,
        row_number INT64,
        onekey_id STRING,
        territory STRING,
        territory_normalized STRING,
        bu STRING,
        district STRING,
        ims_id STRING,
        full_name STRING,
        specialty_consolidated STRING,
        period_month DATE,
        objetivo NUMERIC,
        potencial STRING,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
  });

  await client.query({
    query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file\`
      ADD COLUMN IF NOT EXISTS territory_normalized STRING
    `,
  });

  await client.query({
    query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file\`
      ADD COLUMN IF NOT EXISTS bu STRING
    `,
  });

  await client.query({
    query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file\`
      ADD COLUMN IF NOT EXISTS district STRING
    `,
  });

  await client.query({
    query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file\`
      ADD COLUMN IF NOT EXISTS ims_id STRING
    `,
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file\`
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
          'business_excellence_salesforce_fichero_medico',
          'business_excellence_fichero_medico',
          'fichero_medico'
        )
          AND u.upload_id != @uploadId
      )
    `,
    params: { uploadId },
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId },
  });

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file\`
    (
      upload_id,
      row_number,
      onekey_id,
      territory,
      territory_normalized,
      bu,
      district,
      ims_id,
      full_name,
      specialty_consolidated,
      period_month,
      objetivo,
      potencial,
      source_payload_json,
      normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      row.onekey_id,
      row.territory,
      NULLIF(row.territory_normalized, ''),
      NULLIF(row.bu, ''),
      NULLIF(row.district, ''),
      NULLIF(row.ims_id, ''),
      NULLIF(row.full_name, ''),
      NULLIF(row.specialty_consolidated, ''),
      DATE(row.period_month),
      SAFE_CAST(row.objetivo AS NUMERIC),
      NULLIF(row.potencial, ''),
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
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
            onekey_id: row.onekeyId,
            territory: row.territory,
            territory_normalized: row.territoryNormalized,
            bu: row.bu ?? '',
            district: row.district ?? '',
            ims_id: row.imsId ?? '',
            full_name: row.fullName ?? '',
            specialty_consolidated: row.specialtyConsolidated ?? '',
            period_month: row.periodMonth,
            objetivo: row.objetivo == null ? '' : String(row.objetivo),
            potencial: row.potencial ?? '',
            source_payload_json: JSON.stringify(row.payload),
          })),
        },
      });
    },
    4,
  );
}

function normalizeBusinessExcellenceSalesforceTft(rows: RawUploadRow[]) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: BusinessExcellenceSalesforceTftNormalizedRow[] = [];

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);
    const errors: string[] = [];

    const territorio = asNullableString(pickValue(index, ['Territorio', 'Territory', 'Territorio ']));
    const territoryNormalized = normalizeTerritoryForKey(territorio);
    const territoryOwnerName = asNullableString(
      pickValue(index, ['Tiempo fuera de Territorio: Creado por', 'Creado por', 'Created By']),
    );
    const absenceType = asNullableString(pickValue(index, ['Tipo', 'Type']));
    const absenceName = asNullableString(
      pickValue(index, ['Tiempo fuera de Territorio: Nombre', 'Nombre', 'Name']),
    );
    const daysValue = asNullableNumber(pickValue(index, ['Days', 'Dias', 'Días']));
    const startDateRawValue = pickValue(index, ['Fecha de inicio', 'Start Date', 'Inicio']);
    const endDateRawValue = pickValue(index, ['Fecha de finalización', 'Fecha finalizacion', 'End Date', 'Fin']);
    const startDateRaw = asNullableString(startDateRawValue);
    const endDateRaw = asNullableString(endDateRawValue);
    const periodMonth = parseDateFieldDayFirstNoTimezone(startDateRawValue);

    if (!territorio) errors.push('Missing required Territorio column.');
    if (!territoryNormalized) errors.push('Could not derive territorio_normalizado from Territorio.');
    if (!periodMonth) errors.push('Missing or invalid Fecha de inicio (expected dd/mm/yyyy, hh:mm).');

    const validationStatus: RowValidationResult['validationStatus'] = errors.length > 0 ? 'error' : 'valid';
    validations.push({
      rowNumber: row.row_number,
      validationStatus,
      errors,
    });

    if (validationStatus === 'error') continue;

    normalizedRows.push({
      rowNumber: row.row_number,
      territorio: territorio!,
      territoryNormalized: territoryNormalized!,
      territoryOwnerName,
      absenceType,
      absenceName,
      daysValue,
      startDateRaw,
      endDateRaw,
      periodMonth: periodMonth!,
      payload,
    });
  }

  return { validations, normalizedRows };
}

async function loadBusinessExcellenceSalesforceTftStaging(
  uploadId: string,
  rows: BusinessExcellenceSalesforceTftNormalizedRow[],
) {
  const client = getBigQueryClient();

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_tft\` (
        upload_id STRING,
        row_number INT64,
        territorio STRING,
        territory_normalized STRING,
        territory_owner_name STRING,
        absence_type STRING,
        absence_name STRING,
        days_value NUMERIC,
        start_date_raw STRING,
        end_date_raw STRING,
        period_month DATE,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
  });

  await client.query({
    query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_tft\`
      ADD COLUMN IF NOT EXISTS territory_normalized STRING
    `,
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_tft\`
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
          'business_excellence_salesforce_tft',
          'business_excellence_tft',
          'tft'
        )
          AND u.upload_id != @uploadId
      )
    `,
    params: { uploadId },
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_tft\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId },
  });

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_tft\`
    (
      upload_id,
      row_number,
      territorio,
      territory_normalized,
      territory_owner_name,
      absence_type,
      absence_name,
      days_value,
      start_date_raw,
      end_date_raw,
      period_month,
      source_payload_json,
      normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      row.territorio,
      NULLIF(row.territory_normalized, ''),
      NULLIF(row.territory_owner_name, ''),
      NULLIF(row.absence_type, ''),
      NULLIF(row.absence_name, ''),
      SAFE_CAST(row.days_value AS NUMERIC),
      NULLIF(row.start_date_raw, ''),
      NULLIF(row.end_date_raw, ''),
      DATE(row.period_month),
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
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
            territorio: row.territorio,
            territory_normalized: row.territoryNormalized,
            territory_owner_name: row.territoryOwnerName ?? '',
            absence_type: row.absenceType ?? '',
            absence_name: row.absenceName ?? '',
            days_value: row.daysValue == null ? '' : String(row.daysValue),
            start_date_raw: row.startDateRaw ?? '',
            end_date_raw: row.endDateRaw ?? '',
            period_month: row.periodMonth,
            source_payload_json: JSON.stringify(row.payload),
          })),
        },
      });
    },
    4,
  );
}

function normalizeBusinessExcellenceSalesforceInteractions(rows: RawUploadRow[]) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: BusinessExcellenceSalesforceInteractionNormalizedRow[] = [];

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);
    const errors: string[] = [];

    const interactionId = asNullableString(
      pickValue(index, ['Interaction: Id.', 'Interaction Id', 'Interaction: Call Name', 'Call Name']),
    );
    const onekeyId = asNullableString(
      pickValue(index, ['Cuenta: Código OneKey', 'Cuenta: Codigo OneKey', 'Codigo OneKey', 'Onekey ID']),
    );
    const territory = asNullableString(pickValue(index, ['Territorio', 'Territory']));
    const territoryNormalized = normalizeTerritoryForKey(territory);
    const accountName = asNullableString(
      pickValue(index, ['Cuenta: Nombre de la cuenta', 'Cuenta: Nombre de la Cuenta', 'Account Name']),
    );
    const ownerName = asNullableString(
      pickValue(index, ['Interaction: Nombre del propietario', 'Nombre del propietario', 'Owner Name']),
    );
    const channel = asNullableString(pickValue(index, ['Canal', 'Channel']));
    const visitType = asNullableString(pickValue(index, ['Tipo de visita', 'Visit Type']));
    const interactionDateValue = pickValue(index, ['Fecha y Hora', 'Interaction Date', 'Fecha']);
    const submitDateValue = pickValue(index, ['Fecha de envío', 'Fecha de envio', 'Submission Date', 'Fecha envio']);
    const interactionDateRaw = asNullableString(interactionDateValue);
    const submitDateRaw = asNullableString(submitDateValue);
    const interactionPeriodMonth = parseDateFieldDayFirstNoTimezone(interactionDateValue);
    const submitPeriodMonth = parseDateFieldDayFirstNoTimezone(submitDateValue);

    if (!interactionId) errors.push('Missing required Interaction: Id. / Call Name.');
    if (!onekeyId) errors.push('Missing required Cuenta: Codigo OneKey column.');
    if (!territory) errors.push('Missing required Territorio column.');
    if (!territoryNormalized) errors.push('Could not derive territorio_normalizado from Territorio.');
    if (!interactionPeriodMonth) errors.push('Missing or invalid Fecha y Hora (expected dd/mm/yyyy, hh:mm).');

    const validationStatus: RowValidationResult['validationStatus'] = errors.length > 0 ? 'error' : 'valid';
    validations.push({
      rowNumber: row.row_number,
      validationStatus,
      errors,
    });

    if (validationStatus === 'error') continue;

    normalizedRows.push({
      rowNumber: row.row_number,
      interactionId: interactionId!,
      onekeyId: onekeyId!,
      territory: territory!,
      territoryNormalized: territoryNormalized!,
      accountName,
      ownerName,
      channel,
      visitType,
      interactionDateRaw,
      submitDateRaw,
      interactionPeriodMonth: interactionPeriodMonth!,
      submitPeriodMonth,
      payload,
    });
  }

  return { validations, normalizedRows };
}

async function loadBusinessExcellenceSalesforceInteractionsStaging(
  uploadId: string,
  rows: BusinessExcellenceSalesforceInteractionNormalizedRow[],
) {
  const client = getBigQueryClient();

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_interactions\` (
        upload_id STRING,
        row_number INT64,
        interaction_id STRING,
        onekey_id STRING,
        territory STRING,
        territory_normalized STRING,
        account_name STRING,
        owner_name STRING,
        channel STRING,
        visit_type STRING,
        interaction_date_raw STRING,
        submit_date_raw STRING,
        interaction_period_month DATE,
        submit_period_month DATE,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
  });

  await client.query({
    query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_interactions\`
      ADD COLUMN IF NOT EXISTS territory_normalized STRING
    `,
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_interactions\`
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
          'business_excellence_salesforce_interacciones',
          'business_excellence_interacciones',
          'interacciones'
        )
          AND u.upload_id != @uploadId
      )
    `,
    params: { uploadId },
  });

  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_interactions\`
      WHERE upload_id = @uploadId
    `,
    params: { uploadId },
  });

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_interactions\`
    (
      upload_id,
      row_number,
      interaction_id,
      onekey_id,
      territory,
      territory_normalized,
      account_name,
      owner_name,
      channel,
      visit_type,
      interaction_date_raw,
      submit_date_raw,
      interaction_period_month,
      submit_period_month,
      source_payload_json,
      normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      row.interaction_id,
      row.onekey_id,
      row.territory,
      NULLIF(row.territory_normalized, ''),
      NULLIF(row.account_name, ''),
      NULLIF(row.owner_name, ''),
      NULLIF(row.channel, ''),
      NULLIF(row.visit_type, ''),
      NULLIF(row.interaction_date_raw, ''),
      NULLIF(row.submit_date_raw, ''),
      DATE(row.interaction_period_month),
      IF(row.submit_period_month = '', NULL, DATE(row.submit_period_month)),
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
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
            interaction_id: row.interactionId,
            onekey_id: row.onekeyId,
            territory: row.territory,
            territory_normalized: row.territoryNormalized,
            account_name: row.accountName ?? '',
            owner_name: row.ownerName ?? '',
            channel: row.channel ?? '',
            visit_type: row.visitType ?? '',
            interaction_date_raw: row.interactionDateRaw ?? '',
            submit_date_raw: row.submitDateRaw ?? '',
            interaction_period_month: row.interactionPeriodMonth,
            submit_period_month: row.submitPeriodMonth ?? '',
            source_payload_json: JSON.stringify(row.payload),
          })),
        },
      });
    },
    4,
  );
}

function getIndexedCellsFromPayload(payload: Record<string, unknown>) {
  const indexedCells: Array<{ index: number; value: unknown }> = [];
  for (const [key, value] of Object.entries(payload)) {
    const match = key.match(/^column_(\d+)$/i);
    if (!match) continue;
    const index = Number(match[1]);
    if (!Number.isInteger(index) || index < 1) continue;
    indexedCells.push({ index, value });
  }
  indexedCells.sort((a, b) => a.index - b.index);
  return indexedCells;
}

function getFirstNonEmptyIndexedCell(indexedCells: Array<{ index: number; value: unknown }>) {
  for (const cell of indexedCells) {
    const text = asNullableString(cell.value);
    if (text) return text;
  }
  return null;
}

function parseDsoMonthHeaderRow(indexedCells: Array<{ index: number; value: unknown }>) {
  const firstCell = getFirstNonEmptyIndexedCell(indexedCells);
  if (!firstCell || normalizeText(firstCell) !== 'year') return null;

  let hasYear = false;
  let monthCount = 0;
  const monthByColumnIndex = new Map<number, string>();

  for (const cell of indexedCells) {
    const { index, value } = cell;
    const text = asNullableString(value);
    if (!text) continue;
    const normalized = normalizeText(text);
    if (normalized === 'year') {
      hasYear = true;
      continue;
    }
    const parsedMonth = parseMonthToken(text);
    if (!parsedMonth) continue;
    monthByColumnIndex.set(index, parsedMonth);
    monthCount += 1;
  }

  if (!hasYear || monthCount < 2) return null;
  return monthByColumnIndex;
}

function parseDsoMonthHeaderKeyMap(payload: Record<string, unknown>) {
  const hasYear = Object.values(payload).some((value) => normalizeText(String(value ?? '')) === 'year');
  if (!hasYear) return null;

  const monthPriorityMap = new Map<string, { key: string; priority: number; index: number }>();

  for (const [key, value] of Object.entries(payload)) {
    const text = asNullableString(value);
    if (!text) continue;
    const month = parseMonthToken(text);
    if (!month) continue;

    const columnMatch = key.match(/^column_(\d+)$/i);
    const index = columnMatch ? Number(columnMatch[1]) : Number.MAX_SAFE_INTEGER;
    const priority = columnMatch ? 0 : 1;
    const current = monthPriorityMap.get(month);
    if (!current || priority < current.priority || (priority === current.priority && index < current.index)) {
      monthPriorityMap.set(month, { key, priority, index });
    }
  }

  if (monthPriorityMap.size < 2) return null;
  return monthPriorityMap;
}

function parseDsoYear(indexedCells: Array<{ index: number; value: unknown }>) {
  const firstCell = getFirstNonEmptyIndexedCell(indexedCells);
  if (!firstCell) return null;
  if (!/^\d{4}$/.test(firstCell)) return null;
  const parsed = parseYearToken(firstCell);
  if (parsed && parsed >= 2000 && parsed <= 2200) return parsed;
  return null;
}

function detectDsoGroupName(indexedCells: Array<{ index: number; value: unknown }>) {
  const candidates = new Map<string, string>([
    ['anual general', 'Anual / General'],
    ['b2b privado', 'B2B Privado'],
    ['b2c privado', 'B2C Privado'],
    ['b2c gobierno', 'B2C Gobierno'],
    ['b2b gobierno', 'B2B Gobierno'],
  ]);

  const firstCell = getFirstNonEmptyIndexedCell(indexedCells);
  if (!firstCell) return null;
  const normalized = normalizeText(firstCell.replace(/:$/, ''));
  const matched = candidates.get(normalized);
  if (matched) return matched;

  return null;
}

function normalizeCommercialOperationsDso(rows: RawUploadRow[]) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: CommercialOperationsDsoNormalizedRow[] = [];
  const dedupByGroupPeriod = new Map<string, CommercialOperationsDsoNormalizedRow>();

  let currentGroup: string | null = null;
  let monthByColumnIndex = new Map<number, string>();
  let monthHeaderByMonth = new Map<string, { key: string; priority: number; index: number }>();

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const indexedCells = getIndexedCellsFromPayload(payload);

    if (Object.keys(payload).length === 0 || !hasBusinessContent(payload)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: empty row payload.'],
      });
      continue;
    }

    const monthHeader = parseDsoMonthHeaderRow(indexedCells);
    const monthHeaderKeyMap = parseDsoMonthHeaderKeyMap(payload);
    if (monthHeader && monthHeaderKeyMap) {
      monthByColumnIndex = monthHeader;
      monthHeaderByMonth = monthHeaderKeyMap;
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'valid',
        errors: [],
      });
      continue;
    }

    const detectedGroup = detectDsoGroupName(indexedCells);
    if (detectedGroup) {
      currentGroup = detectedGroup;
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'valid',
        errors: [],
      });
      continue;
    }

    const year = parseDsoYear(indexedCells);
    if (!year) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: row is not a DSO year row.'],
      });
      continue;
    }

    if (!currentGroup) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'error',
        errors: ['Missing DSO group context before year row.'],
      });
      continue;
    }

    if (monthByColumnIndex.size === 0 || monthHeaderByMonth.size === 0) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'error',
        errors: ['Missing DSO month header context before year row.'],
      });
      continue;
    }

    const valueByColumnIndex = new Map<number, unknown>();
    for (const cell of indexedCells) {
      valueByColumnIndex.set(cell.index, cell.value);
    }

    const monthOrder = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    let hasAtLeastOneValue = false;
    const rowValuesByPeriod = new Map<string, number>();
    for (const month of monthOrder) {
      const header = monthHeaderByMonth.get(month);
      if (!header) continue;

      const primaryValue = asNullableNumber(payload[header.key]);
      const fallbackByIndex = header.index !== Number.MAX_SAFE_INTEGER
        ? asNullableNumber(valueByColumnIndex.get(header.index))
        : null;
      const dsoValue = primaryValue ?? fallbackByIndex;
      if (dsoValue == null) continue;
      hasAtLeastOneValue = true;
      rowValuesByPeriod.set(`${year}-${month}-01`, dsoValue);
    }

    for (const [periodMonth, dsoValue] of rowValuesByPeriod.entries()) {
      const normalizedRow: CommercialOperationsDsoNormalizedRow = {
        rowNumber: row.row_number,
        groupName: currentGroup,
        periodMonth,
        dsoValue,
        payload,
      };
      const dedupKey = `${normalizeText(currentGroup)}|${periodMonth}`;
      if (!dedupByGroupPeriod.has(dedupKey)) {
        dedupByGroupPeriod.set(dedupKey, normalizedRow);
      }
    }

    validations.push({
      rowNumber: row.row_number,
      validationStatus: hasAtLeastOneValue ? 'valid' : 'skipped',
      errors: hasAtLeastOneValue ? [] : ['Skipped: year row without numeric DSO month values.'],
    });
  }

  normalizedRows.push(...dedupByGroupPeriod.values());
  return { validations, normalizedRows };
}

async function loadCommercialOperationsDsoStaging(
  uploadId: string,
  rows: CommercialOperationsDsoNormalizedRow[],
) {
  const client = getBigQueryClient();

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_dso\` (
        upload_id STRING,
        row_number INT64,
        group_name STRING,
        period_month DATE,
        dso_value NUMERIC,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
    }),
  );

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_dso\`
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
        WHERE LOWER(TRIM(u.module_code)) IN ('commercial_operations_dso', 'commercial_operations_days_sales_outstanding', 'dso')
          AND u.upload_id != @uploadId
      )
    `,
      params: { uploadId },
    }),
  );

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_dso\`
      WHERE upload_id = @uploadId
    `,
      params: { uploadId },
    }),
  );

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_dso\`
    (
      upload_id,
      row_number,
      group_name,
      period_month,
      dso_value,
      source_payload_json,
      normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      NULLIF(row.group_name, ''),
      DATE(row.period_month),
      SAFE_CAST(row.dso_value AS NUMERIC),
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItems(rows, 1800);
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await runQueryWithRetryOnConcurrentUpdate(() =>
        client.query({
          query,
          params: {
            uploadId,
            rows: chunk.map((row) => ({
              row_number: row.rowNumber,
              group_name: row.groupName,
              period_month: row.periodMonth,
              dso_value: String(row.dsoValue),
              source_payload_json: JSON.stringify(row.payload),
            })),
          },
        }),
      );
    },
    1,
  );
}

function normalizeCommercialOperationsStocks(rows: RawUploadRow[]) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: CommercialOperationsStocksNormalizedRow[] = [];
  const dedup = new Map<string, CommercialOperationsStocksNormalizedRow>();

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    if (Object.keys(payload).length === 0 || !hasBusinessContent(payload)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: empty row payload.'],
      });
      continue;
    }

    const index = buildPayloadIndex(payload);
    const sourceProductRaw = asNullableString(
      pickValue(index, ['Producto', 'product', 'producto']),
    );
    if (!sourceProductRaw) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: missing product name in "Producto" column.'],
      });
      continue;
    }

    const normalizedProduct = normalizeText(sourceProductRaw);
    if (['total', 'subtotal', 'totales'].includes(normalizedProduct)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: total/subtotal row.'],
      });
      continue;
    }

    const businessType = asNullableString(pickValue(index, ['Tipo Neg', 'Tipo Negocio', 'tipo_neg']));
    const market = asNullableString(pickValue(index, ['Mercado', 'market']));
    const businessUnit = asNullableString(pickValue(index, ['BU', 'Business Unit', 'Unidad de Negocio']));
    const clientInstitution = asNullableString(
      pickValue(index, ['Cliente / Institucion', 'Cliente / Institución', 'Cliente', 'Institucion']),
    );
    const stockType = asNullableString(pickValue(index, ['Tipo', 'Type']));

    let valueCount = 0;
    for (const [key, rawValue] of Object.entries(payload)) {
      if (key.toLowerCase().startsWith('column_')) continue;
      const periodMonth = parseMonthHeaderFlexible(key);
      if (!periodMonth) continue;
      const stockValue = asNullableNumber(rawValue);
      if (stockValue == null) continue;

      valueCount += 1;
      const normalizedRow: CommercialOperationsStocksNormalizedRow = {
        rowNumber: row.row_number,
        businessType,
        market,
        businessUnit,
        clientInstitution,
        stockType,
        sourceProductRaw,
        sourceProductNormalized: normalizedProduct,
        periodMonth,
        stockValue,
        payload,
      };
      const dedupKey = [
        periodMonth,
        normalizeText(businessType ?? ''),
        normalizeText(market ?? ''),
        normalizeText(businessUnit ?? ''),
        normalizeText(clientInstitution ?? ''),
        normalizeText(stockType ?? ''),
        normalizedProduct,
      ].join('|');
      if (!dedup.has(dedupKey)) dedup.set(dedupKey, normalizedRow);
    }

    validations.push({
      rowNumber: row.row_number,
      validationStatus: valueCount > 0 ? 'valid' : 'skipped',
      errors: valueCount > 0 ? [] : ['Skipped: no monthly stock values found in month columns.'],
    });
  }

  normalizedRows.push(...dedup.values());
  return { validations, normalizedRows };
}

async function loadCommercialOperationsStocksStaging(
  uploadId: string,
  rows: CommercialOperationsStocksNormalizedRow[],
) {
  const client = getBigQueryClient();

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_stocks\` (
        upload_id STRING,
        row_number INT64,
        business_type STRING,
        market STRING,
        business_unit STRING,
        client_institution STRING,
        stock_type STRING,
        source_product_raw STRING,
        source_product_normalized STRING,
        period_month DATE,
        stock_value NUMERIC,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
    }),
  );

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_stocks\`
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
        WHERE LOWER(TRIM(u.module_code)) IN ('commercial_operations_stocks', 'stocks')
          AND u.upload_id != @uploadId
      )
    `,
      params: { uploadId },
    }),
  );

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_stocks\`
      WHERE upload_id = @uploadId
    `,
      params: { uploadId },
    }),
  );

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_stocks\`
    (
      upload_id,
      row_number,
      business_type,
      market,
      business_unit,
      client_institution,
      stock_type,
      source_product_raw,
      source_product_normalized,
      period_month,
      stock_value,
      source_payload_json,
      normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      NULLIF(row.business_type, ''),
      NULLIF(row.market, ''),
      NULLIF(row.business_unit, ''),
      NULLIF(row.client_institution, ''),
      NULLIF(row.stock_type, ''),
      row.source_product_raw,
      row.source_product_normalized,
      DATE(row.period_month),
      SAFE_CAST(row.stock_value AS NUMERIC),
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItems(rows, 1800);
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await runQueryWithRetryOnConcurrentUpdate(() =>
        client.query({
          query,
          params: {
            uploadId,
            rows: chunk.map((row) => ({
              row_number: row.rowNumber,
              business_type: row.businessType ?? '',
              market: row.market ?? '',
              business_unit: row.businessUnit ?? '',
              client_institution: row.clientInstitution ?? '',
              stock_type: row.stockType ?? '',
              source_product_raw: row.sourceProductRaw,
              source_product_normalized: row.sourceProductNormalized,
              period_month: row.periodMonth,
              stock_value: String(row.stockValue),
              source_payload_json: JSON.stringify(row.payload),
            })),
          },
        }),
      );
    },
    1,
  );
}

function normalizeCommercialOperationsDeliveryOrders(
  rows: RawUploadRow[],
  moduleCode: string,
) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: CommercialOperationsDeliveryOrdersNormalizedRow[] = [];
  const dedup = new Map<string, CommercialOperationsDeliveryOrdersNormalizedRow>();
  const orderScope: 'government' | 'private' =
    moduleCode === 'commercial_operations_private_orders' || moduleCode === 'private_orders'
      ? 'private'
      : 'government';

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    if (Object.keys(payload).length === 0 || !hasBusinessContent(payload)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: empty row payload.'],
      });
      continue;
    }

    const index = buildPayloadIndex(payload);
    const sourceProductRaw = asNullableString(
      pickValue(index, ['Producto', 'product', 'producto']),
    );
    if (!sourceProductRaw) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: missing product name in "Producto" column.'],
      });
      continue;
    }

    const sourceProductNormalized = normalizeText(sourceProductRaw);
    if (['total', 'subtotal', 'totales'].includes(sourceProductNormalized)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: total/subtotal row.'],
      });
      continue;
    }

    const businessType = asNullableString(pickValue(index, ['Tipo Neg', 'Tipo Negocio', 'tipo_neg']));
    const market = asNullableString(pickValue(index, ['Mercado', 'market']));
    const businessUnit = asNullableString(pickValue(index, ['BU', 'Business Unit', 'Unidad de Negocio']));
    const clientInstitution = asNullableString(
      pickValue(index, ['Cliente / Institucion', 'Cliente / InstituciÃ³n', 'Cliente', 'Institucion']),
    );
    const orderType = asNullableString(pickValue(index, ['Tipo', 'Type']));

    let valueCount = 0;
    for (const [key, rawValue] of Object.entries(payload)) {
      if (key.toLowerCase().startsWith('column_')) continue;
      const periodMonth = parseMonthHeaderFlexible(key);
      if (!periodMonth) continue;
      const orderValue = asNullableNumber(rawValue);
      if (orderValue == null) continue;

      valueCount += 1;
      const normalizedRow: CommercialOperationsDeliveryOrdersNormalizedRow = {
        rowNumber: row.row_number,
        orderScope,
        businessType,
        market,
        businessUnit,
        clientInstitution,
        orderType,
        sourceProductRaw,
        sourceProductNormalized,
        periodMonth,
        orderValue,
        payload,
      };

      const dedupKey = [
        orderScope,
        periodMonth,
        normalizeText(businessType ?? ''),
        normalizeText(market ?? ''),
        normalizeText(businessUnit ?? ''),
        normalizeText(clientInstitution ?? ''),
        normalizeText(orderType ?? ''),
        sourceProductNormalized,
      ].join('|');
      if (!dedup.has(dedupKey)) dedup.set(dedupKey, normalizedRow);
    }

    validations.push({
      rowNumber: row.row_number,
      validationStatus: valueCount > 0 ? 'valid' : 'skipped',
      errors: valueCount > 0 ? [] : ['Skipped: no monthly order values found in month columns.'],
    });
  }

  normalizedRows.push(...dedup.values());
  return { validations, normalizedRows };
}

function normalizeCommercialOperationsDeliveryOrdersV2(
  rows: RawUploadRow[],
  moduleCode: string,
) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: CommercialOperationsDeliveryOrdersNormalizedRow[] = [];
  const dedup = new Map<string, CommercialOperationsDeliveryOrdersNormalizedRow>();
  const orderScope: 'government' | 'private' =
    moduleCode === 'commercial_operations_private_orders' || moduleCode === 'private_orders'
      ? 'private'
      : 'government';

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    if (Object.keys(payload).length === 0 || !hasBusinessContent(payload)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: empty row payload.'],
      });
      continue;
    }

    const index = buildPayloadIndex(payload);
    const sourceProductRaw = asNullableString(
      pickValue(index, ['MEDICAMENTO', 'Producto', 'product', 'producto']),
    );
    if (!sourceProductRaw) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: missing product in MEDICAMENTO/PRODUCTO column.'],
      });
      continue;
    }

    const sourceProductNormalized = normalizeText(sourceProductRaw);
    if (['total', 'subtotal', 'totales'].includes(sourceProductNormalized)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: total/subtotal row.'],
      });
      continue;
    }

    const fechaPedidoSapMonth = parseDateFieldMonthFirst(
      pickValue(index, ['FECHA PEDIDO SAP', 'Fecha Pedido SAP']),
    );
    const fechaPedidoMonth = parseDateFieldMonthFirst(
      pickValue(index, ['FECHA DE PEDIDO', 'Fecha de Pedido']),
    );
    const periodMonth = fechaPedidoSapMonth ?? fechaPedidoMonth;
    if (!periodMonth) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: missing FECHA PEDIDO SAP / FECHA DE PEDIDO.'],
      });
      continue;
    }

    const cantidadTotalPedido = asNullableQuantityNumber(pickValue(index, ['CANTIDAD TOTAL DEL PEDIDO']));
    const confirmadas = asNullableQuantityNumber(pickValue(index, ['CONFIRMADAS']));
    const cantidadSuministrada = asNullableQuantityNumber(pickValue(index, ['CANTIDAD SUMINISTRADA']));
    const cantidadEntregada = asNullableQuantityNumber(pickValue(index, ['CANTIDAD ENTREGADA']));
    const cantidadFacturada = asNullableQuantityNumber(pickValue(index, ['CANTIDAD FACTURADA']));
    const orderValue =
      cantidadEntregada ??
      cantidadSuministrada ??
      confirmadas ??
      cantidadTotalPedido ??
      cantidadFacturada;

    const normalizedRow: CommercialOperationsDeliveryOrdersNormalizedRow = {
      rowNumber: row.row_number,
      orderScope,
      businessType: asNullableString(pickValue(index, ['Tipo Neg', 'Tipo Negocio', 'tipo_neg'])),
      market: asNullableString(pickValue(index, ['MERCADO', 'Mercado', 'market'])),
      businessUnit: asNullableString(pickValue(index, ['BU', 'Business Unit', 'Unidad de Negocio'])),
      unidadNegocioChiesi: asNullableString(
        pickValue(index, ['Unidad de Negocio CHIESI', 'UNIDAD DE NEGOCIO CHIESI']),
      ),
      clientInstitution: asNullableString(
        pickValue(index, ['Cliente / Institucion', 'Cliente / Institución', 'Cliente', 'Institucion', 'Solicitante']),
      ),
      orderType: asNullableString(pickValue(index, ['Tipo', 'Type', 'TIPO DE ENTREGA'])),
      documentNumber: asNullableString(pickValue(index, ['DOCUMENTO'])),
      contractNumber: asNullableString(pickValue(index, ['CONTRATO'])),
      customerOrderNumber: asNullableString(
        pickValue(index, ['PEDIDO CLIENTE ORDEN REPOSICIÓN', 'PEDIDO CLIENTE ORDEN REPOSICION']),
      ),
      salesDocument: asNullableString(pickValue(index, ['DOCUMENTO DE VENTA'])),
      salesDocumentPosition: asNullableString(
        pickValue(index, ['POSICIÓN DOCUMENTO VENTA', 'POSICION DOCUMENTO VENTA']),
      ),
      sku: asNullableString(pickValue(index, ['SKU'])),
      ccb: asNullableString(pickValue(index, ['CCB'])),
      laboratory: asNullableString(pickValue(index, ['LABORATORIO'])),
      status: asNullableString(pickValue(index, ['STATUS'])),
      orderStatus: asNullableString(pickValue(index, ['Estado Pedido', 'ESTADO PEDIDO'])),
      rejectionReason: asNullableString(pickValue(index, ['MOTIVO DE RECHAZO'])),
      deliveryId: asNullableString(pickValue(index, ['ID DELIVERY'])),
      deliveryPoint: asNullableString(pickValue(index, ['PUNTO DE ENTREGA'])),
      recipient: asNullableString(pickValue(index, ['DESTINATARIO'])),
      clues: asNullableString(pickValue(index, ['CLUES'])),
      fechaPedidoSapMonth,
      fechaPedidoMonth,
      fechaCreacionDeliveryMonth: parseDateFieldMonthFirst(
        pickValue(index, ['FECHA CREACIÓN DELIVERY', 'FECHA CREACION DELIVERY']),
      ),
      fechaSalidaMercanciaMonth: parseDateFieldMonthFirst(
        pickValue(index, ['FECHA SALIDA DE MERCANCIA']),
      ),
      fechaMaximaEntregaMonth: parseDateFieldMonthFirst(
        pickValue(index, ['FECHA MÁXIMA DE ENTREGA', 'FECHA MAXIMA DE ENTREGA']),
      ),
      fechaConfirmacionEntregaMonth: parseDateFieldMonthFirst(
        pickValue(index, ['FECHA CONFIRMACIÓN ENTREGA', 'FECHA CONFIRMACION ENTREGA', 'FECHA ENTREGA MCIA.']),
      ),
      tiempoEntregaDiasNaturales: asNullableNumber(
        pickValue(index, ['TIEMPO ENTREGA DÍAS NATURALES', 'TIEMPO ENTREGA DIAS NATURALES']),
      ),
      entregaVsVencimientoDiasNaturales: asNullableNumber(
        pickValue(index, ['ENTREGA VS VENCIMIENTO DÍAS NATURALES', 'ENTREGA VS VENCIMIENTO DIAS NATURALES']),
      ),
      precioUnitario: asNullableNumber(pickValue(index, ['PRECIO UNITARIO'])),
      importe: asNullableNumber(pickValue(index, ['IMPORTE'])),
      cantidadTotalPedido,
      confirmadas,
      cantidadSuministrada,
      cantidadEntregada,
      cantidadFacturada,
      sancion: asNullableString(pickValue(index, ['SANCIÓN', 'SANCION'])),
      montoSancion: asNullableNumber(pickValue(index, ['MONTO SANCIÓN', 'MONTO SANCION'])),
      facturadoChiesi: asNullableString(pickValue(index, ['FACTURADO CHIESI'])),
      cuentaDias: asNullableNumber(pickValue(index, ['CUENTA DÍAS', 'CUENTA DIAS'])),
      precioReal: asNullableNumber(pickValue(index, ['PRECIO REAL'])),
      cantidadFacturadaChiesi: asNullableNumber(pickValue(index, ['CANTIDAD FACTURADA CHIESI'])),
      montoFacturadoChiesi: asNullableNumber(pickValue(index, ['MONTO FACTURADO CHIESI'])),
      tipoEntrega: asNullableString(pickValue(index, ['TIPO DE ENTREGA'])),
      cpm: asNullableString(pickValue(index, ['CPM'])),
      posiblesCanjes: asNullableNumber(pickValue(index, ['POSIBLES CANJES'])),
      sourceProductRaw,
      sourceProductNormalized,
      periodMonth,
      orderValue,
      payload,
    };

    const dedupKey = [
      orderScope,
      periodMonth,
      normalizeText(normalizedRow.documentNumber ?? ''),
      normalizeText(normalizedRow.contractNumber ?? ''),
      normalizeText(normalizedRow.customerOrderNumber ?? ''),
      normalizeText(normalizedRow.deliveryId ?? ''),
      normalizeText(normalizedRow.salesDocument ?? ''),
      normalizeText(normalizedRow.salesDocumentPosition ?? ''),
      sourceProductNormalized,
      normalizeText(normalizedRow.sku ?? ''),
      normalizeText(normalizedRow.clientInstitution ?? ''),
    ].join('|');
    if (!dedup.has(dedupKey)) dedup.set(dedupKey, normalizedRow);

    validations.push({
      rowNumber: row.row_number,
      validationStatus: 'valid',
      errors: [],
    });
  }

  normalizedRows.push(...dedup.values());
  return { validations, normalizedRows };
}

async function loadCommercialOperationsDeliveryOrdersStaging(
  uploadId: string,
  rows: CommercialOperationsDeliveryOrdersNormalizedRow[],
  moduleCode: string,
) {
  const client = getBigQueryClient();
  const moduleCodesToReplace =
    moduleCode === 'commercial_operations_private_orders' || moduleCode === 'private_orders'
      ? ['commercial_operations_private_orders', 'private_orders']
      : ['commercial_operations_government_orders', 'government_orders'];

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_delivery_orders\` (
        upload_id STRING,
        row_number INT64,
        order_scope STRING,
        business_type STRING,
        market STRING,
        business_unit STRING,
        unidad_negocio_chiesi STRING,
        client_institution STRING,
        order_type STRING,
        document_number STRING,
        contract_number STRING,
        customer_order_number STRING,
        sales_document STRING,
        sales_document_position STRING,
        sku STRING,
        ccb STRING,
        laboratory STRING,
        status STRING,
        order_status STRING,
        rejection_reason STRING,
        delivery_id STRING,
        delivery_point STRING,
        recipient STRING,
        clues STRING,
        fecha_pedido_sap_month DATE,
        fecha_pedido_month DATE,
        fecha_creacion_delivery_month DATE,
        fecha_salida_mercancia_month DATE,
        fecha_maxima_entrega_month DATE,
        fecha_confirmacion_entrega_month DATE,
        tiempo_entrega_dias_naturales NUMERIC,
        entrega_vs_vencimiento_dias_naturales NUMERIC,
        precio_unitario NUMERIC,
        importe NUMERIC,
        cantidad_total_pedido NUMERIC,
        confirmadas NUMERIC,
        cantidad_suministrada NUMERIC,
        cantidad_entregada NUMERIC,
        cantidad_facturada NUMERIC,
        sancion STRING,
        monto_sancion NUMERIC,
        facturado_chiesi STRING,
        cuenta_dias NUMERIC,
        precio_real NUMERIC,
        cantidad_facturada_chiesi NUMERIC,
        monto_facturado_chiesi NUMERIC,
        tipo_entrega STRING,
        cpm STRING,
        posibles_canjes NUMERIC,
        source_product_raw STRING,
        source_product_normalized STRING,
        period_month DATE,
        order_value NUMERIC,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
    }),
  );

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_delivery_orders\`
      ADD COLUMN IF NOT EXISTS unidad_negocio_chiesi STRING
    `,
    }),
  );
  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_delivery_orders\`
      ADD COLUMN IF NOT EXISTS fecha_pedido_sap_month DATE
    `,
    }),
  );
  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_delivery_orders\`
      ADD COLUMN IF NOT EXISTS cantidad_entregada NUMERIC
    `,
    }),
  );
  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_delivery_orders\`
      ADD COLUMN IF NOT EXISTS cantidad_facturada NUMERIC
    `,
    }),
  );
  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_delivery_orders\`
      ADD COLUMN IF NOT EXISTS tiempo_entrega_dias_naturales NUMERIC
    `,
    }),
  );
  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_delivery_orders\`
      ADD COLUMN IF NOT EXISTS entrega_vs_vencimiento_dias_naturales NUMERIC
    `,
    }),
  );

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_delivery_orders\`
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
        WHERE LOWER(TRIM(u.module_code)) IN UNNEST(@moduleCodes)
          AND u.upload_id != @uploadId
      )
    `,
      params: { uploadId, moduleCodes: moduleCodesToReplace },
    }),
  );

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_delivery_orders\`
      WHERE upload_id = @uploadId
    `,
      params: { uploadId },
    }),
  );

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_delivery_orders\`
    (
      upload_id,
      row_number,
      order_scope,
      business_type,
      market,
      business_unit,
      unidad_negocio_chiesi,
      client_institution,
      order_type,
      document_number,
      contract_number,
      customer_order_number,
      sales_document,
      sales_document_position,
      sku,
      ccb,
      laboratory,
      status,
      order_status,
      rejection_reason,
      delivery_id,
      delivery_point,
      recipient,
      clues,
      fecha_pedido_sap_month,
      fecha_pedido_month,
      fecha_creacion_delivery_month,
      fecha_salida_mercancia_month,
      fecha_maxima_entrega_month,
      fecha_confirmacion_entrega_month,
      tiempo_entrega_dias_naturales,
      entrega_vs_vencimiento_dias_naturales,
      precio_unitario,
      importe,
      cantidad_total_pedido,
      confirmadas,
      cantidad_suministrada,
      cantidad_entregada,
      cantidad_facturada,
      sancion,
      monto_sancion,
      facturado_chiesi,
      cuenta_dias,
      precio_real,
      cantidad_facturada_chiesi,
      monto_facturado_chiesi,
      tipo_entrega,
      cpm,
      posibles_canjes,
      source_product_raw,
      source_product_normalized,
      period_month,
      order_value,
      source_payload_json,
      normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      row.order_scope,
      NULLIF(row.business_type, ''),
      NULLIF(row.market, ''),
      NULLIF(row.business_unit, ''),
      NULLIF(row.unidad_negocio_chiesi, ''),
      NULLIF(row.client_institution, ''),
      NULLIF(row.order_type, ''),
      NULLIF(row.document_number, ''),
      NULLIF(row.contract_number, ''),
      NULLIF(row.customer_order_number, ''),
      NULLIF(row.sales_document, ''),
      NULLIF(row.sales_document_position, ''),
      NULLIF(row.sku, ''),
      NULLIF(row.ccb, ''),
      NULLIF(row.laboratory, ''),
      NULLIF(row.status, ''),
      NULLIF(row.order_status, ''),
      NULLIF(row.rejection_reason, ''),
      NULLIF(row.delivery_id, ''),
      NULLIF(row.delivery_point, ''),
      NULLIF(row.recipient, ''),
      NULLIF(row.clues, ''),
      IF(row.fecha_pedido_sap_month = '', NULL, DATE(row.fecha_pedido_sap_month)),
      IF(row.fecha_pedido_month = '', NULL, DATE(row.fecha_pedido_month)),
      IF(row.fecha_creacion_delivery_month = '', NULL, DATE(row.fecha_creacion_delivery_month)),
      IF(row.fecha_salida_mercancia_month = '', NULL, DATE(row.fecha_salida_mercancia_month)),
      IF(row.fecha_maxima_entrega_month = '', NULL, DATE(row.fecha_maxima_entrega_month)),
      IF(row.fecha_confirmacion_entrega_month = '', NULL, DATE(row.fecha_confirmacion_entrega_month)),
      SAFE_CAST(row.tiempo_entrega_dias_naturales AS NUMERIC),
      SAFE_CAST(row.entrega_vs_vencimiento_dias_naturales AS NUMERIC),
      SAFE_CAST(row.precio_unitario AS NUMERIC),
      SAFE_CAST(row.importe AS NUMERIC),
      SAFE_CAST(row.cantidad_total_pedido AS NUMERIC),
      SAFE_CAST(row.confirmadas AS NUMERIC),
      SAFE_CAST(row.cantidad_suministrada AS NUMERIC),
      SAFE_CAST(row.cantidad_entregada AS NUMERIC),
      SAFE_CAST(row.cantidad_facturada AS NUMERIC),
      NULLIF(row.sancion, ''),
      SAFE_CAST(row.monto_sancion AS NUMERIC),
      NULLIF(row.facturado_chiesi, ''),
      SAFE_CAST(row.cuenta_dias AS NUMERIC),
      SAFE_CAST(row.precio_real AS NUMERIC),
      SAFE_CAST(row.cantidad_facturada_chiesi AS NUMERIC),
      SAFE_CAST(row.monto_facturado_chiesi AS NUMERIC),
      NULLIF(row.tipo_entrega, ''),
      NULLIF(row.cpm, ''),
      SAFE_CAST(row.posibles_canjes AS NUMERIC),
      row.source_product_raw,
      row.source_product_normalized,
      DATE(row.period_month),
      SAFE_CAST(row.order_value AS NUMERIC),
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItems(rows, 1800);
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await runQueryWithRetryOnConcurrentUpdate(() =>
        client.query({
          query,
          params: {
            uploadId,
            rows: chunk.map((row) => ({
              row_number: row.rowNumber,
              order_scope: row.orderScope,
              business_type: row.businessType ?? '',
              market: row.market ?? '',
              business_unit: row.businessUnit ?? '',
              unidad_negocio_chiesi: row.unidadNegocioChiesi ?? '',
              client_institution: row.clientInstitution ?? '',
              order_type: row.orderType ?? '',
              document_number: row.documentNumber ?? '',
              contract_number: row.contractNumber ?? '',
              customer_order_number: row.customerOrderNumber ?? '',
              sales_document: row.salesDocument ?? '',
              sales_document_position: row.salesDocumentPosition ?? '',
              sku: row.sku ?? '',
              ccb: row.ccb ?? '',
              laboratory: row.laboratory ?? '',
              status: row.status ?? '',
              order_status: row.orderStatus ?? '',
              rejection_reason: row.rejectionReason ?? '',
              delivery_id: row.deliveryId ?? '',
              delivery_point: row.deliveryPoint ?? '',
              recipient: row.recipient ?? '',
              clues: row.clues ?? '',
              fecha_pedido_sap_month: row.fechaPedidoSapMonth ?? '',
              fecha_pedido_month: row.fechaPedidoMonth ?? '',
              fecha_creacion_delivery_month: row.fechaCreacionDeliveryMonth ?? '',
              fecha_salida_mercancia_month: row.fechaSalidaMercanciaMonth ?? '',
              fecha_maxima_entrega_month: row.fechaMaximaEntregaMonth ?? '',
              fecha_confirmacion_entrega_month: row.fechaConfirmacionEntregaMonth ?? '',
              tiempo_entrega_dias_naturales:
                row.tiempoEntregaDiasNaturales == null ? '' : String(row.tiempoEntregaDiasNaturales),
              entrega_vs_vencimiento_dias_naturales:
                row.entregaVsVencimientoDiasNaturales == null ? '' : String(row.entregaVsVencimientoDiasNaturales),
              precio_unitario: row.precioUnitario == null ? '' : String(row.precioUnitario),
              importe: row.importe == null ? '' : String(row.importe),
              cantidad_total_pedido: row.cantidadTotalPedido == null ? '' : String(row.cantidadTotalPedido),
              confirmadas: row.confirmadas == null ? '' : String(row.confirmadas),
              cantidad_suministrada: row.cantidadSuministrada == null ? '' : String(row.cantidadSuministrada),
              cantidad_entregada: row.cantidadEntregada == null ? '' : String(row.cantidadEntregada),
              cantidad_facturada: row.cantidadFacturada == null ? '' : String(row.cantidadFacturada),
              sancion: row.sancion ?? '',
              monto_sancion: row.montoSancion == null ? '' : String(row.montoSancion),
              facturado_chiesi: row.facturadoChiesi ?? '',
              cuenta_dias: row.cuentaDias == null ? '' : String(row.cuentaDias),
              precio_real: row.precioReal == null ? '' : String(row.precioReal),
              cantidad_facturada_chiesi:
                row.cantidadFacturadaChiesi == null ? '' : String(row.cantidadFacturadaChiesi),
              monto_facturado_chiesi:
                row.montoFacturadoChiesi == null ? '' : String(row.montoFacturadoChiesi),
              tipo_entrega: row.tipoEntrega ?? '',
              cpm: row.cpm ?? '',
              posibles_canjes: row.posiblesCanjes == null ? '' : String(row.posiblesCanjes),
              source_product_raw: row.sourceProductRaw,
              source_product_normalized: row.sourceProductNormalized,
              period_month: row.periodMonth,
              order_value: row.orderValue == null ? '' : String(row.orderValue),
              source_payload_json: JSON.stringify(row.payload),
            })),
          },
        }),
      );
    },
    1,
  );
}

function normalizeCommercialOperationsGovernmentContractProgress(rows: RawUploadRow[]) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: CommercialOperationsGovernmentContractProgressNormalizedRow[] = [];

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    if (Object.keys(payload).length === 0 || !hasBusinessContent(payload)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: empty row payload.'],
      });
      continue;
    }

    const index = buildPayloadIndex(payload);
    const sourceProductRaw = asNullableString(
      pickValue(index, ['PRODUCTO', 'Producto', 'product', 'producto']),
    );
    if (!sourceProductRaw) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: missing product in "PRODUCTO" column.'],
      });
      continue;
    }

    const sourceProductNormalized = normalizeText(sourceProductRaw);
    if (['total', 'subtotal', 'totales'].includes(sourceProductNormalized)) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: total/subtotal row.'],
      });
      continue;
    }

    const contractKey = asNullableString(pickValue(index, ['LLAVE', 'Llave', 'Key']));
    const contractType = asNullableString(pickValue(index, ['TIPO DE CONTRATO', 'Tipo de Contrato']));
    const vigencia = asNullableString(pickValue(index, ['VIGENCIA', 'Vigencia']));
    const category = asNullableString(pickValue(index, ['CATEGORIA', 'Categoría', 'Categoria']));
    const responsible = asNullableString(pickValue(index, ['RESPONSABLE', 'Responsable']));
    const cbCode = asNullableString(pickValue(index, ['CLAVE DE CB', 'Clave de CB']));
    const tenderNumber = asNullableString(
      pickValue(index, ['NO DE LICITACIÓN/PROCEDIMIENTO', 'NO DE LICITACION/PROCEDIMIENTO']),
    );
    const contractNumber = asNullableString(pickValue(index, ['NUMERO DE CONTRATO', 'NÚMERO DE CONTRATO']));
    const eventType = asNullableString(pickValue(index, ['TIPO DE EVENTO', 'Tipo de Evento']));
    const centralizedOpd = asNullableString(pickValue(index, ['CENTRALIZADO / OPD', 'CENTRALIZADO/OPD']));
    const centralInstitution = asNullableString(pickValue(index, ['INSTITUCIÓN CENTRAL', 'INSTITUCION CENTRAL']));
    const institution = asNullableString(pickValue(index, ['INSTITUCIÓN', 'INSTITUCION']));
    const assignedTo = asNullableString(pickValue(index, ['CONTRATO ASIGNADO A', 'Contrato Asignado A']));
    const businessModel = asNullableString(pickValue(index, ['MODELO DE NEGOCIO', 'Modelo de Negocio']));
    const assignmentStatus = asNullableString(pickValue(index, ['Estatus de Asignacion', 'Estatus de Asignación']));
    const businessUnit = asNullableString(pickValue(index, ['UNIDAD DE NEGOCIO', 'Unidad de Negocio', 'BU']));
    const total2025 = asNullableQuantityNumber(pickValue(index, ['TOTAL 2025']));
    const total2026 = asNullableQuantityNumber(pickValue(index, ['TOTAL 2026']));
    const maxQuantity2025 = asNullableQuantityNumber(
      pickValue(index, ['CANTIDAD MÁXIMA 2025', 'CANTIDAD MAXIMA 2025']),
    );
    const maxQuantity2026 = asNullableQuantityNumber(
      pickValue(index, ['CANTIDAD MÁXIMA 2026', 'CANTIDAD MAXIMA 2026']),
    );
    const total2025_2026 = asNullableQuantityNumber(pickValue(index, ['TOTAL 2025-2026']));
    const progressPctTotal = asNullableNumber(
      pickValue(index, ['PORCENTAJE DE AVANCE TOTAL DEL CONTRATO']),
    );
    const progressPct2025 = asNullableNumber(pickValue(index, ['PORCENTAJE DE AVANCE 2025']));
    const progressPct2026 = asNullableNumber(pickValue(index, ['PORCENTAJE DE AVANCE 2026']));
    const contractTotalQuantity = asNullableQuantityNumber(
      pickValue(index, ['CANTIDAD TOTAL DEL CONTRATO']),
    );
    const maxQuantity2025ByHeader = asNullableQuantityNumber(
      pickPayloadContractQuantityByYear(payload, 2025) ??
      pickPayloadValueByExactNormalizedHeader(payload, 'cantidad maxima 2025'),
    );
    const maxQuantity2026ByHeader = asNullableQuantityNumber(
      pickPayloadContractQuantityByYear(payload, 2026) ??
      pickPayloadValueByExactNormalizedHeader(payload, 'cantidad maxima 2026'),
    );
    const total2025_2026ByHeader = asNullableQuantityNumber(
      pickPayloadValueByExactNormalizedHeader(payload, 'total 2025 2026'),
    );
    const contractTotalByHeader = asNullableQuantityNumber(
      pickPayloadValueByExactNormalizedHeader(payload, 'cantidad total del contrato'),
    );

    const resolvedMaxQuantity2025 = maxQuantity2025ByHeader ?? maxQuantity2025;
    const resolvedMaxQuantity2026 = maxQuantity2026ByHeader ?? maxQuantity2026;
    const resolvedTotal2025_2026 = total2025_2026ByHeader ?? total2025_2026;
    const resolvedMaxContractQuantity = contractTotalByHeader ?? contractTotalQuantity;

    const periodValues = new Map<string, number>();
    for (const [key, rawValue] of Object.entries(payload)) {
      if (key.toLowerCase().startsWith('column_')) continue;
      const periodMonth = parseMonthHeaderWithExcelSerial(key);
      if (!periodMonth) continue;
      const deliveredQuantity = asNullableQuantityNumber(rawValue);
      if (deliveredQuantity == null) continue;
      const existing = periodValues.get(periodMonth);
      if (existing == null) {
        periodValues.set(periodMonth, deliveredQuantity);
      } else {
        // If the same month appears twice in one row (different header renderings),
        // keep a single value and prefer the one with larger magnitude.
        if (Math.abs(deliveredQuantity) > Math.abs(existing)) {
          periodValues.set(periodMonth, deliveredQuantity);
        }
      }
    }

    for (const [periodMonth, deliveredQuantity] of periodValues.entries()) {
      const normalizedRow: CommercialOperationsGovernmentContractProgressNormalizedRow = {
        rowNumber: row.row_number,
        contractKey,
        contractType,
        vigencia,
        category,
        responsible,
        cbCode,
        sourceProductRaw,
        sourceProductNormalized,
        tenderNumber,
        contractNumber,
        eventType,
        centralizedOpd,
        centralInstitution,
        institution,
        assignedTo,
        businessModel,
        assignmentStatus,
        businessUnit,
        periodMonth,
        deliveredQuantity,
        maxQuantity2025: resolvedMaxQuantity2025,
        maxQuantity2026: resolvedMaxQuantity2026,
        total2025,
        total2026,
        total2025_2026: resolvedTotal2025_2026,
        progressPctTotal,
        progressPct2025,
        progressPct2026,
        maxContractQuantity: resolvedMaxContractQuantity,
        contractTotalQuantity: resolvedMaxContractQuantity ?? contractTotalQuantity,
        payload,
      };
      normalizedRows.push(normalizedRow);
    }

    validations.push({
      rowNumber: row.row_number,
      validationStatus: periodValues.size > 0 ? 'valid' : 'skipped',
      errors:
        periodValues.size > 0
          ? []
          : ['Skipped: no monthly delivered values were found in period columns.'],
    });
  }

  return { validations, normalizedRows };
}

async function loadCommercialOperationsGovernmentContractProgressStaging(
  uploadId: string,
  rows: CommercialOperationsGovernmentContractProgressNormalizedRow[],
) {
  const client = getBigQueryClient();

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_government_contract_progress\` (
        upload_id STRING,
        row_number INT64,
        contract_key STRING,
        contract_type STRING,
        vigencia STRING,
        category STRING,
        responsible STRING,
        cb_code STRING,
        source_product_raw STRING,
        source_product_normalized STRING,
        tender_number STRING,
        contract_number STRING,
        event_type STRING,
        centralized_opd STRING,
        central_institution STRING,
        institution STRING,
        assigned_to STRING,
        business_model STRING,
        assignment_status STRING,
        business_unit STRING,
        period_month DATE,
        delivered_quantity NUMERIC,
        max_quantity_2025 NUMERIC,
        max_quantity_2026 NUMERIC,
        total_2025 NUMERIC,
        total_2026 NUMERIC,
        total_2025_2026 NUMERIC,
        progress_pct_total NUMERIC,
        progress_pct_2025 NUMERIC,
        progress_pct_2026 NUMERIC,
        max_contract_quantity NUMERIC,
        contract_total_quantity NUMERIC,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
    }),
  );

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_government_contract_progress\`
      ADD COLUMN IF NOT EXISTS max_quantity_2025 NUMERIC
    `,
    }),
  );

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_government_contract_progress\`
      ADD COLUMN IF NOT EXISTS max_quantity_2026 NUMERIC
    `,
    }),
  );

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      ALTER TABLE \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_government_contract_progress\`
      ADD COLUMN IF NOT EXISTS max_contract_quantity NUMERIC
    `,
    }),
  );

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_government_contract_progress\`
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
          'commercial_operations_government_contract_progress',
          'government_contract_progress',
          'contract_progress',
          'pcfp'
        )
          AND u.upload_id != @uploadId
      )
    `,
      params: { uploadId },
    }),
  );

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_government_contract_progress\`
      WHERE upload_id = @uploadId
    `,
      params: { uploadId },
    }),
  );

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_government_contract_progress\`
    (
      upload_id,
      row_number,
      contract_key,
      contract_type,
      vigencia,
      category,
      responsible,
      cb_code,
      source_product_raw,
      source_product_normalized,
      tender_number,
      contract_number,
      event_type,
      centralized_opd,
      central_institution,
      institution,
      assigned_to,
      business_model,
      assignment_status,
      business_unit,
      period_month,
      delivered_quantity,
      max_quantity_2025,
      max_quantity_2026,
      total_2025,
      total_2026,
      total_2025_2026,
      progress_pct_total,
      progress_pct_2025,
      progress_pct_2026,
      max_contract_quantity,
      contract_total_quantity,
      source_payload_json,
      normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      NULLIF(row.contract_key, ''),
      NULLIF(row.contract_type, ''),
      NULLIF(row.vigencia, ''),
      NULLIF(row.category, ''),
      NULLIF(row.responsible, ''),
      NULLIF(row.cb_code, ''),
      row.source_product_raw,
      row.source_product_normalized,
      NULLIF(row.tender_number, ''),
      NULLIF(row.contract_number, ''),
      NULLIF(row.event_type, ''),
      NULLIF(row.centralized_opd, ''),
      NULLIF(row.central_institution, ''),
      NULLIF(row.institution, ''),
      NULLIF(row.assigned_to, ''),
      NULLIF(row.business_model, ''),
      NULLIF(row.assignment_status, ''),
      NULLIF(row.business_unit, ''),
      DATE(row.period_month),
      SAFE_CAST(row.delivered_quantity AS NUMERIC),
      SAFE_CAST(row.max_quantity_2025 AS NUMERIC),
      SAFE_CAST(row.max_quantity_2026 AS NUMERIC),
      SAFE_CAST(row.total_2025 AS NUMERIC),
      SAFE_CAST(row.total_2026 AS NUMERIC),
      SAFE_CAST(row.total_2025_2026 AS NUMERIC),
      SAFE_CAST(row.progress_pct_total AS NUMERIC),
      SAFE_CAST(row.progress_pct_2025 AS NUMERIC),
      SAFE_CAST(row.progress_pct_2026 AS NUMERIC),
      SAFE_CAST(row.max_contract_quantity AS NUMERIC),
      SAFE_CAST(row.contract_total_quantity AS NUMERIC),
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItems(rows, 1500);
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await runQueryWithRetryOnConcurrentUpdate(() =>
        client.query({
          query,
          params: {
            uploadId,
            rows: chunk.map((row) => ({
              row_number: row.rowNumber,
              contract_key: row.contractKey ?? '',
              contract_type: row.contractType ?? '',
              vigencia: row.vigencia ?? '',
              category: row.category ?? '',
              responsible: row.responsible ?? '',
              cb_code: row.cbCode ?? '',
              source_product_raw: row.sourceProductRaw,
              source_product_normalized: row.sourceProductNormalized,
              tender_number: row.tenderNumber ?? '',
              contract_number: row.contractNumber ?? '',
              event_type: row.eventType ?? '',
              centralized_opd: row.centralizedOpd ?? '',
              central_institution: row.centralInstitution ?? '',
              institution: row.institution ?? '',
              assigned_to: row.assignedTo ?? '',
              business_model: row.businessModel ?? '',
              assignment_status: row.assignmentStatus ?? '',
              business_unit: row.businessUnit ?? '',
              period_month: row.periodMonth,
              delivered_quantity: String(row.deliveredQuantity),
              max_quantity_2025: row.maxQuantity2025 == null ? '' : String(row.maxQuantity2025),
              max_quantity_2026: row.maxQuantity2026 == null ? '' : String(row.maxQuantity2026),
              total_2025: row.total2025 == null ? '' : String(row.total2025),
              total_2026: row.total2026 == null ? '' : String(row.total2026),
              total_2025_2026: row.total2025_2026 == null ? '' : String(row.total2025_2026),
              progress_pct_total: row.progressPctTotal == null ? '' : String(row.progressPctTotal),
              progress_pct_2025: row.progressPct2025 == null ? '' : String(row.progressPct2025),
              progress_pct_2026: row.progressPct2026 == null ? '' : String(row.progressPct2026),
              max_contract_quantity: row.maxContractQuantity == null ? '' : String(row.maxContractQuantity),
              contract_total_quantity: row.contractTotalQuantity == null ? '' : String(row.contractTotalQuantity),
              source_payload_json: JSON.stringify(row.payload),
            })),
          },
        }),
      );
    },
    1,
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
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
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
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
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
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
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

async function loadOpexMasterCatalogStaging(
  uploadId: string,
  rows: OpexMasterCatalogNormalizedRow[],
) {
  const client = getBigQueryClient();

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_opex_master_catalog\` (
        upload_id STRING,
        row_number INT64,
        key1 STRING,
        key2 STRING,
        account STRING,
        pl_group STRING,
        area STRING,
        ceco STRING,
        ceco_name STRING,
        cost_element STRING,
        element STRING,
        business_unit STRING,
        owner STRING,
        responsible STRING,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
    }),
  );

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_opex_master_catalog\`
      WHERE upload_id = @uploadId
    `,
      params: { uploadId },
    }),
  );

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_opex_master_catalog\`
    (
      upload_id, row_number, key1, key2, account, pl_group, area, ceco, ceco_name,
      cost_element, element, business_unit, owner, responsible, source_payload_json, normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      row.key1,
      NULLIF(row.key2, ''),
      NULLIF(row.account, ''),
      NULLIF(row.pl_group, ''),
      NULLIF(row.area, ''),
      NULLIF(row.ceco, ''),
      NULLIF(row.ceco_name, ''),
      NULLIF(row.cost_element, ''),
      NULLIF(row.element, ''),
      NULLIF(row.business_unit, ''),
      NULLIF(row.owner, ''),
      NULLIF(row.responsible, ''),
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItemsByApproxBytes(rows, {
    maxBytesPerChunk: 2_000_000,
    maxItemsPerChunk: 2000,
    estimateBytes: (row) =>
      String(row.key1 ?? '').length +
      String(row.key2 ?? '').length +
      String(row.account ?? '').length +
      String(row.ceco ?? '').length +
      String(row.cecoName ?? '').length +
      String(row.costElement ?? '').length +
      String(row.element ?? '').length +
      String(row.businessUnit ?? '').length +
      String(row.owner ?? '').length +
      String(row.responsible ?? '').length +
      JSON.stringify(row.payload ?? {}).length +
      128,
  });
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await runQueryWithRetryOnConcurrentUpdate(() =>
        client.query({
          query,
          params: {
            uploadId,
            rows: chunk.map((row) => ({
              row_number: row.rowNumber,
              key1: row.key1,
              key2: row.key2 ?? '',
              account: row.account ?? '',
              pl_group: row.plGroup ?? '',
              area: row.area ?? '',
              ceco: row.ceco ?? '',
              ceco_name: row.cecoName ?? '',
              cost_element: row.costElement ?? '',
              element: row.element ?? '',
              business_unit: row.businessUnit ?? '',
              owner: row.owner ?? '',
              responsible: row.responsible ?? '',
              source_payload_json: JSON.stringify(row.payload),
            })),
          },
        }),
      );
    },
    1,
  );
}

async function loadOpexMovementsStaging(
  uploadId: string,
  rows: OpexMovementNormalizedRow[],
) {
  const client = getBigQueryClient();

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_stg.stg_opex_movements\` (
        upload_id STRING,
        row_number INT64,
        key1 STRING,
        key2 STRING,
        period_month DATE,
        metric_name STRING,
        amount_value NUMERIC,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
    }),
  );

  await runQueryWithRetryOnConcurrentUpdate(() =>
    client.query({
      query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_stg.stg_opex_movements\`
      WHERE upload_id = @uploadId
    `,
      params: { uploadId },
    }),
  );

  if (rows.length === 0) return;

  const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_stg.stg_opex_movements\`
    (
      upload_id, row_number, key1, key2, period_month, metric_name, amount_value, source_payload_json, normalized_at
    )
    SELECT
      @uploadId,
      row.row_number,
      row.key1,
      NULLIF(row.key2, ''),
      DATE(row.period_month),
      row.metric_name,
      SAFE_CAST(row.amount_value AS NUMERIC),
      SAFE.PARSE_JSON(row.source_payload_json, wide_number_mode => 'round'),
      CURRENT_TIMESTAMP()
    FROM UNNEST(@rows) AS row
  `;

  const chunks = chunkItems(rows, 5000);
  await runChunksInParallel(
    chunks,
    async (chunk) => {
      await runQueryWithRetryOnConcurrentUpdate(() =>
        client.query({
          query,
          params: {
            uploadId,
            rows: chunk.map((row) => ({
              row_number: row.rowNumber,
              key1: row.key1,
              key2: row.key2 ?? '',
              period_month: row.periodMonth,
              metric_name: row.metricName,
              amount_value: String(row.amountValue),
              source_payload_json: JSON.stringify(row.payload),
            })),
          },
        }),
      );
    },
    1,
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

  if (
    moduleCode === 'business_excellence_salesforce_fichero_medico' ||
    moduleCode === 'business_excellence_fichero_medico' ||
    moduleCode === 'fichero_medico'
  ) {
    const { validations, normalizedRows } = normalizeBusinessExcellenceSalesforceMedicalFile(rows);
    await updateRawValidationStatus(uploadId, validations);
    await loadBusinessExcellenceSalesforceMedicalFileStaging(uploadId, normalizedRows);
    return buildNormalizeUploadResult(validations, normalizedRows.length);
  }

  if (
    moduleCode === 'business_excellence_salesforce_tft' ||
    moduleCode === 'business_excellence_tft' ||
    moduleCode === 'tft'
  ) {
    const { validations, normalizedRows } = normalizeBusinessExcellenceSalesforceTft(rows);
    await updateRawValidationStatus(uploadId, validations);
    await loadBusinessExcellenceSalesforceTftStaging(uploadId, normalizedRows);
    return buildNormalizeUploadResult(validations, normalizedRows.length);
  }

  if (
    moduleCode === 'business_excellence_salesforce_interacciones' ||
    moduleCode === 'business_excellence_interacciones' ||
    moduleCode === 'interacciones'
  ) {
    const { validations, normalizedRows } = normalizeBusinessExcellenceSalesforceInteractions(rows);
    await updateRawValidationStatus(uploadId, validations);
    await loadBusinessExcellenceSalesforceInteractionsStaging(uploadId, normalizedRows);
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

  if (
    moduleCode === 'commercial_operations_dso' ||
    moduleCode === 'commercial_operations_days_sales_outstanding' ||
    moduleCode === 'dso'
  ) {
    const { validations, normalizedRows } = normalizeCommercialOperationsDso(rows);
    await updateRawValidationStatus(uploadId, validations);
    await loadCommercialOperationsDsoStaging(uploadId, normalizedRows);
    return buildNormalizeUploadResult(validations, normalizedRows.length);
  }

  if (
    moduleCode === 'commercial_operations_government_orders' ||
    moduleCode === 'government_orders' ||
    moduleCode === 'commercial_operations_private_orders' ||
    moduleCode === 'private_orders'
  ) {
    const { validations, normalizedRows } = normalizeCommercialOperationsDeliveryOrdersV2(rows, moduleCode);
    await updateRawValidationStatus(uploadId, validations);
    await loadCommercialOperationsDeliveryOrdersStaging(uploadId, normalizedRows, moduleCode);
    return buildNormalizeUploadResult(validations, normalizedRows.length);
  }

  if (moduleCode === 'commercial_operations_stocks' || moduleCode === 'stocks') {
    const { validations, normalizedRows } = normalizeCommercialOperationsStocks(rows);
    await updateRawValidationStatus(uploadId, validations);
    await loadCommercialOperationsStocksStaging(uploadId, normalizedRows);
    return buildNormalizeUploadResult(validations, normalizedRows.length);
  }

  if (
    moduleCode === 'commercial_operations_government_contract_progress' ||
    moduleCode === 'government_contract_progress' ||
    moduleCode === 'contract_progress' ||
    moduleCode === 'pcfp'
  ) {
    const { validations, normalizedRows } = normalizeCommercialOperationsGovernmentContractProgress(rows);
    await updateRawValidationStatus(uploadId, validations);
    await loadCommercialOperationsGovernmentContractProgressStaging(uploadId, normalizedRows);
    return buildNormalizeUploadResult(validations, normalizedRows.length);
  }

  if (moduleCode === 'opex_by_cc' || moduleCode === 'opex_master_catalog') {
    const master = normalizeOpexByCcMasterCatalog(rows);
    const movements = normalizeOpexByCcMovements(rows);
    await updateRawValidationStatus(uploadId, master.validations);
    await loadOpexMasterCatalogStaging(uploadId, master.normalizedRows);
    await loadOpexMovementsStaging(uploadId, movements.normalizedRows);
    return buildNormalizeUploadResult(
      master.validations,
      master.normalizedRows.length + movements.normalizedRows.length,
    );
  }

  throw new Error(`No normalizer configured for module "${moduleCode}".`);
}



