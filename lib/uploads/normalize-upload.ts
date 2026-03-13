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
  canonicalProductName: string;
  marketGroup: string | null;
  specialty: string | null;
  sourceDateRaw: string | null;
  sourceDate: string;
  periodMonth: string;
  recetasValue: number;
};

type PmmNormalizedRow = {
  rowNumber: number;
  packDesRaw: string;
  packDesNormalized: string;
  productId: string | null;
  canonicalProductName: string;
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
  canonicalProductName: string;
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

type ProductReference = {
  productId: string;
  canonicalProductCode: string | null;
  canonicalProductName: string | null;
  brandName: string | null;
  subbrandOrDevice: string | null;
};

type ProductMatch = {
  productId: string | null;
  canonicalProductName: string;
  marketGroup: string | null;
};

type CloseupSourceMapping = {
  sourceProductNameNormalized: string;
  productId: string | null;
  marketGroup: string | null;
  canonicalProductName: string | null;
};

type PmmSourceMapping = {
  sourcePackDesNormalized: string;
  productId: string | null;
  marketGroup: string | null;
  canonicalProductName: string | null;
};

type SellOutSourceMapping = {
  sourceProductNameNormalized: string;
  productId: string | null;
  marketGroup: string | null;
  canonicalProductName: string | null;
};

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
    message.includes('concurrent update')
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

export type NormalizeUploadResult = {
  ok: true;
  normalizedRows: number;
  rowsValid: number;
  rowsError: number;
};

const MONTHS: Record<string, string> = {
  january: '01',
  enero: '01',
  february: '02',
  febrero: '02',
  march: '03',
  marzo: '03',
  april: '04',
  abril: '04',
  may: '05',
  mayo: '05',
  june: '06',
  junio: '06',
  july: '07',
  julio: '07',
  august: '08',
  agosto: '08',
  september: '09',
  septiembre: '09',
  setiembre: '09',
  october: '10',
  octubre: '10',
  november: '11',
  noviembre: '11',
  december: '12',
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
  const normalized = String(value).replace(/\s/g, '').replace(',', '.');
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

function shiftMonths(periodMonth: string, deltaMonths: number) {
  const date = new Date(`${periodMonth}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return periodMonth;
  date.setUTCMonth(date.getUTCMonth() + deltaMonths);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
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

function buildCloseupAliasCandidates(reference: ProductReference) {
  const aliases = new Set<string>();

  const addAlias = (value: string | null) => {
    if (!value) return;
    const normalized = normalizeText(value);
    if (normalized) aliases.add(normalized);
  };

  addAlias(reference.canonicalProductName);
  addAlias(reference.brandName);
  addAlias(reference.subbrandOrDevice);

  if (reference.canonicalProductCode) {
    const cleanCode = reference.canonicalProductCode.replace(/^0+/, '').trim();
    if (cleanCode) aliases.add(cleanCode.toLowerCase());
  }

  return Array.from(aliases);
}

function mapCloseupProduct(
  rawProduct: string,
  references: ProductReference[],
): ProductMatch | null {
  const productNormalized = normalizeText(rawProduct);
  if (!productNormalized) return null;

  const scored: Array<{ ref: ProductReference; score: number }> = [];
  for (const ref of references) {
    const aliases = buildCloseupAliasCandidates(ref);
    let score = 0;

    for (const alias of aliases) {
      if (!alias) continue;
      if (productNormalized === alias) {
        score += 100;
        continue;
      }

      if (alias.length >= 4 && productNormalized.includes(alias)) {
        score += 15;
      }

      const terms = alias.split(' ').filter((term) => term.length >= 4);
      for (const term of terms) {
        if (productNormalized.includes(term)) {
          score += 4;
        }
      }
    }

    if (score > 0) {
      scored.push({ ref, score });
    }
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    return null;
  }

  const winner = scored[0].ref;
  if (scored[0].score < 8) return null;

  return {
    productId: winner.productId,
    canonicalProductName: winner.canonicalProductName ?? winner.productId,
    marketGroup: null,
  };
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

async function getProductReferences(): Promise<ProductReference[]> {
  const client = getBigQueryClient();
  const query = `
    SELECT
      d.product_id,
      d.canonical_product_code,
      d.canonical_product_name,
      m.brand_name,
      m.subbrand_or_device
    FROM \`chiesi-committee.chiesi_committee_core.dim_product\` d
    LEFT JOIN \`chiesi-committee.chiesi_committee_admin.product_metadata\` m
      ON m.product_id = d.product_id
  `;

  const [rows] = await client.query({ query });
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    productId: String(row.product_id ?? ''),
    canonicalProductCode: row.canonical_product_code
      ? String(row.canonical_product_code)
      : null,
    canonicalProductName: row.canonical_product_name
      ? String(row.canonical_product_name)
      : null,
    brandName: row.brand_name ? String(row.brand_name) : null,
    subbrandOrDevice: row.subbrand_or_device
      ? String(row.subbrand_or_device)
      : null,
  }));
}

async function getCloseupSourceMappings(): Promise<CloseupSourceMapping[]> {
  const client = getBigQueryClient();
  const query = `
    SELECT
      m.source_product_name_normalized,
      m.product_id,
      m.market_group,
      d.canonical_product_name
    FROM \`chiesi-committee.chiesi_committee_admin.closeup_product_mapping\` m
    LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_product\` d
      ON d.product_id = m.product_id
    WHERE m.is_active = TRUE
  `;

  try {
    const [rows] = await client.query({ query });
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      sourceProductNameNormalized: String(row.source_product_name_normalized ?? ''),
      productId: row.product_id ? String(row.product_id) : null,
      marketGroup: row.market_group ? String(row.market_group) : null,
      canonicalProductName: row.canonical_product_name
        ? String(row.canonical_product_name)
        : null,
    }));
  } catch {
    return [];
  }
}

async function getPmmSourceMappings(): Promise<PmmSourceMapping[]> {
  const client = getBigQueryClient();
  const query = `
    SELECT
      m.source_pack_des_normalized,
      m.product_id,
      m.market_group,
      d.canonical_product_name
    FROM \`chiesi-committee.chiesi_committee_admin.pmm_product_mapping\` m
    LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_product\` d
      ON d.product_id = m.product_id
    WHERE m.is_active = TRUE
  `;

  try {
    const [rows] = await client.query({ query });
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      sourcePackDesNormalized: String(row.source_pack_des_normalized ?? ''),
      productId: row.product_id ? String(row.product_id) : null,
      marketGroup: row.market_group ? String(row.market_group) : null,
      canonicalProductName: row.canonical_product_name
        ? String(row.canonical_product_name)
        : null,
    }));
  } catch {
    return [];
  }
}

async function getSellOutSourceMappings(): Promise<SellOutSourceMapping[]> {
  const client = getBigQueryClient();
  const query = `
    SELECT
      m.source_product_name_normalized,
      m.product_id,
      m.market_group,
      d.canonical_product_name
    FROM \`chiesi-committee.chiesi_committee_admin.sell_out_product_mapping\` m
    LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_product\` d
      ON d.product_id = m.product_id
    WHERE m.is_active = TRUE
  `;

  try {
    const [rows] = await client.query({ query });
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      sourceProductNameNormalized: String(row.source_product_name_normalized ?? ''),
      productId: row.product_id ? String(row.product_id) : null,
      marketGroup: row.market_group ? String(row.market_group) : null,
      canonicalProductName: row.canonical_product_name
        ? String(row.canonical_product_name)
        : null,
    }));
  } catch {
    return [];
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
      period_month,
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
      row.canonical_product_name,
      NULLIF(row.market_group, ''),
      row.specialty,
      row.source_date_raw,
      DATE(row.source_date),
      DATE(row.period_month),
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
            canonical_product_name: row.canonicalProductName,
            market_group: row.marketGroup ?? '',
            specialty: row.specialty,
            source_date_raw: row.sourceDateRaw,
            source_date: row.sourceDate,
            period_month: row.periodMonth,
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
      row.canonical_product_name,
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
            canonical_product_name: row.canonicalProductName,
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
      row.canonical_product_name,
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
            canonical_product_name: row.canonicalProductName,
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

async function normalizeBusinessExcellenceCloseup(
  rows: RawUploadRow[],
  asOfMonth: string | null,
) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: CloseupNormalizedRow[] = [];
  const productReferences = await getProductReferences();
  const closeupMappings = await getCloseupSourceMappings();
  const effectiveAsOfMonth = asOfMonth && /^\d{4}-\d{2}-01$/.test(asOfMonth) ? asOfMonth : null;
  const minIncludedMonth = effectiveAsOfMonth ? shiftMonths(effectiveAsOfMonth, -23) : null;
  const productReferenceById = new Map(
    productReferences.map((ref) => [ref.productId, ref]),
  );
  const explicitMappingByNormalizedSource = new Map(
    closeupMappings.map((item) => [item.sourceProductNameNormalized, item]),
  );

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

    const rawDateValue = pickValue(index, ['Date', 'Fecha', 'Month', 'Mes', 'Periodo']);
    const parsedPeriodMonth = parseDateField(rawDateValue);
    const recetasValue = asNullableNumber(
      pickValue(index, ['Recetas', 'Receta', 'Rx', 'Prescripciones']),
    );
    const specialty = asNullableString(
      pickValue(index, ['Especialidad', 'Especilidad', 'Specialty']),
    );

    if (!productRaw) {
      errors.push('Missing required closeup product column (Producto/Product).');
    }
    if (!parsedPeriodMonth) {
      errors.push('Unable to parse Date value. Accepted: Excel serial, YYYY/MM/DD, DD/MM/YYYY.');
    }
    if (recetasValue == null) {
      errors.push('Missing numeric recetas value.');
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

    const productNormalizedKey = productRaw ? normalizeText(productRaw) : '';
    let productMatch: ProductMatch | null = null;
    const explicitMapping = productNormalizedKey
      ? explicitMappingByNormalizedSource.get(productNormalizedKey)
      : undefined;

    if (explicitMapping && (explicitMapping.productId || explicitMapping.marketGroup)) {
      const ref = explicitMapping.productId
        ? productReferenceById.get(explicitMapping.productId)
        : null;
      const resolvedProductId = explicitMapping.productId ?? 'COMPETITOR';
      productMatch = {
        productId: resolvedProductId,
        canonicalProductName:
          explicitMapping.canonicalProductName ??
          ref?.canonicalProductName ??
          productRaw!,
        marketGroup: explicitMapping.marketGroup ?? null,
      };
    }

    if (!productMatch && errors.length === 0) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: no explicit closeup mapping (product_id and/or market_group).'],
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

    normalizedRows.push({
      rowNumber: row.row_number,
      productCloseupRaw: productRaw!,
      productCloseupNormalized: normalizeText(productRaw!),
      productId: productMatch!.productId,
      canonicalProductName: productMatch!.canonicalProductName,
      marketGroup: productMatch!.marketGroup ?? null,
      specialty,
      sourceDateRaw: rawDateValue == null ? null : String(rawDateValue),
      sourceDate: parsedPeriodMonth!,
      periodMonth: parsedPeriodMonth!,
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
  const productReferences = await getProductReferences();
  const pmmMappings = await getPmmSourceMappings();
  const effectiveAsOfMonth = asOfMonth && /^\d{4}-\d{2}-01$/.test(asOfMonth) ? asOfMonth : null;
  const minIncludedMonth = effectiveAsOfMonth ? shiftMonths(effectiveAsOfMonth, -23) : null;
  const productReferenceById = new Map(
    productReferences.map((ref) => [ref.productId, ref]),
  );
  const explicitMappingByNormalizedSource = new Map(
    pmmMappings.map((item) => [item.sourcePackDesNormalized, item]),
  );

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

    const productNormalizedKey = packDesRaw ? normalizeText(packDesRaw) : '';
    let productMatch: ProductMatch | null = null;
    const explicitMapping = productNormalizedKey
      ? explicitMappingByNormalizedSource.get(productNormalizedKey)
      : undefined;

    if (explicitMapping && (explicitMapping.productId || explicitMapping.marketGroup)) {
      const ref = explicitMapping.productId
        ? productReferenceById.get(explicitMapping.productId)
        : null;
      const resolvedProductId = explicitMapping.productId ?? 'COMPETITOR';
      productMatch = {
        productId: resolvedProductId,
        canonicalProductName:
          explicitMapping.canonicalProductName ??
          ref?.canonicalProductName ??
          packDesRaw!,
        marketGroup: explicitMapping.marketGroup ?? null,
      };
    }

    if (!productMatch && errors.length === 0) {
      validations.push({
        rowNumber: row.row_number,
        validationStatus: 'skipped',
        errors: ['Skipped: no explicit PMM mapping (product_id and/or market_group).'],
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
      productId: productMatch!.productId,
      canonicalProductName: productMatch!.canonicalProductName,
      marketGroup: productMatch!.marketGroup ?? null,
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
  asOfMonth: string | null,
  sourceTag: string | null,
) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: SellOutNormalizedRow[] = [];
  const productReferences = await getProductReferences();
  const sellOutMappings = await getSellOutSourceMappings();
  const productReferenceById = new Map(
    productReferences.map((ref) => [ref.productId, ref]),
  );
  const explicitMappingByNormalizedSource = new Map(
    sellOutMappings.map((item) => [item.sourceProductNameNormalized, item]),
  );
  const effectiveAsOfMonth = asOfMonth && /^\d{4}-\d{2}-01$/.test(asOfMonth) ? asOfMonth : null;
  const minIncludedMonth = effectiveAsOfMonth ? shiftMonths(effectiveAsOfMonth, -23) : null;

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);
    const errors: string[] = [];
    const dateValue = pickValue(index, ['Date', 'DATE', 'Fecha', 'Period', 'Periodo']);
    const parsedPeriodMonth = parseDateField(dateValue);

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
      const mapping = explicitMappingByNormalizedSource.get(normalizedKey);
      if (!mapping || (!mapping.productId && !mapping.marketGroup)) continue;

      const ref = mapping.productId ? productReferenceById.get(mapping.productId) : null;
      const resolvedProductId = mapping.productId ?? 'COMPETITOR';
      const canonicalProductName =
        mapping.canonicalProductName ??
        ref?.canonicalProductName ??
        cell.sourceProductRaw;

      normalizedRows.push({
        rowNumber: row.row_number,
        sourceProductRaw: cell.sourceProductRaw,
        sourceProductNormalized: normalizedKey,
        productId: resolvedProductId,
        canonicalProductName,
        marketGroup: mapping.marketGroup ?? null,
        channel: sourceTag,
        periodMonth: parsedPeriodMonth!,
        salesGroup: 'Units',
        amountValue: cell.amountValue!,
        payload,
      });
    }
  }

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

export async function normalizeUpload(uploadId: string, moduleCode: string): Promise<NormalizeUploadResult> {
  const rows = await getRawRows(uploadId);

  if (moduleCode === 'sales_internal') {
    const { validations, normalizedRows } = normalizeSalesInternal(rows);
    await updateRawValidationStatus(uploadId, validations);
    await loadSalesInternalStaging(uploadId, normalizedRows);

    const rowsValid = validations.filter((item) => item.validationStatus !== 'error').length;
    const rowsError = validations.filter((item) => item.validationStatus === 'error').length;

    return {
      ok: true,
      normalizedRows: normalizedRows.length,
      rowsValid,
      rowsError,
    };
  }

  if (moduleCode === 'business_excellence_closeup' || moduleCode === 'closeup') {
    const asOfMonth = await getUploadAsOfMonth(uploadId);
    const { validations, normalizedRows } = await normalizeBusinessExcellenceCloseup(
      rows,
      asOfMonth,
    );
    await updateRawValidationStatus(uploadId, validations);
    await loadCloseupStaging(uploadId, normalizedRows);

    const rowsValid = validations.filter((item) => item.validationStatus !== 'error').length;
    const rowsError = validations.filter((item) => item.validationStatus === 'error').length;

    return {
      ok: true,
      normalizedRows: normalizedRows.length,
      rowsValid,
      rowsError,
    };
  }

  if (moduleCode === 'business_excellence_ddd' || moduleCode === 'business_excellence_pmm' || moduleCode === 'pmm' || moduleCode === 'ddd') {
    const asOfMonth = await getUploadAsOfMonth(uploadId);
    const { validations, normalizedRows } = await normalizeBusinessExcellencePmm(rows, asOfMonth);
    await updateRawValidationStatus(uploadId, validations);
    await loadPmmStaging(uploadId, normalizedRows);

    const rowsValid = validations.filter((item) => item.validationStatus !== 'error').length;
    const rowsError = validations.filter((item) => item.validationStatus === 'error').length;

    return {
      ok: true,
      normalizedRows: normalizedRows.length,
      rowsValid,
      rowsError,
    };
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

    const rowsValid = validations.filter((item) => item.validationStatus !== 'error').length;
    const rowsError = validations.filter((item) => item.validationStatus === 'error').length;

    return {
      ok: true,
      normalizedRows: normalizedRows.length,
      rowsValid,
      rowsError,
    };
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

    const rowsValid = validations.filter((item) => item.validationStatus !== 'error').length;
    const rowsError = validations.filter((item) => item.validationStatus === 'error').length;

    return {
      ok: true,
      normalizedRows: normalizedRows.length,
      rowsValid,
      rowsError,
    };
  }

  throw new Error(`No normalizer configured for module "${moduleCode}".`);
}



