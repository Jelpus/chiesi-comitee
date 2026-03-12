import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';

type RawUploadRow = {
  row_number: number;
  row_payload_json: unknown;
};

type RowValidationResult = {
  rowNumber: number;
  validationStatus: 'valid' | 'error';
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

  await client.query({
    query,
    params: {
      uploadId,
      rows: validations.map((item) => ({
        row_number: item.rowNumber,
        validation_status: item.validationStatus,
        validation_error_json: JSON.stringify(item.errors),
      })),
    },
  });
}

async function loadSalesInternalStaging(uploadId: string, rows: SalesInternalNormalizedRow[]) {
  const client = getBigQueryClient();

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

  await client.query({
    query,
    params: {
      uploadId,
      rows: rows.map((row) => ({
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
}

function normalizeSalesInternal(rows: RawUploadRow[]) {
  const validations: RowValidationResult[] = [];
  const normalizedRows: SalesInternalNormalizedRow[] = [];

  for (const row of rows) {
    const payload = toPayloadObject(row.row_payload_json);
    const index = buildPayloadIndex(payload);
    const monthlyValues = extractMonthlyValues(payload);
    const errors: string[] = [];

    const hasBusinessContent = Object.values(payload).some((value) => {
      if (value == null) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      return true;
    });

    // Trailing rows with only null/whitespace should be ignored, not marked as errors.
    if (!hasBusinessContent) {
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

export async function normalizeUpload(uploadId: string, moduleCode: string): Promise<NormalizeUploadResult> {
  const rows = await getRawRows(uploadId);

  if (moduleCode === 'sales_internal') {
    const { validations, normalizedRows } = normalizeSalesInternal(rows);
    await updateRawValidationStatus(uploadId, validations);
    await loadSalesInternalStaging(uploadId, normalizedRows);

    const rowsValid = validations.filter((item) => item.validationStatus === 'valid').length;
    const rowsError = validations.length - rowsValid;

    return {
      ok: true,
      normalizedRows: normalizedRows.length,
      rowsValid,
      rowsError,
    };
  }

  throw new Error(`No normalizer configured for module "${moduleCode}".`);
}


