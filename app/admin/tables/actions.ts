'use server';

import { getBigQueryClient } from '@/lib/bigquery/client';
import { getGob360BigQueryClient } from '@/lib/bigquery/gob360-client';
import { isPublicMarketOptionKey, resolvePreviewTableId } from '@/lib/bigquery/table_preview';

type PreviewRow = Record<string, unknown>;

type TableSchemaRow = {
  column_name: string;
  data_type: string;
  is_nullable: string;
  ordinal_position: number;
};

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'function') return '[Function]';
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === 'object') {
    const maybeWrapped = value as Record<string, unknown>;

    // BigQuery NUMERIC values can arrive as Big.js-like objects:
    // { s, e, c, constructor: function Big }. Convert to plain string.
    const looksLikeBigNumeric =
      's' in maybeWrapped &&
      'e' in maybeWrapped &&
      'c' in maybeWrapped &&
      typeof (value as { toString?: unknown }).toString === 'function';
    if (looksLikeBigNumeric) {
      try {
        return (value as { toString: () => string }).toString();
      } catch {
        return String(value);
      }
    }

    if ('value' in maybeWrapped && Object.keys(maybeWrapped).length <= 2) {
      return normalizeValue(maybeWrapped.value);
    }
    return Object.fromEntries(
      Object.entries(maybeWrapped)
        .filter(([key]) => key !== 'constructor')
        .map(([key, nestedValue]) => [key, normalizeValue(nestedValue)]),
    );
  }
  return value;
}

function normalizeRows(rows: Array<Record<string, unknown>>): PreviewRow[] {
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeValue(value)])),
  );
}

function resolveInformationSchema(tableId: string) {
  const [projectId, datasetId, tableName] = tableId.split('.');
  if (!projectId || !datasetId || !tableName) return null;
  return { projectId, datasetId, tableName };
}

function getPreviewClient(optionKey: string) {
  if (isPublicMarketOptionKey(optionKey)) {
    return getGob360BigQueryClient(true);
  }
  return getBigQueryClient();
}

function getPreviewQueryLocation(optionKey: string) {
  return isPublicMarketOptionKey(optionKey) ? 'US' : undefined;
}

export async function getTableSchemaPreview(optionKey: string) {
  const tableId = resolvePreviewTableId(optionKey);
  if (!tableId) {
    throw new Error(`Unknown table key: ${optionKey}`);
  }

  const schemaRef = resolveInformationSchema(tableId);
  if (!schemaRef) {
    throw new Error(`Invalid table id: ${tableId}`);
  }

  const client = getPreviewClient(optionKey);
  const location = getPreviewQueryLocation(optionKey);
  const query = `
    SELECT
      column_name,
      data_type,
      is_nullable,
      ordinal_position
    FROM \`${schemaRef.projectId}.${schemaRef.datasetId}.INFORMATION_SCHEMA.COLUMNS\`
    WHERE table_name = @tableName
    ORDER BY ordinal_position
  `;
  const [rows] = await client.query({
    query,
    params: { tableName: schemaRef.tableName },
    location,
  });

  return {
    tableId,
    columns: rows as TableSchemaRow[],
  };
}

export async function getTableSamplePreview(optionKey: string, limit = 25) {
  const tableId = resolvePreviewTableId(optionKey);
  if (!tableId) {
    throw new Error(`Unknown table key: ${optionKey}`);
  }
  const cappedLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const client = getPreviewClient(optionKey);
  const location = getPreviewQueryLocation(optionKey);
  const query = `
    SELECT *
    FROM \`${tableId}\`
    LIMIT @limit
  `;
  const [rows] = await client.query({
    query,
    params: { limit: cappedLimit },
    location,
  });
  return {
    tableId,
    rows: normalizeRows(rows as Array<Record<string, unknown>>),
  };
}

function sanitizeQuerySuffix(value: string) {
  const clean = value.trim();
  if (!clean) return 'LIMIT 50';
  if (clean.includes(';')) {
    throw new Error('Semicolons are not allowed in preview query input.');
  }
  const lowered = clean.toLowerCase();
  const forbidden = ['insert ', 'update ', 'delete ', 'merge ', 'drop ', 'alter ', 'create '];
  if (forbidden.some((token) => lowered.includes(token))) {
    throw new Error('Only read-only SELECT preview is allowed.');
  }
  if (!/limit\s+\d+/i.test(clean)) {
    return `${clean} LIMIT 100`;
  }
  return clean;
}

function sanitizeSelectClause(value: string) {
  const clean = value.trim();
  const fallback = '*';
  if (!clean) return fallback;
  if (clean.includes(';')) {
    throw new Error('Semicolons are not allowed in SELECT clause.');
  }
  const lowered = clean.toLowerCase();
  if (lowered.includes(' from ')) {
    throw new Error('Do not include FROM in SELECT input. Use only selected columns/expressions.');
  }
  const forbidden = ['insert ', 'update ', 'delete ', 'merge ', 'drop ', 'alter ', 'create '];
  if (forbidden.some((token) => lowered.includes(token))) {
    throw new Error('Only read-only SELECT preview is allowed.');
  }
  return clean;
}

export async function runTablePreviewQuery(
  optionKey: string,
  selectClause: string,
  querySuffix: string,
) {
  const tableId = resolvePreviewTableId(optionKey);
  if (!tableId) {
    throw new Error(`Unknown table key: ${optionKey}`);
  }
  const safeSelectClause = sanitizeSelectClause(selectClause);
  const suffix = sanitizeQuerySuffix(querySuffix);
  const client = getPreviewClient(optionKey);
  const location = getPreviewQueryLocation(optionKey);
  const query = `
    SELECT ${safeSelectClause}
    FROM \`${tableId}\`
    ${suffix}
  `;
  const [rows] = await client.query({ query, location });
  return {
    tableId,
    query,
    rows: normalizeRows(rows as Array<Record<string, unknown>>),
  };
}
