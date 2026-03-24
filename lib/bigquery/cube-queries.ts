import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { getGob360BigQueryClient } from '@/lib/bigquery/gob360-client';
import { isPublicMarketOptionKey, resolvePreviewTableId } from '@/lib/bigquery/table_preview';

export type CubeSchemaRow = {
  column_name: string;
  data_type: string;
  is_nullable: string;
  ordinal_position: number;
};

export type CubeEnrichmentOption = {
  key: 'none' | 'gob360_catalog';
  label: string;
  description: string;
  requiredColumn: string | null;
  selectAliases: string[];
};

export type CubeQueryInput = {
  optionKey: string;
  selectedColumns: string[];
  periodColumn?: string | null;
  periodValues?: string[];
  valueFilters?: Record<string, string[]>;
  enrichmentKey?: CubeEnrichmentOption['key'];
  previewLimit?: number | null;
};

type BuiltCubeQuery = {
  tableId: string;
  query: string;
  params: Record<string, unknown>;
  selectedColumns: string[];
  enrichment:
    | { key: 'none' }
    | {
        key: 'gob360_catalog';
        claveColumn: string;
        claveValueKey: string;
      };
};

type PreviewRow = Record<string, unknown>;
type RawRow = Record<string, unknown>;
type Gob360MappedValue = { productId: string | null; marketGroup: string | null };
type ProductMetadataValue = {
  businessUnitName: string | null;
  portfolioName: string | null;
  brandName: string | null;
  subbrandOrDevice: string | null;
};

export type CubeEnrichmentCache = {
  gob360MappingByClave: Map<string, Gob360MappedValue>;
  productMetadataByProductId: Map<string, ProductMetadataValue>;
};

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'function') return '[Function]';
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === 'object') {
    const maybeWrapped = value as Record<string, unknown>;

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

function normalizeComparableValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const maybeWrapped = value as Record<string, unknown>;
    if ('value' in maybeWrapped && Object.keys(maybeWrapped).length <= 2) {
      return normalizeComparableValue(maybeWrapped.value);
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function normalizeClave(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  return raw || null;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function getPreviewClient(optionKey: string) {
  if (isPublicMarketOptionKey(optionKey)) {
    return getGob360BigQueryClient(true);
  }
  return getBigQueryClient();
}

function getPreviewQueryLocation(optionKey: string) {
  if (!isPublicMarketOptionKey(optionKey)) return undefined;
  const configuredLocation = process.env.GOB360_QUERY_LOCATION?.trim() || process.env.GOB360_LOCATION?.trim();
  return configuredLocation || 'US';
}

function splitTableId(tableId: string) {
  const [projectId, datasetId, tableName] = tableId.split('.');
  if (!projectId || !datasetId || !tableName) return null;
  return { projectId, datasetId, tableName };
}

function inferTypeFromValue(value: unknown): string {
  if (value === null || value === undefined) return 'UNKNOWN';
  if (Array.isArray(value)) return 'ARRAY';
  if (value instanceof Date) return 'TIMESTAMP';
  const valueType = typeof value;
  if (valueType === 'string') return 'STRING';
  if (valueType === 'boolean') return 'BOOL';
  if (valueType === 'number') return Number.isInteger(value) ? 'INT64' : 'FLOAT64';
  if (valueType === 'bigint') return 'INT64';
  if (valueType === 'object') return 'STRUCT';
  return 'UNKNOWN';
}

function normalizeIdentifier(name: string) {
  return name.trim().toLowerCase();
}

function isDateLikeType(dataType: string) {
  const value = dataType.toUpperCase();
  return value.includes('DATE') || value.includes('TIMESTAMP') || value.includes('DATETIME');
}

function getPeriodExpression(columnName: string, dataType: string) {
  if (isDateLikeType(dataType)) {
    return `FORMAT_DATE('%F', DATE(src.\`${columnName}\`))`;
  }
  return `CAST(src.\`${columnName}\` AS STRING)`;
}

function getSchemaPeriodCandidates(columns: CubeSchemaRow[]) {
  return columns
    .filter((column) => {
      const normalizedName = normalizeIdentifier(column.column_name);
      const nameLooksLikePeriod =
        normalizedName.includes('period') ||
        normalizedName.includes('month') ||
        normalizedName.includes('date') ||
        normalizedName.includes('fecha');
      return nameLooksLikePeriod || isDateLikeType(column.data_type);
    })
    .map((column) => column.column_name);
}

function findColumnNameByNormalized(schemaRows: CubeSchemaRow[], normalizedName: string) {
  return schemaRows.find((row) => normalizeIdentifier(row.column_name) === normalizedName)?.column_name ?? null;
}

function getEnrichmentOptions(optionKey: string, schemaRows: CubeSchemaRow[]): CubeEnrichmentOption[] {
  const claveColumn = findColumnNameByNormalized(schemaRows, 'clave');
  const options: CubeEnrichmentOption[] = [
    {
      key: 'none',
      label: 'No enrichment',
      description: 'Run against the selected base table only.',
      requiredColumn: null,
      selectAliases: [],
    },
  ];

  const canUseGob360Catalog =
    (optionKey === 'public_market.gob360_pc_sales' || optionKey === 'public_market.gob360_sc_sales') &&
    Boolean(claveColumn);

  if (canUseGob360Catalog) {
    options.push({
      key: 'gob360_catalog',
      label: 'Catalog: Gob360 + Product Metadata',
      description: 'Match by CLAVE to gob360 catalog, then enrich with product metadata by product_id.',
      requiredColumn: claveColumn,
      selectAliases: [
        'catalog_market_group',
        'catalog_product_id',
        'catalog_business_unit_name',
        'catalog_portfolio_name',
        'catalog_brand_name',
        'catalog_subbrand_or_device',
      ],
    });
  }

  return options;
}

async function loadGob360Mapping(keys: string[]): Promise<Map<string, Gob360MappedValue>> {
  const result = new Map<string, Gob360MappedValue>();
  if (keys.length === 0) return result;

  const client = getBigQueryClient();
  for (const batch of chunkArray(keys, 5000)) {
    const [rows] = await client.query({
      query: `
        SELECT
          source_clave_normalized,
          product_id,
          market_group
        FROM (
          SELECT
            m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.source_clave_normalized
              ORDER BY m.updated_at DESC, m.created_at DESC
            ) AS rn
          FROM \`chiesi-committee.chiesi_committee_admin.gob360_product_mapping\` m
          WHERE m.is_active = TRUE
            AND m.source_clave_normalized IN UNNEST(@keys)
        )
        WHERE rn = 1
      `,
      params: { keys: batch },
    });

    for (const row of rows as Array<Record<string, unknown>>) {
      const normalizedKey = String(row.source_clave_normalized ?? '').trim().toLowerCase();
      if (!normalizedKey) continue;
      result.set(normalizedKey, {
        productId: row.product_id ? String(row.product_id) : null,
        marketGroup: row.market_group ? String(row.market_group) : null,
      });
    }
  }

  return result;
}

async function loadProductMetadata(productIds: string[]): Promise<Map<string, ProductMetadataValue>> {
  const result = new Map<string, ProductMetadataValue>();
  if (productIds.length === 0) return result;

  const client = getBigQueryClient();
  for (const batch of chunkArray(productIds, 5000)) {
    const [rows] = await client.query({
      query: `
        SELECT
          product_id,
          business_unit_name,
          portfolio_name,
          brand_name,
          subbrand_or_device
        FROM (
          SELECT
            pm.*,
            ROW_NUMBER() OVER (
              PARTITION BY pm.product_id
              ORDER BY pm.updated_at DESC, pm.created_at DESC
            ) AS rn
          FROM \`chiesi-committee.chiesi_committee_admin.product_metadata\` pm
          WHERE pm.product_id IN UNNEST(@productIds)
        )
        WHERE rn = 1
      `,
      params: { productIds: batch },
    });

    for (const row of rows as Array<Record<string, unknown>>) {
      const productId = String(row.product_id ?? '').trim();
      if (!productId) continue;
      result.set(productId, {
        businessUnitName: row.business_unit_name ? String(row.business_unit_name) : null,
        portfolioName: row.portfolio_name ? String(row.portfolio_name) : null,
        brandName: row.brand_name ? String(row.brand_name) : null,
        subbrandOrDevice: row.subbrand_or_device ? String(row.subbrand_or_device) : null,
      });
    }
  }

  return result;
}

export function createCubeEnrichmentCache(): CubeEnrichmentCache {
  return {
    gob360MappingByClave: new Map<string, Gob360MappedValue>(),
    productMetadataByProductId: new Map<string, ProductMetadataValue>(),
  };
}

async function getSchemaPreviewWithoutInformationSchema(
  optionKey: string,
  tableId: string,
): Promise<CubeSchemaRow[]> {
  const client = getPreviewClient(optionKey);
  const location = getPreviewQueryLocation(optionKey);
  const tableRef = splitTableId(tableId);
  if (!tableRef) return [];

  try {
    const [metadata] = await client
      .dataset(tableRef.datasetId, { projectId: tableRef.projectId })
      .table(tableRef.tableName)
      .getMetadata();

    const fields = (metadata?.schema?.fields ?? []) as Array<{
      name?: string;
      type?: string;
      mode?: string;
    }>;

    if (fields.length > 0) {
      return fields.map((field, index) => ({
        column_name: field.name ?? `column_${index + 1}`,
        data_type: field.type ?? 'UNKNOWN',
        is_nullable: field.mode === 'REQUIRED' ? 'NO' : 'YES',
        ordinal_position: index + 1,
      }));
    }
  } catch {
    // Fallback to one-row inference.
  }

  const [rows] = await client.query({
    query: `SELECT * FROM \`${tableId}\` LIMIT 1`,
    location,
  });
  const firstRow = (rows as Array<Record<string, unknown>>)[0];
  if (!firstRow) return [];

  return Object.entries(firstRow).map(([columnName, value], index) => ({
    column_name: columnName,
    data_type: inferTypeFromValue(value),
    is_nullable: 'YES',
    ordinal_position: index + 1,
  }));
}

export async function getCubeTableSchema(optionKey: string) {
  const tableId = resolvePreviewTableId(optionKey);
  if (!tableId) {
    throw new Error(`Unknown table key: ${optionKey}`);
  }

  if (isPublicMarketOptionKey(optionKey)) {
    const columns = await getSchemaPreviewWithoutInformationSchema(optionKey, tableId);
    return {
      tableId,
      columns,
      periodCandidates: getSchemaPeriodCandidates(columns),
      enrichments: getEnrichmentOptions(optionKey, columns),
    };
  }

  const tableRef = splitTableId(tableId);
  if (!tableRef) {
    throw new Error(`Invalid table id: ${tableId}`);
  }

  const client = getPreviewClient(optionKey);
  const location = getPreviewQueryLocation(optionKey);
  const [rows] = await client.query({
    query: `
      SELECT
        column_name,
        data_type,
        is_nullable,
        ordinal_position
      FROM \`${tableRef.projectId}.${tableRef.datasetId}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = @tableName
      ORDER BY ordinal_position
    `,
    params: { tableName: tableRef.tableName },
    location,
  });

  const columns = rows as CubeSchemaRow[];
  return {
    tableId,
    columns,
    periodCandidates: getSchemaPeriodCandidates(columns),
    enrichments: getEnrichmentOptions(optionKey, columns),
  };
}

export async function getCubePeriodValues(optionKey: string, periodColumn: string, limit = 200) {
  const tableId = resolvePreviewTableId(optionKey);
  if (!tableId) {
    throw new Error(`Unknown table key: ${optionKey}`);
  }

  const schema = await getCubeTableSchema(optionKey);
  const column = schema.columns.find((item) => item.column_name === periodColumn);
  if (!column) {
    throw new Error(`Unknown period column: ${periodColumn}`);
  }

  const safeLimit = Math.max(1, Math.min(1000, Math.trunc(limit)));
  const expression = getPeriodExpression(column.column_name, column.data_type);
  const client = getPreviewClient(optionKey);
  const location = getPreviewQueryLocation(optionKey);
  const [rows] = await client.query({
    query: `
      SELECT DISTINCT ${expression} AS period_value
      FROM \`${tableId}\` AS src
      WHERE ${expression} IS NOT NULL AND ${expression} != ''
      ORDER BY period_value DESC
      LIMIT @limit
    `,
    params: { limit: safeLimit },
    location,
  });

  return {
    tableId,
    values: (rows as Array<{ period_value: unknown }>)
      .map((row) => String(row.period_value ?? '').trim())
      .filter(Boolean),
  };
}

export function buildCubeQuery(input: CubeQueryInput, schemaRows: CubeSchemaRow[]): BuiltCubeQuery {
  const tableId = resolvePreviewTableId(input.optionKey);
  if (!tableId) {
    throw new Error(`Unknown table key: ${input.optionKey}`);
  }

  const schemaByName = new Map(schemaRows.map((row) => [row.column_name, row]));
  const selectedColumns = Array.from(new Set(input.selectedColumns.map((item) => item.trim()).filter(Boolean)));
  if (selectedColumns.length === 0) {
    throw new Error('Select at least one property.');
  }
  for (const column of selectedColumns) {
    if (!schemaByName.has(column)) {
      throw new Error(`Unknown selected column: ${column}`);
    }
  }

  const enrichments = getEnrichmentOptions(input.optionKey, schemaRows);
  const enrichmentKey = input.enrichmentKey ?? 'none';
  const selectedEnrichment = enrichments.find((item) => item.key === enrichmentKey);
  if (!selectedEnrichment) {
    throw new Error(`Unsupported enrichment key: ${enrichmentKey}`);
  }
  if (selectedEnrichment.requiredColumn && !schemaByName.has(selectedEnrichment.requiredColumn)) {
    throw new Error(`Enrichment ${enrichmentKey} requires column ${selectedEnrichment.requiredColumn}.`);
  }

  const selectParts = selectedColumns.map((column) => `src.\`${column}\` AS \`${column}\``);
  let builtEnrichment: BuiltCubeQuery['enrichment'] = { key: 'none' };
  if (selectedEnrichment.key === 'gob360_catalog') {
    const claveColumn = selectedEnrichment.requiredColumn;
    if (!claveColumn) {
      throw new Error('Gob360 enrichment requires CLAVE column.');
    }
    const hiddenClaveAlias = '__cube_enrich_clave';
    if (!selectedColumns.includes(claveColumn)) {
      selectParts.push(`src.\`${claveColumn}\` AS \`${hiddenClaveAlias}\``);
    }
    builtEnrichment = {
      key: 'gob360_catalog',
      claveColumn,
      claveValueKey: selectedColumns.includes(claveColumn) ? claveColumn : hiddenClaveAlias,
    };
  }

  const params: Record<string, unknown> = {};
  const whereClauses: string[] = [];
  const periodColumn = input.periodColumn?.trim() || '';
  const periodValues = Array.from(new Set((input.periodValues ?? []).map((item) => item.trim()).filter(Boolean)));
  if (periodColumn && periodValues.length > 0) {
    const periodSchema = schemaByName.get(periodColumn);
    if (!periodSchema) {
      throw new Error(`Unknown period column: ${periodColumn}`);
    }
    const expression = getPeriodExpression(periodColumn, periodSchema.data_type);
    whereClauses.push(`${expression} IN UNNEST(@periodValues)`);
    params.periodValues = periodValues;
  }

  const rawValueFilters = input.valueFilters ?? {};
  const valueFilters = Object.entries(rawValueFilters)
    .map(([column, values]) => [column.trim(), Array.from(new Set((values ?? []).map((item) => item.trim()).filter(Boolean)))])
    .filter(([column, values]) => column && values.length > 0) as Array<[string, string[]]>;

  let filterIndex = 0;
  for (const [column, values] of valueFilters) {
    if (!schemaByName.has(column)) continue;
    const schema = schemaByName.get(column);
    if (!schema) continue;
    const paramName = `valueFilter_${filterIndex++}`;
    const expression = getPeriodExpression(column, schema.data_type);
    whereClauses.push(`${expression} IN UNNEST(@${paramName})`);
    params[paramName] = values;
  }

  let limitSql = '';
  if (input.previewLimit != null) {
    const safeLimit = Math.max(1, Math.min(50000, Math.trunc(input.previewLimit)));
    params.previewLimit = safeLimit;
    limitSql = '\nLIMIT @previewLimit';
  }

  const query = `
    SELECT
      ${selectParts.join(',\n      ')}
    FROM \`${tableId}\` AS src
    ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
    ${periodColumn ? `ORDER BY ${getPeriodExpression(periodColumn, schemaByName.get(periodColumn)?.data_type ?? '')} DESC` : ''}
    ${limitSql}
  `;

  const finalColumns = [...selectedColumns, ...selectedEnrichment.selectAliases];
  return {
    tableId,
    query,
    params,
    selectedColumns: finalColumns,
    enrichment: builtEnrichment,
  };
}

export async function applyCubeEnrichment(
  rows: RawRow[],
  enrichment: BuiltCubeQuery['enrichment'],
  cache?: CubeEnrichmentCache,
): Promise<RawRow[]> {
  if (enrichment.key === 'none') {
    return rows;
  }

  const safeCache = cache ?? createCubeEnrichmentCache();
  const normalizedByRow = rows.map((row) => normalizeClave(row[enrichment.claveValueKey]));
  const missingClaveSet = new Set<string>();
  for (const key of normalizedByRow) {
    if (!key) continue;
    if (!safeCache.gob360MappingByClave.has(key)) {
      missingClaveSet.add(key);
    }
  }
  const missingClaves = Array.from(missingClaveSet);

  if (missingClaves.length > 0) {
    const loadedMappings = await loadGob360Mapping(missingClaves);
    for (const clave of missingClaves) {
      safeCache.gob360MappingByClave.set(clave, loadedMappings.get(clave) ?? { productId: null, marketGroup: null });
    }
  }

  const neededProductIdSet = new Set<string>();
  for (const clave of normalizedByRow) {
    if (!clave) continue;
    const productId = safeCache.gob360MappingByClave.get(clave)?.productId ?? null;
    if (!productId) continue;
    if (!safeCache.productMetadataByProductId.has(productId)) {
      neededProductIdSet.add(productId);
    }
  }
  const neededProductIds = Array.from(neededProductIdSet);

  if (neededProductIds.length > 0) {
    const loadedMetadata = await loadProductMetadata(neededProductIds);
    for (const productId of neededProductIds) {
      safeCache.productMetadataByProductId.set(productId, loadedMetadata.get(productId) ?? {
        businessUnitName: null,
        portfolioName: null,
        brandName: null,
        subbrandOrDevice: null,
      });
    }
  }

  return rows.map((row, index) => {
    const normalizedClave = normalizedByRow[index];
    const mapping = normalizedClave ? safeCache.gob360MappingByClave.get(normalizedClave) : undefined;
    const metadata = mapping?.productId ? safeCache.productMetadataByProductId.get(mapping.productId) : undefined;

    const enriched: RawRow = {
      ...row,
      catalog_market_group: mapping?.marketGroup ?? null,
      catalog_product_id: mapping?.productId ?? null,
      catalog_business_unit_name: metadata?.businessUnitName ?? null,
      catalog_portfolio_name: metadata?.portfolioName ?? null,
      catalog_brand_name: metadata?.brandName ?? null,
      catalog_subbrand_or_device: metadata?.subbrandOrDevice ?? null,
    };

    if (enrichment.claveValueKey === '__cube_enrich_clave') {
      delete enriched.__cube_enrich_clave;
    }

    return enriched;
  });
}

export function applyCubeValueFilters(
  rows: RawRow[],
  valueFilters?: Record<string, string[]>,
): RawRow[] {
  if (!valueFilters) return rows;
  const normalizedEntries = Object.entries(valueFilters)
    .map(([column, values]) => [
      column,
      new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
    ] as const)
    .filter(([, values]) => values.size > 0);
  if (normalizedEntries.length === 0) return rows;

  return rows.filter((row) => {
    for (const [column, values] of normalizedEntries) {
      const cell = normalizeComparableValue(row[column]);
      if (!values.has(cell)) return false;
    }
    return true;
  });
}

export async function runCubeQuery(input: CubeQueryInput) {
  const schema = await getCubeTableSchema(input.optionKey);
  const built = buildCubeQuery(input, schema.columns);
  const client = getPreviewClient(input.optionKey);
  const location = getPreviewQueryLocation(input.optionKey);
  const [rows] = await client.query({
    query: built.query,
    params: built.params,
    location,
  });
  const rawRows = rows as RawRow[];
  const enrichedRows = await applyCubeEnrichment(rawRows, built.enrichment);
  const filteredRows = applyCubeValueFilters(enrichedRows, input.valueFilters);

  return {
    tableId: built.tableId,
    query: built.query,
    selectedColumns: built.selectedColumns,
    rows: normalizeRows(filteredRows),
  };
}

export function getCubeQueryClient(optionKey: string) {
  return getPreviewClient(optionKey);
}

export function getCubeQueryLocation(optionKey: string) {
  return getPreviewQueryLocation(optionKey);
}
