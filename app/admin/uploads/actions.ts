'use server';

import 'server-only';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { once } from 'events';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { getStorageClient, getUploadsBucketName } from '@/lib/storage/client';
import { inspectExcelWorkbook, parseExcelRows } from '@/lib/uploads/parse-excel';
import { normalizeUpload } from '@/lib/uploads/normalize-upload';
import { publishUploadToMart } from '@/lib/uploads/publish-upload';

type UploadRowParam = {
    rowNumber: number;
    rowPayloadJson: string;
    sheetName: string;
};

type ParsedUploadRow = {
    rowNumber: number;
    payload: Record<string, unknown>;
};

function isCsvFileName(fileName: string) {
    return /\.csv$/i.test(fileName.trim());
}

let ensureUploadsAsOfColumnPromise: Promise<void> | null = null;
let ensureUploadsErrorColumnPromise: Promise<void> | null = null;
let ensureUploadsDddSourceColumnPromise: Promise<void> | null = null;
let ensureSellOutMappingTablePromise: Promise<void> | null = null;

function sanitizeFileName(fileName: string) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function chunkRows<T>(rows: T[], chunkSize: number) {
    const chunks: T[][] = [];
    for (let i = 0; i < rows.length; i += chunkSize) {
        chunks.push(rows.slice(i, i + chunkSize));
    }
    return chunks;
}

function chunkUploadRowsByApproxBytes(
    rows: UploadRowParam[],
    maxBytesPerChunk: number,
    maxRowsPerChunk: number,
) {
    const chunks: UploadRowParam[][] = [];
    let currentChunk: UploadRowParam[] = [];
    let currentBytes = 0;

    for (const row of rows) {
        const rowBytes =
            Buffer.byteLength(row.rowPayloadJson, 'utf8') +
            Buffer.byteLength(row.sheetName, 'utf8') +
            96;

        const exceedsRows = currentChunk.length >= maxRowsPerChunk;
        const exceedsBytes = currentBytes + rowBytes > maxBytesPerChunk;

        if (currentChunk.length > 0 && (exceedsRows || exceedsBytes)) {
            chunks.push(currentChunk);
            currentChunk = [];
            currentBytes = 0;
        }

        currentChunk.push(row);
        currentBytes += rowBytes;
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    return chunks;
}

function isConcurrentUpdateOrQuotaError(error: unknown) {
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
        message.includes('job exceeded rate limits') ||
        message.includes('rate limits')
    );
}

async function runWithTableUpdateRetry<T>(fn: () => Promise<T>, retries = 4) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (!isConcurrentUpdateOrQuotaError(error) || attempt === retries) break;
            const waitMs = 300 * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
    }
    throw lastError;
}

function normalizeCloseupSourceKey(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function extractCloseupProductFromPayload(payload: Record<string, unknown>) {
    const aliases = ['Producto', 'Product', 'producto_closeup', 'PRODUCTO_NAME', 'Producto Name'];
    const index = new Map<string, unknown>();
    for (const [key, value] of Object.entries(payload)) {
        const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        index.set(normalized, value);
    }

    for (const alias of aliases) {
        const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        const found = index.get(normalizedAlias);
        if (found != null) {
            const text = String(found).trim();
            if (text) return text;
        }
    }

    return null;
}

function extractPmmPackDesFromPayload(payload: Record<string, unknown>) {
    const aliases = ['PACK_DES', 'pack_des', 'Pack Description', 'Producto', 'Product'];
    const index = new Map<string, unknown>();
    for (const [key, value] of Object.entries(payload)) {
        const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        index.set(normalized, value);
    }

    for (const alias of aliases) {
        const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        const found = index.get(normalizedAlias);
        if (found != null) {
            const text = String(found).trim();
            if (text) return text;
        }
    }

    return null;
}

function normalizeRowKey(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getRowValue(payload: Record<string, unknown>, aliases: string[]) {
    const keyMap = new Map<string, unknown>();
    for (const [key, value] of Object.entries(payload)) {
        keyMap.set(normalizeRowKey(key), value);
    }

    for (const alias of aliases) {
        const found = keyMap.get(normalizeRowKey(alias));
        if (found !== undefined) return found;
    }
    return null;
}

function asNumber(value: unknown) {
    if (value == null || value === '') return null;
    const normalized = String(value).replace(/\s/g, '').replace(',', '.');
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
}

function validateSampleRows(moduleCode: string, rows: ParsedUploadRow[]) {
    const sampleRows = rows.slice(0, 10);
    if (sampleRows.length === 0) {
        return { ok: false, checked: 0, message: 'Sample check failed: no rows in sample.' };
    }

    if (moduleCode === 'business_excellence_ddd' || moduleCode === 'business_excellence_pmm' || moduleCode === 'pmm' || moduleCode === 'ddd') {
        const hasPack = sampleRows.some((row) =>
            String(getRowValue(row.payload, ['PACK_DES', 'pack_des', 'Pack Description']) ?? '').trim().length > 0,
        );
        const hasMonthYear = sampleRows.some((row) => {
            const month = String(getRowValue(row.payload, ['MONTH', 'Month', 'MES', 'Mes']) ?? '').trim();
            const year = String(getRowValue(row.payload, ['YEAR', 'Year', 'ANO', 'AÃ‘O', 'Anio']) ?? '').trim();
            return month.length > 0 && year.length > 0;
        });
        const hasNumericValue = sampleRows.some((row) => {
            const units = asNumber(getRowValue(row.payload, ['UN', 'Units', 'UNITS']));
            const lc = asNumber(getRowValue(row.payload, ['LC', 'Local Currency', 'NET_SALES']));
            return units != null || lc != null;
        });

        if (!hasPack || !hasMonthYear || !hasNumericValue) {
            return {
                ok: false,
                checked: sampleRows.length,
                message:
                    'Sample check failed for PMM: expected PACK_DES, MONTH/YEAR and numeric UN/LC in first rows.',
            };
        }

        return { ok: true, checked: sampleRows.length };
    }

    if (moduleCode === 'business_excellence_closeup' || moduleCode === 'closeup') {
        const hasProduct = sampleRows.some((row) =>
            String(getRowValue(row.payload, ['Producto', 'Product', 'producto_closeup', 'PRODUCTO_NAME']) ?? '')
                .trim()
                .length > 0,
        );
        const hasDate = sampleRows.some((row) =>
            String(getRowValue(row.payload, ['Date', 'Fecha', 'Month', 'Mes', 'Periodo']) ?? '').trim().length > 0,
        );
        const hasRecetas = sampleRows.some((row) =>
            asNumber(getRowValue(row.payload, ['Recetas', 'Receta', 'Rx', 'Prescripciones'])) != null,
        );

        if (!hasProduct || !hasDate || !hasRecetas) {
            return {
                ok: false,
                checked: sampleRows.length,
                message:
                    'Sample check failed for Closeup: expected Producto/Product, Date and numeric Recetas in first rows.',
            };
        }

        return { ok: true, checked: sampleRows.length };
    }

    if (
        moduleCode === 'business_excellence_brick_assignment' ||
        moduleCode === 'business_excellence_bricks_visited' ||
        moduleCode === 'bricks_visited'
    ) {
        const hasBrick = sampleRows.some((row) =>
            String(
                getRowValue(row.payload, ['BRICK_COD', 'BRICK_CODIGO', 'BRICK', 'ID BRICK', 'Brick']) ?? '',
            )
                .trim()
                .length > 0,
        );
        const hasTerritory = sampleRows.some((row) =>
            String(
                getRowValue(row.payload, ['TERRITORY', 'Territory', 'Territorio', 'REFERENCIA', 'PRIORIDAD']) ?? '',
            )
                .trim()
                .length > 0,
        );

        if (!hasBrick || !hasTerritory) {
            return {
                ok: false,
                checked: sampleRows.length,
                message:
                    'Sample check failed for Brick Assignment: expected BRICK_COD and TERRITORY/REFERENCIA/PRIORIDAD columns in first rows.',
            };
        }

        return { ok: true, checked: sampleRows.length };
    }

    if (
        moduleCode === 'business_excellence_budget_sell_out' ||
        moduleCode === 'business_excellence_sell_out' ||
        moduleCode === 'sell_out'
    ) {
        const hasDate = sampleRows.some((row) =>
            String(getRowValue(row.payload, ['Date', 'DATE', 'Fecha', 'Period', 'Periodo']) ?? '')
                .trim()
                .length > 0,
        );
        const hasNumericProductColumn = sampleRows.some((row) =>
            Object.entries(row.payload).some(([key, value]) => {
                const normalizedKey = normalizeRowKey(key);
                if (
                    normalizedKey === 'date' ||
                    normalizedKey === 'fecha' ||
                    normalizedKey === 'period' ||
                    normalizedKey === 'periodo'
                ) {
                    return false;
                }
                return asNumber(value) != null;
            }),
        );

        if (!hasDate || !hasNumericProductColumn) {
            return {
                ok: false,
                checked: sampleRows.length,
                message:
                    'Sample check failed for Budget Sell Out: expected Date and numeric product columns in first rows.',
            };
        }

        return { ok: true, checked: sampleRows.length };
    }

    if (
        moduleCode === 'business_excellence_iqvia_weekly' ||
        moduleCode === 'business_excellence_weekly_tracking' ||
        moduleCode === 'iqvia_weekly' ||
        moduleCode === 'weekly_tracking'
    ) {
        const hasDate = sampleRows.some((row) =>
            String(getRowValue(row.payload, ['Week', 'WEEK', 'Date', 'DATE', 'Fecha', 'Period', 'Periodo']) ?? '')
                .trim()
                .length > 0,
        );
        const hasMetric = sampleRows.some((row) => {
            const units = asNumber(getRowValue(row.payload, ['Un', 'UN', 'Units']));
            const netSales = asNumber(getRowValue(row.payload, ['Lc', 'LC', 'Net Sales', 'NetSales']));
            return units != null || netSales != null;
        });

        const hasProductColumns = sampleRows.some((row) =>
            String(getRowValue(row.payload, ['PACK_DES', 'PROD_DES', 'PRODCODE']) ?? '')
                .trim()
                .length > 0,
        );

        if (!hasDate) {
            return {
                ok: false,
                checked: sampleRows.length,
                message:
                    'Sample check failed for Weekly Tracking: expected Week column in first rows.',
            };
        }

        if (!hasMetric) {
            return {
                ok: false,
                checked: sampleRows.length,
                message:
                    'Sample check failed for Weekly Tracking: expected numeric UN/LC values in first rows.',
            };
        }

        if (!hasProductColumns) {
            return {
                ok: false,
                checked: sampleRows.length,
                message:
                    'Sample check failed for Weekly Tracking: expected product columns (PACK_DES/PROD_DES/PRODCODE).',
            };
        }

        return { ok: true, checked: sampleRows.length };
    }

    if (
        moduleCode === 'commercial_operations_dso' ||
        moduleCode === 'commercial_operations_days_sales_outstanding' ||
        moduleCode === 'dso'
    ) {
        const monthTokens = new Set([
            'jan',
            'feb',
            'mar',
            'apr',
            'may',
            'jun',
            'jul',
            'ago',
            'aug',
            'sep',
            'oct',
            'nov',
            'dec',
        ]);

        const rowsToCheck = rows.slice(0, Math.min(rows.length, 60));
        const hasYearMonthHeader = rowsToCheck.some((row) => {
            const values = Object.values(row.payload).map((value) => String(value ?? '').trim().toLowerCase());
            const hasYear = values.includes('year');
            const monthsFound = values.filter((value) => monthTokens.has(value)).length;
            return hasYear && monthsFound >= 2;
        });

        const hasYearDataRow = rowsToCheck.some((row) => {
            const values = Object.values(row.payload).map((value) => String(value ?? '').trim());
            const hasYear = values.some((value) => /^\d{4}$/.test(value));
            const hasNumeric = values.some((value) => asNumber(value) != null);
            return hasYear && hasNumeric;
        });

        const hasGroupLabel = rowsToCheck.some((row) => {
            const values = Object.values(row.payload).map((value) => String(value ?? '').trim());
            return values.some((value) => /b2b|b2c|gobierno|privado|general/i.test(value));
        });

        if (!hasYearMonthHeader || !hasYearDataRow || !hasGroupLabel) {
            return {
                ok: false,
                checked: rowsToCheck.length,
                message:
                    'Sample check failed for Commercial Operations DSO: expected group sections, Year+months headers, and numeric year rows.',
            };
        }

        return { ok: true, checked: rowsToCheck.length };
    }

    return { ok: true, checked: sampleRows.length };
}

async function getCloseupMappingKeySet() {
    const client = getBigQueryClient();
    const query = `
      SELECT source_product_name_normalized
      FROM \`chiesi-committee.chiesi_committee_admin.closeup_product_mapping\`
      WHERE is_active = TRUE
        AND (
          (product_id IS NOT NULL AND TRIM(product_id) != '')
          OR (market_group IS NOT NULL AND TRIM(market_group) != '')
        )
    `;

    try {
        const [rows] = await client.query({ query });
        const keys = (rows as Array<Record<string, unknown>>)
            .map((row) => String(row.source_product_name_normalized ?? '').trim())
            .filter(Boolean);
        return new Set(keys);
    } catch {
        return new Set<string>();
    }
}

async function getPmmMappingKeySet() {
    const client = getBigQueryClient();
    const query = `
      SELECT source_pack_des_normalized
      FROM \`chiesi-committee.chiesi_committee_admin.pmm_product_mapping\`
      WHERE is_active = TRUE
        AND (
          (product_id IS NOT NULL AND TRIM(product_id) != '')
          OR (market_group IS NOT NULL AND TRIM(market_group) != '')
        )
    `;

    try {
        const [rows] = await client.query({ query });
        const keys = (rows as Array<Record<string, unknown>>)
            .map((row) => String(row.source_pack_des_normalized ?? '').trim())
            .filter(Boolean);
        return new Set(keys);
    } catch {
        return new Set<string>();
    }
}

async function getSellOutMappingKeySet() {
    await ensureSellOutMappingTable();
    const client = getBigQueryClient();
    const query = `
      SELECT source_product_name_normalized
      FROM \`chiesi-committee.chiesi_committee_admin.sell_out_product_mapping\`
      WHERE is_active = TRUE
        AND (
          (product_id IS NOT NULL AND TRIM(product_id) != '')
          OR (market_group IS NOT NULL AND TRIM(market_group) != '')
        )
    `;

    try {
        const [rows] = await client.query({ query });
        const keys = (rows as Array<Record<string, unknown>>)
            .map((row) => String(row.source_product_name_normalized ?? '').trim())
            .filter(Boolean);
        return new Set(keys);
    } catch {
        return new Set<string>();
    }
}

async function countUnmappedDddProducts(uploadId: string) {
    const client = getBigQueryClient();
    const query = `
      WITH raw_products AS (
        SELECT DISTINCT
          LOWER(REGEXP_REPLACE(TRIM(COALESCE(
            JSON_VALUE(r.row_payload_json, '$.PACK_DES'),
            JSON_VALUE(r.row_payload_json, '$.pack_des'),
            JSON_VALUE(r.row_payload_json, '$."Pack Description"'),
            JSON_VALUE(r.row_payload_json, '$.PROD_DES'),
            JSON_VALUE(r.row_payload_json, '$.Producto'),
            JSON_VALUE(r.row_payload_json, '$.Product')
          )), r'[^a-zA-Z0-9]+', ' ')) AS source_pack_des_normalized
        FROM \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\` r
        WHERE r.upload_id = @uploadId
      )
      SELECT COUNT(1) AS total
      FROM raw_products p
      LEFT JOIN \`chiesi-committee.chiesi_committee_admin.pmm_product_mapping\` m
        ON m.source_pack_des_normalized = p.source_pack_des_normalized
       AND m.is_active = TRUE
       AND (
         (m.product_id IS NOT NULL AND TRIM(m.product_id) != '')
         OR (m.market_group IS NOT NULL AND TRIM(m.market_group) != '')
       )
      WHERE p.source_pack_des_normalized IS NOT NULL
        AND p.source_pack_des_normalized != ''
        AND m.source_pack_des_normalized IS NULL
    `;

    const [rows] = await client.query({ query, params: { uploadId } });
    return Number((rows as Array<Record<string, unknown>>)[0]?.total ?? 0);
}

async function countUnmappedSellOutProducts(uploadId: string) {
    await ensureSellOutMappingTable();
    const client = getBigQueryClient();
    const query = `
      WITH normalized_mapping AS (
        SELECT
          LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(NORMALIZE(source_product_name, NFD), r'\\pM', ''), r'[^a-zA-Z0-9]+', ' '))) AS source_product_name_normalized,
          product_id,
          market_group,
          is_active
        FROM \`chiesi-committee.chiesi_committee_admin.sell_out_product_mapping\`
      ),
      source_columns AS (
        SELECT DISTINCT
          key_name AS source_product_name,
          LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(NORMALIZE(key_name, NFD), r'\\pM', ''), r'[^a-zA-Z0-9]+', ' '))) AS source_product_name_normalized
        FROM \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\` r,
             UNNEST(JSON_KEYS(r.row_payload_json)) AS key_name
        WHERE r.upload_id = @uploadId
      )
      SELECT COUNT(1) AS total
      FROM source_columns s
      LEFT JOIN normalized_mapping m
        ON m.source_product_name_normalized = s.source_product_name_normalized
       AND m.is_active = TRUE
       AND (
         (m.product_id IS NOT NULL AND TRIM(m.product_id) != '')
         OR (m.market_group IS NOT NULL AND TRIM(m.market_group) != '')
       )
      WHERE s.source_product_name_normalized NOT IN ('date', 'fecha', 'period', 'periodo')
        AND NOT REGEXP_CONTAINS(s.source_product_name_normalized, r'^(date|fecha|period|periodo)(\\s|$)')
        AND SAFE.PARSE_DATE('%Y-%m-%d', TRIM(s.source_product_name)) IS NULL
        AND SAFE.PARSE_DATE('%d/%m/%Y', TRIM(s.source_product_name)) IS NULL
        AND SAFE.PARSE_DATE('%m/%d/%Y', TRIM(s.source_product_name)) IS NULL
        AND NOT STARTS_WITH(LOWER(s.source_product_name), 'column_')
        AND m.source_product_name_normalized IS NULL
    `;

    const [rows] = await client.query({ query, params: { uploadId } });
    return Number((rows as Array<Record<string, unknown>>)[0]?.total ?? 0);
}

async function ensureSellOutMappingTable() {
    if (!ensureSellOutMappingTablePromise) {
        ensureSellOutMappingTablePromise = (async () => {
            const client = getBigQueryClient();
            await client.query({
                query: `
          CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_admin.sell_out_product_mapping\` (
            source_product_name STRING NOT NULL,
            source_product_name_normalized STRING NOT NULL,
            product_id STRING,
            market_group STRING,
            is_active BOOL NOT NULL,
            created_at TIMESTAMP NOT NULL,
            created_by STRING,
            updated_at TIMESTAMP NOT NULL,
            updated_by STRING
          )
        `,
            });
        })();
    }

    await ensureSellOutMappingTablePromise;
}

async function runWithRetry<T>(fn: () => Promise<T>, retries = 3) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt === retries) break;
            const waitMs = 300 * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
    }
    throw lastError;
}

async function ensureUploadsAsOfColumn() {
    if (!ensureUploadsAsOfColumnPromise) {
        ensureUploadsAsOfColumnPromise = (async () => {
            const client = getBigQueryClient();
            try {
                await client.query({
                    query: `
          ALTER TABLE \`chiesi-committee.chiesi_committee_raw.uploads\`
          ADD COLUMN IF NOT EXISTS source_as_of_month DATE
        `,
                });
            } catch (error) {
                if (!isTableUpdateQuotaError(error)) throw error;
                console.warn('[ensureUploadsAsOfColumn] skipped due to table update quota', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
    }

    await ensureUploadsAsOfColumnPromise;
}

async function ensureUploadsErrorColumn() {
    if (!ensureUploadsErrorColumnPromise) {
        ensureUploadsErrorColumnPromise = (async () => {
            const client = getBigQueryClient();
            try {
                await client.query({
                    query: `
          ALTER TABLE \`chiesi-committee.chiesi_committee_raw.uploads\`
          ADD COLUMN IF NOT EXISTS last_error_message STRING
        `,
                });
            } catch (error) {
                if (!isTableUpdateQuotaError(error)) throw error;
                console.warn('[ensureUploadsErrorColumn] skipped due to table update quota', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
    }

    await ensureUploadsErrorColumnPromise;
}

async function ensureUploadsDddSourceColumn() {
    if (!ensureUploadsDddSourceColumnPromise) {
        ensureUploadsDddSourceColumnPromise = (async () => {
            const client = getBigQueryClient();
            try {
                await client.query({
                    query: `
          ALTER TABLE \`chiesi-committee.chiesi_committee_raw.uploads\`
          ADD COLUMN IF NOT EXISTS ddd_source STRING
        `,
                });
            } catch (error) {
                if (!isTableUpdateQuotaError(error)) throw error;
                console.warn('[ensureUploadsDddSourceColumn] skipped due to table update quota', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
    }

    await ensureUploadsDddSourceColumnPromise;
}

async function insertUploadRecord(params: {
    uploadId: string;
    moduleCode: string;
    periodMonth: string;
    sourceFileName: string;
    storagePath: string;
    reportingVersionId: string;
    sourceSheetsJson: string;
    selectedSheetName: string;
    selectedHeaderRow: number;
    sourceAsOfMonth: string;
    dddSource: string;
}) {
    await ensureUploadsAsOfColumn();
    await ensureUploadsDddSourceColumn();
    const client = getBigQueryClient();

    const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_raw.uploads\`
    (
      upload_id,
      module_code,
      period_month,
      uploaded_by,
      uploaded_at,
      source_file_name,
      storage_path,
      status,
      rows_total,
      rows_valid,
      rows_error,
      reporting_version_id,
      source_sheets_json,
      selected_sheet_name,
      selected_header_row,
      source_as_of_month,
      ddd_source
    )
    VALUES
    (
      @uploadId,
      @moduleCode,
      DATE(@periodMonth),
      @uploadedBy,
      CURRENT_TIMESTAMP(),
      @sourceFileName,
      @storagePath,
      @status,
      @rowsTotal,
      @rowsValid,
      @rowsError,
      @reportingVersionId,
      PARSE_JSON(@sourceSheetsJson),
      @selectedSheetName,
      @selectedHeaderRow,
      DATE(@sourceAsOfMonth),
      NULLIF(@dddSource, '')
    )
  `;

    await client.query({
        query,
        params: {
            uploadId: params.uploadId,
            moduleCode: params.moduleCode,
            periodMonth: params.periodMonth,
            uploadedBy: 'system',
            sourceFileName: params.sourceFileName,
            storagePath: params.storagePath,
            status: 'uploading',
            rowsTotal: 0,
            rowsValid: 0,
            rowsError: 0,
            reportingVersionId: params.reportingVersionId,
            sourceSheetsJson: params.sourceSheetsJson,
            selectedSheetName: params.selectedSheetName,
            selectedHeaderRow: params.selectedHeaderRow,
            sourceAsOfMonth: params.sourceAsOfMonth,
            dddSource: params.dddSource,
        },
    });
}

async function insertUploadRows(uploadId: string, rows: UploadRowParam[]) {
    if (rows.length === 0) return;

    const client = getBigQueryClient();
    const query = `
    INSERT INTO \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\`
    (
      upload_id,
      raw_row_id,
      row_number,
      row_payload_json,
      validation_status,
      validation_error_json,
      sheet_name
    )
    SELECT
      @uploadId,
      GENERATE_UUID(),
      row.row_number,
      PARSE_JSON(row.row_payload_json),
      'pending',
      PARSE_JSON('[]'),
      row.sheet_name
    FROM UNNEST(@rows) AS row
  `;

    const chunks = chunkUploadRowsByApproxBytes(rows, 1_600_000, 500);
    const maxConcurrency = 3;
    let nextChunkIndex = 0;

    async function worker() {
        while (true) {
            const chunkIndex = nextChunkIndex;
            nextChunkIndex += 1;
            if (chunkIndex >= chunks.length) return;

            const chunk = chunks[chunkIndex];
            await runWithRetry(
                () =>
                    client.query({
                        query,
                        params: {
                            uploadId,
                            rows: chunk.map((row) => ({
                                row_number: row.rowNumber,
                                row_payload_json: row.rowPayloadJson,
                                sheet_name: row.sheetName,
                            })),
                        },
                    }),
                3,
            );
        }
    }

    const workers = Array.from({ length: Math.min(maxConcurrency, chunks.length) }, () =>
        worker(),
    );
    await Promise.all(workers);
}

async function clearUploadRawRows(uploadId: string) {
    const client = getBigQueryClient();
    await client.query({
        query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\`
      WHERE upload_id = @uploadId
    `,
        params: { uploadId },
    });
}

async function writeRawRowsNdjsonToGcs(params: {
    uploadId: string;
    selectedSheetName: string;
    rows: Array<{ rowNumber: number; payload: Record<string, unknown> }>;
    storagePath: string;
}) {
    const { bucketName, objectPath } = parseGcsPath(params.storagePath);
    const storageClient = getStorageClient();
    const bucket = storageClient.bucket(bucketName);
    const ndjsonObjectPath = `${objectPath}.raw_rows.ndjson`;
    const file = bucket.file(ndjsonObjectPath);

    const writeStream = file.createWriteStream({
        resumable: false,
        contentType: 'application/x-ndjson',
    });

    for (const row of params.rows) {
        const payload = {
            upload_id: params.uploadId,
            raw_row_id: `${params.uploadId}_${row.rowNumber}`,
            row_number: row.rowNumber,
            row_payload_json: row.payload,
            validation_status: 'pending',
            validation_error_json: [],
            sheet_name: params.selectedSheetName,
        };

        const line = `${JSON.stringify(payload)}\n`;
        if (!writeStream.write(line)) {
            await once(writeStream, 'drain');
        }
    }

    writeStream.end();
    await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', (error) => reject(error));
    });

    return {
        gcsUri: `gs://${bucketName}/${ndjsonObjectPath}`,
        bucketName,
        ndjsonObjectPath,
    };
}

async function loadRawRowsIntoBigQueryFromGcs(gcsUri: string) {
    const client = getBigQueryClient();
    const projectId = process.env.GCP_PROJECT_ID || 'chiesi-committee';

    const [job] = await client.createJob({
        location: 'EU',
        configuration: {
            load: {
                sourceUris: [gcsUri],
                sourceFormat: 'NEWLINE_DELIMITED_JSON',
                destinationTable: {
                    projectId,
                    datasetId: 'chiesi_committee_raw',
                    tableId: 'upload_rows_raw',
                },
                writeDisposition: 'WRITE_APPEND',
                autodetect: false,
            },
        },
    });

    await job.promise();
}

async function deleteTemporaryNdjson(bucketName: string, objectPath: string) {
    const storageClient = getStorageClient();
    await storageClient
        .bucket(bucketName)
        .file(objectPath)
        .delete({ ignoreNotFound: true });
}

async function updateUploadCounters(uploadId: string, rowCount: number) {
    const client = getBigQueryClient();
    const query = `
    UPDATE \`chiesi-committee.chiesi_committee_raw.uploads\`
    SET
      status = 'raw_loaded',
      rows_total = @rowsTotal,
      rows_valid = 0,
      rows_error = 0
    WHERE upload_id = @uploadId
  `;

    await runWithTableUpdateRetry(() =>
        client.query({
            query,
            params: {
                uploadId,
                rowsTotal: rowCount,
            },
        }),
    );
}

async function markUploadAsError(uploadId: string) {
    await ensureUploadsErrorColumn();
    const client = getBigQueryClient();

    await runWithTableUpdateRetry(() =>
        client.query({
            query: `
      UPDATE \`chiesi-committee.chiesi_committee_raw.uploads\`
      SET
        status = 'error',
        last_error_message = COALESCE(last_error_message, 'Unknown upload error')
      WHERE upload_id = @uploadId
    `,
            params: { uploadId },
        }),
    );
}

async function setUploadError(uploadId: string, message: string, fallbackStatus: 'error' | 'raw_loaded' = 'error') {
    await ensureUploadsErrorColumn();
    const client = getBigQueryClient();
    await runWithTableUpdateRetry(() =>
        client.query({
            query: `
      UPDATE \`chiesi-committee.chiesi_committee_raw.uploads\`
      SET
        status = @status,
        last_error_message = @message
      WHERE upload_id = @uploadId
    `,
            params: {
                uploadId,
                status: fallbackStatus,
                message: message.slice(0, 4000),
            },
        }),
    );
}

async function setUploadStatus(uploadId: string, status: string) {
    const client = getBigQueryClient();

    await runWithTableUpdateRetry(() =>
        client.query({
            query: `
      UPDATE \`chiesi-committee.chiesi_committee_raw.uploads\`
      SET
        status = @status
      WHERE upload_id = @uploadId
    `,
            params: { uploadId, status },
        }),
    );
}

async function updateUploadNormalizationResult(params: {
    uploadId: string;
    rowsValid: number;
    rowsError: number;
}) {
    const client = getBigQueryClient();

    await runWithTableUpdateRetry(() =>
        client.query({
            query: `
      UPDATE \`chiesi-committee.chiesi_committee_raw.uploads\`
      SET
        status = 'normalized',
        rows_valid = @rowsValid,
        rows_error = @rowsError
      WHERE upload_id = @uploadId
    `,
            params: params,
        }),
    );
}

function formatNormalizationSummary(result: {
    normalizedRows: number;
    rowsValid: number;
    rowsSkipped: number;
    rowsError: number;
    topValidationIssues: Array<{ reason: string; count: number }>;
}) {
    const counts = `normalized=${result.normalizedRows}, valid=${result.rowsValid}, skipped=${result.rowsSkipped}, error=${result.rowsError}`;
    const issues = result.topValidationIssues
        .slice(0, 3)
        .map((item) => `${item.reason} [${item.count}]`)
        .join(' | ');

    return issues ? `${counts}. Top issues: ${issues}` : counts;
}

async function getUploadContext(uploadId: string) {
    const client = getBigQueryClient();

    const [rows] = await client.query({
        query: `
      SELECT module_code, status
      FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
      WHERE upload_id = @uploadId
      LIMIT 1
    `,
        params: { uploadId },
    });

    const row = rows[0] as { module_code?: unknown; status?: unknown } | undefined;
    const moduleCode = row?.module_code ? String(row.module_code) : '';
    const status = row?.status ? String(row.status) : '';

    if (!moduleCode) {
        throw new Error(`module_code not found for upload_id ${uploadId}.`);
    }

    return { moduleCode, status };
}

type UploadProcessContext = {
    moduleCode: string;
    status: string;
    storagePath: string;
    selectedSheetName: string;
    selectedHeaderRow: number;
    rowsTotal: number;
};

async function getUploadProcessContext(uploadId: string): Promise<UploadProcessContext> {
    const client = getBigQueryClient();

    const [rows] = await client.query({
        query: `
      SELECT
        module_code,
        status,
        storage_path,
        selected_sheet_name,
        selected_header_row,
        rows_total
      FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
      WHERE upload_id = @uploadId
      LIMIT 1
    `,
        params: { uploadId },
    });

    const row = rows[0] as
        | {
              module_code?: unknown;
              status?: unknown;
              storage_path?: unknown;
              selected_sheet_name?: unknown;
              selected_header_row?: unknown;
              rows_total?: unknown;
          }
        | undefined;

    const moduleCode = row?.module_code ? String(row.module_code) : '';
    const status = row?.status ? String(row.status) : '';
    const storagePath = row?.storage_path ? String(row.storage_path) : '';
    const selectedSheetName = row?.selected_sheet_name
        ? String(row.selected_sheet_name)
        : '';
    const selectedHeaderRow = Number(row?.selected_header_row ?? 1);
    const rowsTotal = Number(row?.rows_total ?? 0);

    if (!moduleCode) throw new Error(`module_code not found for upload_id ${uploadId}.`);
    if (!storagePath.startsWith('gs://')) {
        throw new Error(`storage_path is invalid for upload_id ${uploadId}.`);
    }

    return {
        moduleCode,
        status,
        storagePath,
        selectedSheetName,
        selectedHeaderRow: Number.isFinite(selectedHeaderRow) && selectedHeaderRow > 0 ? selectedHeaderRow : 1,
        rowsTotal: Number.isFinite(rowsTotal) ? rowsTotal : 0,
    };
}

function parseGcsPath(storagePath: string) {
    const withoutPrefix = storagePath.replace(/^gs:\/\//, '');
    const slashIndex = withoutPrefix.indexOf('/');
    if (slashIndex < 0) {
        throw new Error(`Invalid GCS path: ${storagePath}`);
    }
    const bucketName = withoutPrefix.slice(0, slashIndex);
    const objectPath = withoutPrefix.slice(slashIndex + 1);
    return { bucketName, objectPath };
}

export async function createUploadRecord(formData: FormData) {
  const file = formData.get('file');
  const moduleCode = String(formData.get('moduleCode') ?? '');
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '');
  const periodMonth = String(formData.get('periodMonth') ?? '');
  const sourceAsOfMonth = String(formData.get('sourceAsOfMonth') ?? periodMonth);
  const dddSource = String(formData.get('dddSource') ?? '');
  const selectedSheetName = String(formData.get('selectedSheetName') ?? '').trim();
  const headerRowValue = Number(formData.get('headerRow') ?? 1);
  const headerRow = Number.isFinite(headerRowValue) && headerRowValue > 0 ? headerRowValue : 1;

  console.info('[createUploadRecord] start', {
    moduleCode,
    reportingVersionId,
    periodMonth,
    sourceAsOfMonth,
    dddSource,
    selectedSheetName,
    headerRow,
    fileName: file instanceof File ? file.name : null,
    fileSize: file instanceof File ? file.size : null,
    fileType: file instanceof File ? file.type : null,
  });

    if (!(file instanceof File) || file.size === 0) {
        throw new Error('You must select a source file (.xlsx, .xls, .csv).');
    }

    if (!moduleCode || !reportingVersionId || !periodMonth) {
        throw new Error('Missing required form fields.');
    }

    const uploadId = randomUUID();

    const cleanFileName = sanitizeFileName(file.name);
    const bucketName = getUploadsBucketName();
    const storageObjectPath =
        `committee_uploads/${periodMonth}/${moduleCode}/${uploadId}_${cleanFileName}`;

    const storagePath = `gs://${bucketName}/${storageObjectPath}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const sourceSheets = isCsvFileName(file.name) ? ['CSV'] : inspectExcelWorkbook(fileBuffer);
    const effectiveSelectedSheetName =
      selectedSheetName && sourceSheets.includes(selectedSheetName)
        ? selectedSheetName
        : sourceSheets[0] ?? 'UNKNOWN';

    await insertUploadRecord({
        uploadId,
        moduleCode,
        periodMonth,
        sourceFileName: file.name,
        storagePath,
        reportingVersionId,
        sourceSheetsJson: JSON.stringify(sourceSheets),
        selectedSheetName: effectiveSelectedSheetName,
        selectedHeaderRow: headerRow,
        sourceAsOfMonth: sourceAsOfMonth || periodMonth,
        dddSource:
          moduleCode === 'business_excellence_ddd' ||
          moduleCode === 'business_excellence_pmm' ||
          moduleCode === 'pmm' ||
          moduleCode === 'business_excellence_budget_sell_out' ||
          moduleCode === 'business_excellence_sell_out' ||
          moduleCode === 'sell_out'
            ? dddSource
            : '',
    });

    console.info('[createUploadRecord] upload record inserted', {
      uploadId,
      moduleCode,
      storagePath,
      effectiveSelectedSheetName,
    });

    try {
        const storageClient = getStorageClient();
        const bucket = storageClient.bucket(bucketName);

    await bucket.file(storageObjectPath).save(fileBuffer, {
      resumable: false,
      contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      metadata: {
        metadata: {
                    upload_id: uploadId,
          module_code: moduleCode,
          period_month: periodMonth,
          reporting_version_id: reportingVersionId,
          selected_sheet_name: effectiveSelectedSheetName,
          header_row: String(headerRow),
        },
      },
    });
    await setUploadStatus(uploadId, 'uploaded');
    console.info('[createUploadRecord] file saved to storage and status updated', {
      uploadId,
      storageObjectPath,
    });
  } catch (error) {
    console.error('[createUploadRecord] storage/save failure', {
      uploadId,
      moduleCode,
      storageObjectPath,
      error: error instanceof Error ? error.message : String(error),
    });
    await markUploadAsError(uploadId);
    throw error;
  }

  revalidatePath('/admin/uploads');
  revalidatePath('/admin/uploads/logs');
  console.info('[createUploadRecord] complete', { uploadId, moduleCode });
  return { ok: true, uploadId };
}

export async function inspectUploadWorkbook(formData: FormData) {
  const file = formData.get('file');
  const moduleCode = String(formData.get('moduleCode') ?? '').trim();
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('You must select a source file (.xlsx, .xls, .csv).');
  }

  if (isCsvFileName(file.name)) {
    return {
      sheetNames: ['CSV'],
      suggestedSheetName: 'CSV',
      suggestedHeaderRow: 1,
    };
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const sheetNames = inspectExcelWorkbook(fileBuffer);
  if (sheetNames.length === 0) {
    throw new Error('No sheets/tabs were detected in the uploaded file.');
  }

  let suggestedSheetName = sheetNames[0] ?? '';
  let suggestedHeaderRow = 1;

  if (moduleCode) {
    try {
      const client = getBigQueryClient();
      const [rows] = await client.query({
        query: `
          SELECT
            selected_sheet_name,
            selected_header_row
          FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
          WHERE module_code = @moduleCode
            AND selected_sheet_name IS NOT NULL
          ORDER BY uploaded_at DESC
          LIMIT 1
        `,
        params: { moduleCode },
      });
      const latest = (rows as Array<Record<string, unknown>>)[0];
      const lastSheet = latest?.selected_sheet_name
        ? String(latest.selected_sheet_name)
        : '';
      const lastHeaderRow = Number(latest?.selected_header_row ?? 1);

      if (lastSheet && sheetNames.includes(lastSheet)) {
        suggestedSheetName = lastSheet;
        suggestedHeaderRow =
          Number.isFinite(lastHeaderRow) && lastHeaderRow > 0
            ? Math.trunc(lastHeaderRow)
            : 1;
      }
    } catch (error) {
      console.warn('[inspectUploadWorkbook] unable to fetch latest sheet/header defaults', {
        moduleCode,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    sheetNames,
    suggestedSheetName,
    suggestedHeaderRow,
  };
}

export async function normalizeSalesInternalUpload(uploadId: string) {
  if (!uploadId) {
    throw new Error('uploadId is required for normalization.');
  }

  return normalizeUpload(uploadId, 'sales_internal');
}

export async function processUpload(uploadId: string) {
    if (!uploadId) {
        throw new Error('uploadId is required for processing.');
    }

    const context = await getUploadProcessContext(uploadId);
    const { moduleCode, status } = context;
    if (
        status !== 'uploaded' &&
        status !== 'raw_loaded' &&
        status !== 'error' &&
        status !== 'normalized' &&
        status !== 'published'
    ) {
        throw new Error(`Upload ${uploadId} is not ready to process (current status: ${status}).`);
    }

    let sampleRowsChecked = 0;
    try {
        // Phase 1: load RAW only.
        await setUploadStatus(uploadId, 'parsing');

        const storageClient = getStorageClient();
        const { bucketName, objectPath } = parseGcsPath(context.storagePath);
        const [fileBuffer] = await storageClient.bucket(bucketName).file(objectPath).download();

        const parsedRows = parseExcelRows(fileBuffer, {
            sheetName: context.selectedSheetName,
            headerRow: context.selectedHeaderRow,
        });
        if (parsedRows.length === 0) {
            throw new Error(
                'No rows were parsed from source file. Check delimiter/encoding and selected header row.',
            );
        }
        const sampleCheck = validateSampleRows(moduleCode, parsedRows);
        if (!sampleCheck.ok) {
            throw new Error(sampleCheck.message);
        }
        sampleRowsChecked = sampleCheck.checked;

        let rowsForRaw = parsedRows;
        if (moduleCode === 'business_excellence_closeup' || moduleCode === 'closeup') {
            rowsForRaw = parsedRows;
        }
        if (
            moduleCode === 'business_excellence_ddd' ||
            moduleCode === 'business_excellence_pmm' ||
            moduleCode === 'pmm' ||
            moduleCode === 'ddd' ||
            moduleCode === 'business_excellence_budget_sell_out' ||
            moduleCode === 'business_excellence_sell_out' ||
            moduleCode === 'sell_out'
        ) {
            rowsForRaw = parsedRows;
        }

        await setUploadStatus(uploadId, 'loading_raw');
        await clearUploadRawRows(uploadId);
        const tempFile = await writeRawRowsNdjsonToGcs({
            uploadId,
            selectedSheetName: context.selectedSheetName,
            rows: rowsForRaw.map((row) => ({
                rowNumber: row.rowNumber,
                payload: row.payload,
            })),
            storagePath: context.storagePath,
        });
        try {
            await loadRawRowsIntoBigQueryFromGcs(tempFile.gcsUri);
        } finally {
            await deleteTemporaryNdjson(tempFile.bucketName, tempFile.ndjsonObjectPath);
        }
        await updateUploadCounters(uploadId, rowsForRaw.length);

        revalidatePath('/admin/uploads');
        revalidatePath('/admin/uploads/logs');
        return {
            ok: true as const,
            phase: 'raw_loaded' as const,
            sampleRowsChecked,
            normalizedRows: 0,
            rowsValid: 0,
            rowsError: 0,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown process error';
        const [countRows] = await getBigQueryClient().query({
            query: `
        SELECT COUNT(1) AS total
        FROM \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\`
        WHERE upload_id = @uploadId
      `,
            params: { uploadId },
        });
        const totalRawRows = Number((countRows as Record<string, unknown>[])[0]?.total ?? 0);
        await setUploadError(uploadId, message, totalRawRows > 0 ? 'raw_loaded' : 'error');
        revalidatePath('/admin/uploads');
        revalidatePath('/admin/uploads/logs');
        throw error;
    }
}

export async function normalizeExistingUpload(uploadId: string) {
    if (!uploadId) {
        throw new Error('uploadId is required for normalization.');
    }

    const context = await getUploadProcessContext(uploadId);
    const { moduleCode, status } = context;
    if (status !== 'raw_loaded' && status !== 'normalized' && status !== 'published') {
        throw new Error(`Upload ${uploadId} is not ready to normalize (current status: ${status}).`);
    }

    try {
        await setUploadStatus(uploadId, 'normalizing');
        const result = await normalizeUpload(uploadId, moduleCode);

        if (result.normalizedRows === 0) {
            const summary = formatNormalizationSummary(result);
            await setUploadError(
                uploadId,
                `Normalization produced 0 staging rows. ${summary}`,
                'raw_loaded',
            );
            revalidatePath('/admin/uploads');
            revalidatePath('/admin/uploads/logs');
            return {
                ...result,
                phase: 'raw_loaded' as const,
            };
        }

        await updateUploadNormalizationResult({
            uploadId,
            rowsValid: result.rowsValid,
            rowsError: result.rowsError,
        });

        revalidatePath('/admin/uploads');
        revalidatePath('/admin/uploads/logs');
        return { ...result, phase: 'normalized' as const };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown normalization error';
        await setUploadError(uploadId, message, 'raw_loaded');
        revalidatePath('/admin/uploads');
        revalidatePath('/admin/uploads/logs');
        throw error;
    }
}

export async function publishUpload(uploadId: string) {
    if (!uploadId) {
        throw new Error('uploadId is required for publishing.');
    }

    const { status } = await getUploadContext(uploadId);
    if (status !== 'normalized' && status !== 'published') {
        throw new Error(`Upload ${uploadId} is not ready to publish (status: ${status}).`);
    }

    await setUploadStatus(uploadId, 'publishing');

    try {
        const result = await publishUploadToMart(uploadId);
        await setUploadStatus(uploadId, 'published');
        revalidatePath('/admin/uploads');
        revalidatePath('/admin/uploads/logs');
        revalidatePath('/executive');
        return result;
    } catch (error) {
        await setUploadStatus(uploadId, status);
        revalidatePath('/admin/uploads');
        revalidatePath('/admin/uploads/logs');
        throw error;
    }
}





