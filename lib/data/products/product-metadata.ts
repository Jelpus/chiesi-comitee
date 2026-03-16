import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { BigQuery } from '@google-cloud/bigquery';

export type ProductMetadataRow = {
  productId: string;
  brandName: string | null;
  subbrandOrDevice: string | null;
  productGroup: string | null;
  businessUnitCode: string | null;
  businessUnitName: string | null;
  portfolioName: string | null;
  lifecycleStatus: string | null;
  isActive: boolean | null;
  displayOrder: number | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type UpsertProductMetadataInput = {
  productId: string;
  brandName?: string;
  subbrandOrDevice?: string;
  productGroup?: string;
  businessUnitCode?: string;
  businessUnitName?: string;
  portfolioName?: string;
  lifecycleStatus?: string;
  isActive?: boolean;
  displayOrder?: number;
  notes?: string;
  createdBy?: string;
  updatedBy?: string;
};

export type ProductMetadataCoverageRow = {
  productId: string;
  canonicalProductCode: string;
  canonicalProductName: string;
  hasMetadata: boolean;
  completedRequiredFields: number;
  requiredFieldsTotal: number;
  brandName: string | null;
  subbrandOrDevice: string | null;
  productGroup: string | null;
  businessUnitCode: string | null;
  businessUnitName: string | null;
  portfolioName: string | null;
  lifecycleStatus: string | null;
  isActive: boolean | null;
  displayOrder: number | null;
  notes: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type DimProductOption = {
  productId: string;
  canonicalProductCode: string;
  canonicalProductName: string;
};

export type CloseupProductMappingRow = {
  sourceProductName: string;
  sourceProductNameNormalized: string;
  productId: string | null;
  canonicalProductCode: string | null;
  canonicalProductName: string | null;
  marketGroup: string | null;
  isActive: boolean;
  updatedAt: string | null;
};

export type CloseupUnmappedProductRow = {
  sourceProductName: string;
  sourceProductNameNormalized: string;
  occurrences: number;
  lastSeenAt: string | null;
};

export type PmmProductMappingRow = CloseupProductMappingRow;
export type PmmUnmappedProductRow = CloseupUnmappedProductRow;
export type SellOutProductMappingRow = CloseupProductMappingRow;
export type SellOutUnmappedProductRow = CloseupUnmappedProductRow;
export type Gob360ProductMappingRow = {
  sourceClave: string;
  sourceClaveNormalized: string;
  productId: string | null;
  marketGroup: string | null;
  canonicalProductCode: string | null;
  canonicalProductName: string | null;
  isActive: boolean;
  updatedAt: string | null;
};

export type Gob360UnmappedClaveRow = {
  sourceClave: string;
  sourceClaveNormalized: string;
  occurrences: number;
};

let ensureCloseupProductMappingTablePromise: Promise<void> | null = null;
let ensurePmmProductMappingTablePromise: Promise<void> | null = null;
let ensureSellOutProductMappingTablePromise: Promise<void> | null = null;
let ensureGob360ProductMappingTablePromise: Promise<void> | null = null;
let gob360Client: BigQuery | null = null;

function getGob360PrivateKey() {
  const key = process.env.GOB360_PRIVATE_KEY;
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n');
}

function getGob360Client() {
  if (gob360Client) return gob360Client;

  const projectId = process.env.GOB360_PROJECT_ID || process.env.GCP_PROJECT_ID || 'chiesi-committee';
  const clientEmail = process.env.GOB360_CLIENT_EMAIL;
  const privateKey = getGob360PrivateKey();

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Missing GOB360 credentials. Set GOB360_CLIENT_EMAIL and GOB360_PRIVATE_KEY in .env.local.',
    );
  }

  gob360Client = new BigQuery({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });
  return gob360Client;
}

async function ensureCloseupProductMappingTable() {
  if (!ensureCloseupProductMappingTablePromise) {
    ensureCloseupProductMappingTablePromise = (async () => {
      const client = getBigQueryClient();
      await client.query({
        query: `
          CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_admin.closeup_product_mapping\` (
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

  await ensureCloseupProductMappingTablePromise;
}

async function ensurePmmProductMappingTable() {
  if (!ensurePmmProductMappingTablePromise) {
    ensurePmmProductMappingTablePromise = (async () => {
      const client = getBigQueryClient();
      await client.query({
        query: `
          CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_admin.pmm_product_mapping\` (
            source_pack_des STRING NOT NULL,
            source_pack_des_normalized STRING NOT NULL,
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

  await ensurePmmProductMappingTablePromise;
}

async function ensureSellOutProductMappingTable() {
  if (!ensureSellOutProductMappingTablePromise) {
    ensureSellOutProductMappingTablePromise = (async () => {
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

  await ensureSellOutProductMappingTablePromise;
}

async function ensureGob360ProductMappingTable() {
  if (!ensureGob360ProductMappingTablePromise) {
    ensureGob360ProductMappingTablePromise = (async () => {
      const client = getBigQueryClient();
      await client.query({
        query: `
          CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_admin.gob360_product_mapping\` (
            source_clave STRING NOT NULL,
            source_clave_normalized STRING NOT NULL,
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
      await client.query({
        query: `
          ALTER TABLE \`chiesi-committee.chiesi_committee_admin.gob360_product_mapping\`
          ADD COLUMN IF NOT EXISTS market_group STRING
        `,
      });
    })();
  }

  await ensureGob360ProductMappingTablePromise;
}

export async function getProductMetadataRows(limit = 500): Promise<ProductMetadataRow[]> {
  const client = getBigQueryClient();
  const query = `
    SELECT
      product_id,
      brand_name,
      subbrand_or_device,
      product_group,
      business_unit_code,
      business_unit_name,
      portfolio_name,
      lifecycle_status,
      is_active,
      display_order,
      notes,
      created_by,
      CAST(created_at AS STRING) AS created_at,
      updated_by,
      CAST(updated_at AS STRING) AS updated_at
    FROM \`chiesi-committee.chiesi_committee_admin.product_metadata\`
    ORDER BY updated_at DESC
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({ query, params: { limit } });
    return (rows as Record<string, unknown>[]).map((row) => ({
      productId: String(row.product_id ?? ''),
      brandName: row.brand_name ? String(row.brand_name) : null,
      subbrandOrDevice: row.subbrand_or_device ? String(row.subbrand_or_device) : null,
      productGroup: row.product_group ? String(row.product_group) : null,
      businessUnitCode: row.business_unit_code ? String(row.business_unit_code) : null,
      businessUnitName: row.business_unit_name ? String(row.business_unit_name) : null,
      portfolioName: row.portfolio_name ? String(row.portfolio_name) : null,
      lifecycleStatus: row.lifecycle_status ? String(row.lifecycle_status) : null,
      isActive: row.is_active == null ? null : Boolean(row.is_active),
      displayOrder: row.display_order == null ? null : Number(row.display_order),
      notes: row.notes ? String(row.notes) : null,
      createdBy: row.created_by ? String(row.created_by) : null,
      createdAt: row.created_at ? String(row.created_at) : null,
      updatedBy: row.updated_by ? String(row.updated_by) : null,
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    }));
  } catch {
    return [];
  }
}

export async function upsertProductMetadata(input: UpsertProductMetadataInput) {
  const productId = input.productId.trim();
  if (!productId) {
    throw new Error('productId es obligatorio.');
  }

  const client = getBigQueryClient();
  const query = `
    MERGE \`chiesi-committee.chiesi_committee_admin.product_metadata\` AS target
    USING (
      SELECT
        @productId AS product_id,
        NULLIF(@brandName, '') AS brand_name,
        NULLIF(@subbrandOrDevice, '') AS subbrand_or_device,
        NULLIF(@productGroup, '') AS product_group,
        NULLIF(@businessUnitCode, '') AS business_unit_code,
        NULLIF(@businessUnitName, '') AS business_unit_name,
        NULLIF(@portfolioName, '') AS portfolio_name,
        NULLIF(@lifecycleStatus, '') AS lifecycle_status,
        @isActive AS is_active,
        SAFE_CAST(NULLIF(@displayOrder, '') AS INT64) AS display_order,
        NULLIF(@notes, '') AS notes,
        @createdBy AS created_by,
        @updatedBy AS updated_by
    ) AS source
    ON target.product_id = source.product_id
    WHEN MATCHED THEN
      UPDATE SET
        brand_name = source.brand_name,
        subbrand_or_device = source.subbrand_or_device,
        product_group = source.product_group,
        business_unit_code = source.business_unit_code,
        business_unit_name = source.business_unit_name,
        portfolio_name = source.portfolio_name,
        lifecycle_status = source.lifecycle_status,
        is_active = source.is_active,
        display_order = source.display_order,
        notes = source.notes,
        updated_by = source.updated_by,
        updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN
      INSERT (
        product_id,
        brand_name,
        subbrand_or_device,
        product_group,
        business_unit_code,
        business_unit_name,
        portfolio_name,
        lifecycle_status,
        is_active,
        display_order,
        notes,
        created_by,
        created_at,
        updated_by,
        updated_at
      )
      VALUES (
        source.product_id,
        source.brand_name,
        source.subbrand_or_device,
        source.product_group,
        source.business_unit_code,
        source.business_unit_name,
        source.portfolio_name,
        source.lifecycle_status,
        source.is_active,
        source.display_order,
        source.notes,
        source.created_by,
        CURRENT_TIMESTAMP(),
        source.updated_by,
        CURRENT_TIMESTAMP()
      )
  `;

  await client.query({
    query,
    params: {
      productId,
      brandName: input.brandName?.trim() || '',
      subbrandOrDevice: input.subbrandOrDevice?.trim() || '',
      productGroup: input.productGroup?.trim() || '',
      businessUnitCode: input.businessUnitCode?.trim() || '',
      businessUnitName: input.businessUnitName?.trim() || '',
      portfolioName: input.portfolioName?.trim() || '',
      lifecycleStatus: input.lifecycleStatus?.trim() || '',
      isActive: input.isActive ?? true,
      displayOrder: input.displayOrder == null ? '' : String(input.displayOrder),
      notes: input.notes?.trim() || '',
      createdBy: input.createdBy?.trim() || 'system',
      updatedBy: input.updatedBy?.trim() || 'system',
    },
  });

  return { ok: true, productId };
}

export async function getProductMetadataCoverageRows(
  limit = 500,
): Promise<ProductMetadataCoverageRow[]> {
  const client = getBigQueryClient();
  const query = `
    SELECT
      d.product_id,
      d.canonical_product_code,
      d.canonical_product_name,
      m.product_id IS NOT NULL AS has_metadata,
      (
        IF(m.brand_name IS NOT NULL AND TRIM(m.brand_name) != '', 1, 0) +
        IF(m.product_group IS NOT NULL AND TRIM(m.product_group) != '', 1, 0) +
        IF(m.business_unit_code IS NOT NULL AND TRIM(m.business_unit_code) != '', 1, 0) +
        IF(m.business_unit_name IS NOT NULL AND TRIM(m.business_unit_name) != '', 1, 0) +
        IF(m.portfolio_name IS NOT NULL AND TRIM(m.portfolio_name) != '', 1, 0) +
        IF(m.lifecycle_status IS NOT NULL AND TRIM(m.lifecycle_status) != '', 1, 0)
      ) AS completed_required_fields,
      6 AS required_fields_total,
      m.brand_name,
      m.subbrand_or_device,
      m.product_group,
      m.business_unit_code,
      m.business_unit_name,
      m.portfolio_name,
      m.lifecycle_status,
      m.is_active,
      m.display_order,
      m.notes,
      m.updated_by,
      CAST(m.updated_at AS STRING) AS updated_at
    FROM \`chiesi-committee.chiesi_committee_core.dim_product\` AS d
    LEFT JOIN \`chiesi-committee.chiesi_committee_admin.product_metadata\` AS m
      ON m.product_id = d.product_id
    ORDER BY
      COALESCE(m.display_order, 999999) ASC,
      d.product_id ASC
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params: { limit } });
  return (rows as Record<string, unknown>[]).map((row) => ({
    productId: String(row.product_id ?? ''),
    canonicalProductCode: String(row.canonical_product_code ?? ''),
    canonicalProductName: String(row.canonical_product_name ?? ''),
    hasMetadata: Boolean(row.has_metadata ?? false),
    completedRequiredFields: Number(row.completed_required_fields ?? 0),
    requiredFieldsTotal: Number(row.required_fields_total ?? 6),
    brandName: row.brand_name ? String(row.brand_name) : null,
    subbrandOrDevice: row.subbrand_or_device ? String(row.subbrand_or_device) : null,
    productGroup: row.product_group ? String(row.product_group) : null,
    businessUnitCode: row.business_unit_code ? String(row.business_unit_code) : null,
    businessUnitName: row.business_unit_name ? String(row.business_unit_name) : null,
    portfolioName: row.portfolio_name ? String(row.portfolio_name) : null,
    lifecycleStatus: row.lifecycle_status ? String(row.lifecycle_status) : null,
    isActive: row.is_active == null ? null : Boolean(row.is_active),
    displayOrder: row.display_order == null ? null : Number(row.display_order),
    notes: row.notes ? String(row.notes) : null,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  }));
}

export async function reorderProductMetadata(productId: string, direction: 'up' | 'down') {
  const rows = await getProductMetadataCoverageRows(2000);
  const currentIndex = rows.findIndex((row) => row.productId === productId);

  if (currentIndex < 0) {
    throw new Error(`product_id ${productId} not found for reordering.`);
  }

  const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (swapIndex < 0 || swapIndex >= rows.length) {
    return { ok: true, moved: false };
  }

  const reordered = [...rows];
  const temp = reordered[currentIndex];
  reordered[currentIndex] = reordered[swapIndex];
  reordered[swapIndex] = temp;

  const client = getBigQueryClient();
  const query = `
    MERGE \`chiesi-committee.chiesi_committee_admin.product_metadata\` AS target
    USING UNNEST(@items) AS source
    ON target.product_id = source.product_id
    WHEN MATCHED THEN
      UPDATE SET
        display_order = source.display_order,
        updated_by = 'system',
        updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN
      INSERT (
        product_id,
        is_active,
        display_order,
        created_at,
        created_by,
        updated_at,
        updated_by
      )
      VALUES (
        source.product_id,
        TRUE,
        source.display_order,
        CURRENT_TIMESTAMP(),
        'system',
        CURRENT_TIMESTAMP(),
        'system'
      )
  `;

  await client.query({
    query,
    params: {
      items: reordered.map((row, index) => ({
        product_id: row.productId,
        display_order: index + 1,
      })),
    },
  });

  return { ok: true, moved: true };
}

export async function getDimProductOptions(limit = 2000): Promise<DimProductOption[]> {
  const client = getBigQueryClient();
  const query = `
    SELECT
      product_id,
      canonical_product_code,
      canonical_product_name
    FROM \`chiesi-committee.chiesi_committee_core.dim_product\`
    ORDER BY canonical_product_name ASC
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params: { limit } });
  return (rows as Record<string, unknown>[]).map((row) => ({
    productId: String(row.product_id ?? ''),
    canonicalProductCode: String(row.canonical_product_code ?? ''),
    canonicalProductName: String(row.canonical_product_name ?? ''),
  }));
}

export async function upsertCloseupProductMapping(input: {
  sourceProductName: string;
  productId?: string;
  marketGroup?: string;
  isActive?: boolean;
  updatedBy?: string;
  createdBy?: string;
}) {
  const sourceProductName = input.sourceProductName.trim();
  const sourceProductNameNormalized = sourceProductName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const productId = input.productId?.trim() || '';
  const marketGroup = input.marketGroup?.trim() || '';
  if (!sourceProductName || !sourceProductNameNormalized) {
    throw new Error('sourceProductName is required.');
  }
  const resolvedIsActive = productId || marketGroup ? (input.isActive ?? true) : false;

  await ensureCloseupProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    MERGE \`chiesi-committee.chiesi_committee_admin.closeup_product_mapping\` AS target
    USING (
      SELECT
        @sourceProductName AS source_product_name,
        @sourceProductNameNormalized AS source_product_name_normalized,
        NULLIF(@productId, '') AS product_id,
        NULLIF(@marketGroup, '') AS market_group,
        @isActive AS is_active,
        @createdBy AS created_by,
        @updatedBy AS updated_by
    ) AS source
    ON target.source_product_name_normalized = source.source_product_name_normalized
    WHEN MATCHED THEN
      UPDATE SET
        source_product_name = source.source_product_name,
        product_id = source.product_id,
        market_group = source.market_group,
        is_active = source.is_active,
        updated_by = source.updated_by,
        updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN
      INSERT (
        source_product_name,
        source_product_name_normalized,
        product_id,
        market_group,
        is_active,
        created_at,
        created_by,
        updated_at,
        updated_by
      )
      VALUES (
        source.source_product_name,
        source.source_product_name_normalized,
        source.product_id,
        source.market_group,
        source.is_active,
        CURRENT_TIMESTAMP(),
        source.created_by,
        CURRENT_TIMESTAMP(),
        source.updated_by
      )
  `;

  await client.query({
    query,
    params: {
      sourceProductName,
      sourceProductNameNormalized,
      productId,
      marketGroup,
      isActive: resolvedIsActive,
      createdBy: input.createdBy?.trim() || 'system',
      updatedBy: input.updatedBy?.trim() || 'system',
    },
  });

  return { ok: true, sourceProductName, sourceProductNameNormalized, productId, marketGroup };
}

export async function getCloseupProductMappings(limit = 1000): Promise<CloseupProductMappingRow[]> {
  await ensureCloseupProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    SELECT
      m.source_product_name,
      m.source_product_name_normalized,
      m.product_id,
      d.canonical_product_code,
      d.canonical_product_name,
      m.market_group,
      m.is_active,
      CAST(m.updated_at AS STRING) AS updated_at
    FROM \`chiesi-committee.chiesi_committee_admin.closeup_product_mapping\` m
    LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_product\` d
      ON d.product_id = m.product_id
    WHERE m.is_active = TRUE
      AND (
        (m.product_id IS NOT NULL AND TRIM(m.product_id) != '')
        OR (m.market_group IS NOT NULL AND TRIM(m.market_group) != '')
      )
    ORDER BY m.source_product_name ASC
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({ query, params: { limit } });
    return (rows as Record<string, unknown>[]).map((row) => ({
      sourceProductName: String(row.source_product_name ?? ''),
      sourceProductNameNormalized: String(row.source_product_name_normalized ?? ''),
      productId: row.product_id ? String(row.product_id) : null,
      canonicalProductCode: row.canonical_product_code
        ? String(row.canonical_product_code)
        : null,
      canonicalProductName: row.canonical_product_name
        ? String(row.canonical_product_name)
        : null,
      marketGroup: row.market_group ? String(row.market_group) : null,
      isActive: Boolean(row.is_active ?? true),
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    }));
  } catch {
    return [];
  }
}

export async function getCloseupUnmappedProducts(
  limit = 200,
): Promise<CloseupUnmappedProductRow[]> {
  await ensureCloseupProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    WITH recent_closeup_uploads AS (
      SELECT u.upload_id
      FROM \`chiesi-committee.chiesi_committee_raw.uploads\` u
      JOIN \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\` r
        ON r.upload_id = u.upload_id
      WHERE LOWER(TRIM(u.module_code)) IN ('business_excellence_closeup', 'closeup')
        AND u.status IN ('raw_loaded', 'normalizing', 'normalized', 'published', 'error')
      GROUP BY u.upload_id, u.uploaded_at
      ORDER BY u.uploaded_at DESC
      LIMIT 5
    ),
    source_products AS (
      SELECT
        COALESCE(
          JSON_VALUE(r.row_payload_json, '$.Producto'),
          JSON_VALUE(r.row_payload_json, '$.Product'),
          JSON_VALUE(r.row_payload_json, '$.producto_closeup'),
          JSON_VALUE(r.row_payload_json, '$.PRODUCTO_NAME'),
          JSON_VALUE(r.row_payload_json, '$."Producto Name"'),
          JSON_VALUE(r.row_payload_json, '$."Product Name"')
        ) AS source_product_name,
        CAST(u.uploaded_at AS STRING) AS uploaded_at
      FROM \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\` r
      JOIN \`chiesi-committee.chiesi_committee_raw.uploads\` u
        ON u.upload_id = r.upload_id
      JOIN recent_closeup_uploads l
        ON l.upload_id = r.upload_id
    ),
    normalized AS (
      SELECT
        source_product_name,
        LOWER(
          TRIM(
            REGEXP_REPLACE(
              REGEXP_REPLACE(NORMALIZE(source_product_name, NFD), r'\pM', ''),
              r'[^a-zA-Z0-9]+',
              ' '
            )
          )
        ) AS source_product_name_normalized,
        uploaded_at
      FROM source_products
      WHERE source_product_name IS NOT NULL
        AND TRIM(source_product_name) != ''
    )
    SELECT
      n.source_product_name,
      n.source_product_name_normalized,
      COUNT(1) AS occurrences,
      MAX(n.uploaded_at) AS last_seen_at
    FROM normalized n
    LEFT JOIN \`chiesi-committee.chiesi_committee_admin.closeup_product_mapping\` m
      ON m.source_product_name_normalized = n.source_product_name_normalized
      AND m.is_active = TRUE
      AND (
        (m.product_id IS NOT NULL AND TRIM(m.product_id) != '')
        OR (m.market_group IS NOT NULL AND TRIM(m.market_group) != '')
      )
    WHERE m.source_product_name_normalized IS NULL
    GROUP BY
      n.source_product_name,
      n.source_product_name_normalized
    ORDER BY n.source_product_name ASC
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({ query, params: { limit } });
    return (rows as Record<string, unknown>[]).map((row) => ({
      sourceProductName: String(row.source_product_name ?? ''),
      sourceProductNameNormalized: String(row.source_product_name_normalized ?? ''),
      occurrences: Number(row.occurrences ?? 0),
      lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
    }));
  } catch (error) {
    console.error('getCloseupUnmappedProducts primary query failed:', error);
    const fallbackQuery = `
      WITH source_products AS (
        SELECT
          COALESCE(
            JSON_VALUE(r.row_payload_json, '$.Producto'),
            JSON_VALUE(r.row_payload_json, '$.Product'),
            JSON_VALUE(r.row_payload_json, '$.producto_closeup'),
            JSON_VALUE(r.row_payload_json, '$.PRODUCTO_NAME'),
            JSON_VALUE(r.row_payload_json, '$."Producto Name"'),
            JSON_VALUE(r.row_payload_json, '$."Product Name"')
          ) AS source_product_name,
          CAST(u.uploaded_at AS STRING) AS uploaded_at
        FROM \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\` r
        JOIN \`chiesi-committee.chiesi_committee_raw.uploads\` u
          ON u.upload_id = r.upload_id
        WHERE LOWER(TRIM(u.module_code)) IN ('business_excellence_closeup', 'closeup')
      ),
      normalized AS (
        SELECT
          source_product_name,
          LOWER(REGEXP_REPLACE(TRIM(source_product_name), r'[^a-zA-Z0-9]+', ' ')) AS source_product_name_normalized,
          uploaded_at
        FROM source_products
        WHERE source_product_name IS NOT NULL
          AND TRIM(source_product_name) != ''
      )
      SELECT
        n.source_product_name,
        n.source_product_name_normalized,
        COUNT(1) AS occurrences,
        MAX(n.uploaded_at) AS last_seen_at
      FROM normalized n
      LEFT JOIN \`chiesi-committee.chiesi_committee_admin.closeup_product_mapping\` m
        ON m.source_product_name_normalized = n.source_product_name_normalized
        AND m.is_active = TRUE
        AND (
          (m.product_id IS NOT NULL AND TRIM(m.product_id) != '')
          OR (m.market_group IS NOT NULL AND TRIM(m.market_group) != '')
        )
      WHERE m.source_product_name_normalized IS NULL
      GROUP BY n.source_product_name, n.source_product_name_normalized
      ORDER BY n.source_product_name ASC
      LIMIT @limit
    `;

    try {
      const [rows] = await client.query({ query: fallbackQuery, params: { limit } });
      return (rows as Record<string, unknown>[]).map((row) => ({
        sourceProductName: String(row.source_product_name ?? ''),
        sourceProductNameNormalized: String(row.source_product_name_normalized ?? ''),
        occurrences: Number(row.occurrences ?? 0),
        lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
      }));
    } catch (fallbackError) {
      console.error('getCloseupUnmappedProducts fallback query failed:', fallbackError);
      return [];
    }
  }
}

export async function getCloseupMarketGroups(limit = 300): Promise<string[]> {
  await ensureCloseupProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    SELECT DISTINCT market_group
    FROM \`chiesi-committee.chiesi_committee_admin.closeup_product_mapping\`
    WHERE market_group IS NOT NULL
      AND TRIM(market_group) != ''
    ORDER BY market_group ASC
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({ query, params: { limit } });
    return (rows as Record<string, unknown>[])
      .map((row) => String(row.market_group ?? '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function upsertPmmProductMapping(input: {
  sourcePackDes: string;
  productId?: string;
  marketGroup?: string;
  isActive?: boolean;
  updatedBy?: string;
  createdBy?: string;
}) {
  const sourcePackDes = input.sourcePackDes.trim();
  const sourcePackDesNormalized = sourcePackDes
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const productId = input.productId?.trim() || '';
  const marketGroup = input.marketGroup?.trim() || '';
  if (!sourcePackDes || !sourcePackDesNormalized) {
    throw new Error('sourcePackDes is required.');
  }
  const resolvedIsActive = productId || marketGroup ? (input.isActive ?? true) : false;

  await ensurePmmProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    MERGE \`chiesi-committee.chiesi_committee_admin.pmm_product_mapping\` AS target
    USING (
      SELECT
        @sourcePackDes AS source_pack_des,
        @sourcePackDesNormalized AS source_pack_des_normalized,
        NULLIF(@productId, '') AS product_id,
        NULLIF(@marketGroup, '') AS market_group,
        @isActive AS is_active,
        @createdBy AS created_by,
        @updatedBy AS updated_by
    ) AS source
    ON target.source_pack_des_normalized = source.source_pack_des_normalized
    WHEN MATCHED THEN
      UPDATE SET
        source_pack_des = source.source_pack_des,
        product_id = source.product_id,
        market_group = source.market_group,
        is_active = source.is_active,
        updated_by = source.updated_by,
        updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN
      INSERT (
        source_pack_des,
        source_pack_des_normalized,
        product_id,
        market_group,
        is_active,
        created_at,
        created_by,
        updated_at,
        updated_by
      )
      VALUES (
        source.source_pack_des,
        source.source_pack_des_normalized,
        source.product_id,
        source.market_group,
        source.is_active,
        CURRENT_TIMESTAMP(),
        source.created_by,
        CURRENT_TIMESTAMP(),
        source.updated_by
      )
  `;

  await client.query({
    query,
    params: {
      sourcePackDes,
      sourcePackDesNormalized,
      productId,
      marketGroup,
      isActive: resolvedIsActive,
      createdBy: input.createdBy?.trim() || 'system',
      updatedBy: input.updatedBy?.trim() || 'system',
    },
  });

  return { ok: true, sourcePackDes, sourcePackDesNormalized, productId, marketGroup };
}

export async function getPmmProductMappings(limit = 1000): Promise<PmmProductMappingRow[]> {
  await ensurePmmProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    SELECT
      m.source_pack_des AS source_product_name,
      m.source_pack_des_normalized AS source_product_name_normalized,
      m.product_id,
      d.canonical_product_code,
      d.canonical_product_name,
      m.market_group,
      m.is_active,
      CAST(m.updated_at AS STRING) AS updated_at
    FROM \`chiesi-committee.chiesi_committee_admin.pmm_product_mapping\` m
    LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_product\` d
      ON d.product_id = m.product_id
    WHERE m.is_active = TRUE
      AND (
        (m.product_id IS NOT NULL AND TRIM(m.product_id) != '')
        OR (m.market_group IS NOT NULL AND TRIM(m.market_group) != '')
      )
    ORDER BY m.source_pack_des ASC
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({ query, params: { limit } });
    return (rows as Record<string, unknown>[]).map((row) => ({
      sourceProductName: String(row.source_product_name ?? ''),
      sourceProductNameNormalized: String(row.source_product_name_normalized ?? ''),
      productId: row.product_id ? String(row.product_id) : null,
      canonicalProductCode: row.canonical_product_code
        ? String(row.canonical_product_code)
        : null,
      canonicalProductName: row.canonical_product_name
        ? String(row.canonical_product_name)
        : null,
      marketGroup: row.market_group ? String(row.market_group) : null,
      isActive: Boolean(row.is_active ?? true),
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    }));
  } catch {
    return [];
  }
}

export async function getPmmUnmappedProducts(
  limit = 200,
  uploadIds?: string[],
): Promise<PmmUnmappedProductRow[]> {
  await ensurePmmProductMappingTable();
  const client = getBigQueryClient();
  const scopedUploadIds = (uploadIds ?? []).map((item) => item.trim()).filter(Boolean);
  const hasScopedUploadIds = scopedUploadIds.length > 0;
  const query = `
    WITH source_products AS (
      SELECT
        COALESCE(
          JSON_VALUE(r.row_payload_json, '$.PACK_DES'),
          JSON_VALUE(r.row_payload_json, '$.pack_des'),
          JSON_VALUE(r.row_payload_json, '$."Pack Description"'),
          JSON_VALUE(r.row_payload_json, '$.PROD_DES'),
          JSON_VALUE(r.row_payload_json, '$.Producto'),
          JSON_VALUE(r.row_payload_json, '$.Product')
        ) AS source_product_name,
        CAST(u.uploaded_at AS STRING) AS uploaded_at
      FROM \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\` r
      JOIN \`chiesi-committee.chiesi_committee_raw.uploads\` u
        ON u.upload_id = r.upload_id
      WHERE (
        LOWER(TRIM(u.module_code)) LIKE '%pmm%'
        OR LOWER(TRIM(u.module_code)) LIKE '%ddd%'
        OR LOWER(TRIM(u.module_code)) IN (
          'business_excellence_iqvia_weekly',
          'business_excellence_weekly_tracking',
          'iqvia_weekly',
          'weekly_tracking'
        )
      )
        AND u.status IN ('raw_loaded', 'normalizing', 'normalized', 'published', 'error')
        ${hasScopedUploadIds ? 'AND u.upload_id IN UNNEST(@uploadIds)' : ''}
    ),
    normalized AS (
      SELECT
        source_product_name,
        LOWER(
          TRIM(
            REGEXP_REPLACE(
              REGEXP_REPLACE(NORMALIZE(source_product_name, NFD), r'\pM', ''),
              r'[^a-zA-Z0-9]+',
              ' '
            )
          )
        ) AS source_product_name_normalized,
        uploaded_at
      FROM source_products
      WHERE source_product_name IS NOT NULL
        AND TRIM(source_product_name) != ''
    ),
    normalized_mapping AS (
      SELECT DISTINCT
        LOWER(
          TRIM(
            REGEXP_REPLACE(
              REGEXP_REPLACE(NORMALIZE(COALESCE(source_pack_des, source_pack_des_normalized), NFD), r'\pM', ''),
              r'[^a-zA-Z0-9]+',
              ' '
            )
          )
        ) AS source_pack_des_normalized
      FROM \`chiesi-committee.chiesi_committee_admin.pmm_product_mapping\`
      WHERE is_active = TRUE
        AND (
          (product_id IS NOT NULL AND TRIM(product_id) != '')
          OR (market_group IS NOT NULL AND TRIM(market_group) != '')
        )
    ),
    grouped AS (
      SELECT
        source_product_name,
        source_product_name_normalized,
        COUNT(1) AS occurrences,
        MAX(uploaded_at) AS last_seen_at
      FROM normalized
      GROUP BY source_product_name, source_product_name_normalized
    )
    SELECT
      g.source_product_name,
      g.source_product_name_normalized,
      g.occurrences,
      g.last_seen_at
    FROM grouped g
    LEFT JOIN normalized_mapping m
      ON m.source_pack_des_normalized = g.source_product_name_normalized
    WHERE m.source_pack_des_normalized IS NULL
    ORDER BY g.source_product_name ASC
    LIMIT @limit
  `;

  const [rows] = await client.query({
    query,
    params: hasScopedUploadIds ? { limit, uploadIds: scopedUploadIds } : { limit },
  });
  return (rows as Record<string, unknown>[]).map((row) => ({
    sourceProductName: String(row.source_product_name ?? ''),
    sourceProductNameNormalized: String(row.source_product_name_normalized ?? ''),
    occurrences: Number(row.occurrences ?? 0),
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
  }));
}

export async function getPmmMarketGroups(limit = 300): Promise<string[]> {
  await ensurePmmProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    SELECT DISTINCT market_group
    FROM \`chiesi-committee.chiesi_committee_admin.pmm_product_mapping\`
    WHERE market_group IS NOT NULL
      AND TRIM(market_group) != ''
    ORDER BY market_group ASC
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({ query, params: { limit } });
    return (rows as Record<string, unknown>[])
      .map((row) => String(row.market_group ?? '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function upsertSellOutProductMapping(input: {
  sourceProductName: string;
  productId?: string;
  marketGroup?: string;
  isActive?: boolean;
  updatedBy?: string;
  createdBy?: string;
}) {
  const sourceProductName = input.sourceProductName.trim();
  const sourceProductNameNormalized = sourceProductName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const productId = input.productId?.trim() || '';
  const marketGroup = input.marketGroup?.trim() || '';
  if (['date', 'fecha', 'period', 'periodo'].includes(sourceProductNameNormalized)) {
    throw new Error('Date/Period column cannot be mapped as Sell Out product.');
  }
  if (!sourceProductName || !sourceProductNameNormalized) {
    throw new Error('sourceProductName is required.');
  }
  const resolvedIsActive = productId || marketGroup ? (input.isActive ?? true) : false;

  await ensureSellOutProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    MERGE \`chiesi-committee.chiesi_committee_admin.sell_out_product_mapping\` AS target
    USING (
      SELECT
        @sourceProductName AS source_product_name,
        @sourceProductNameNormalized AS source_product_name_normalized,
        NULLIF(@productId, '') AS product_id,
        NULLIF(@marketGroup, '') AS market_group,
        @isActive AS is_active,
        @createdBy AS created_by,
        @updatedBy AS updated_by
    ) AS source
    ON target.source_product_name_normalized = source.source_product_name_normalized
    WHEN MATCHED THEN
      UPDATE SET
        source_product_name = source.source_product_name,
        product_id = source.product_id,
        market_group = source.market_group,
        is_active = source.is_active,
        updated_by = source.updated_by,
        updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN
      INSERT (
        source_product_name,
        source_product_name_normalized,
        product_id,
        market_group,
        is_active,
        created_at,
        created_by,
        updated_at,
        updated_by
      )
      VALUES (
        source.source_product_name,
        source.source_product_name_normalized,
        source.product_id,
        source.market_group,
        source.is_active,
        CURRENT_TIMESTAMP(),
        source.created_by,
        CURRENT_TIMESTAMP(),
        source.updated_by
      )
  `;

  await client.query({
    query,
    params: {
      sourceProductName,
      sourceProductNameNormalized,
      productId,
      marketGroup,
      isActive: resolvedIsActive,
      createdBy: input.createdBy?.trim() || 'system',
      updatedBy: input.updatedBy?.trim() || 'system',
    },
  });

  // Housekeeping: keep only the latest row per normalized source key.
  await client.query({
    query: `
      DELETE FROM \`chiesi-committee.chiesi_committee_admin.sell_out_product_mapping\`
      WHERE source_product_name_normalized IN (
        SELECT source_product_name_normalized
        FROM \`chiesi-committee.chiesi_committee_admin.sell_out_product_mapping\`
        GROUP BY source_product_name_normalized
        HAVING COUNT(1) > 1
      )
      AND (source_product_name_normalized, updated_at, source_product_name) NOT IN (
        SELECT AS STRUCT source_product_name_normalized, updated_at, source_product_name
        FROM (
          SELECT
            source_product_name_normalized,
            updated_at,
            source_product_name,
            ROW_NUMBER() OVER (
              PARTITION BY source_product_name_normalized
              ORDER BY updated_at DESC, source_product_name DESC
            ) AS rn
          FROM \`chiesi-committee.chiesi_committee_admin.sell_out_product_mapping\`
        )
        WHERE rn = 1
      )
    `,
  });

  return { ok: true, sourceProductName, sourceProductNameNormalized, productId, marketGroup };
}

export async function getSellOutProductMappings(limit = 1000): Promise<SellOutProductMappingRow[]> {
  await ensureSellOutProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    WITH dedup AS (
      SELECT
        source_product_name,
        source_product_name_normalized,
        product_id,
        market_group,
        is_active,
        updated_at,
        ROW_NUMBER() OVER (
          PARTITION BY source_product_name_normalized
          ORDER BY updated_at DESC, source_product_name DESC
        ) AS rn
      FROM \`chiesi-committee.chiesi_committee_admin.sell_out_product_mapping\`
    )
    SELECT
      m.source_product_name,
      m.source_product_name_normalized,
      m.product_id,
      d.canonical_product_code,
      d.canonical_product_name,
      m.market_group,
      m.is_active,
      CAST(m.updated_at AS STRING) AS updated_at
    FROM dedup m
    LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_product\` d
      ON d.product_id = m.product_id
    WHERE m.rn = 1
      AND m.is_active = TRUE
      AND m.source_product_name_normalized NOT IN ('date', 'fecha', 'period', 'periodo')
      AND (
        (m.product_id IS NOT NULL AND TRIM(m.product_id) != '')
        OR (m.market_group IS NOT NULL AND TRIM(m.market_group) != '')
      )
    ORDER BY m.source_product_name ASC
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({ query, params: { limit } });
    return (rows as Record<string, unknown>[]).map((row) => ({
      sourceProductName: String(row.source_product_name ?? ''),
      sourceProductNameNormalized: String(row.source_product_name_normalized ?? ''),
      productId: row.product_id ? String(row.product_id) : null,
      canonicalProductCode: row.canonical_product_code
        ? String(row.canonical_product_code)
        : null,
      canonicalProductName: row.canonical_product_name
        ? String(row.canonical_product_name)
        : null,
      marketGroup: row.market_group ? String(row.market_group) : null,
      isActive: Boolean(row.is_active ?? true),
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    }));
  } catch {
    return [];
  }
}

export async function getStocksProductMappings(limit = 1000): Promise<SellOutProductMappingRow[]> {
  await ensureSellOutProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    WITH source_keys AS (
      SELECT DISTINCT
        LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(NORMALIZE(source_product_raw, NFD), r'\\pM', ''), r'[^a-zA-Z0-9]+', ' '))) AS source_product_name_normalized
      FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_stocks\`
      WHERE source_product_raw IS NOT NULL
        AND TRIM(source_product_raw) != ''
    )
    SELECT
      m.source_product_name,
      m.source_product_name_normalized,
      m.product_id,
      d.canonical_product_code,
      d.canonical_product_name,
      m.market_group,
      m.is_active,
      CAST(m.updated_at AS STRING) AS updated_at
    FROM \`chiesi-committee.chiesi_committee_admin.sell_out_product_mapping\` m
    JOIN source_keys s
      ON s.source_product_name_normalized = m.source_product_name_normalized
    LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_product\` d
      ON d.product_id = m.product_id
    WHERE m.is_active = TRUE
      AND (
        (m.product_id IS NOT NULL AND TRIM(m.product_id) != '')
        OR (m.market_group IS NOT NULL AND TRIM(m.market_group) != '')
      )
    ORDER BY m.source_product_name ASC
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({ query, params: { limit } });
    return (rows as Record<string, unknown>[]).map((row) => ({
      sourceProductName: String(row.source_product_name ?? ''),
      sourceProductNameNormalized: String(row.source_product_name_normalized ?? ''),
      productId: row.product_id ? String(row.product_id) : null,
      canonicalProductCode: row.canonical_product_code ? String(row.canonical_product_code) : null,
      canonicalProductName: row.canonical_product_name ? String(row.canonical_product_name) : null,
      marketGroup: row.market_group ? String(row.market_group) : null,
      isActive: Boolean(row.is_active ?? true),
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    }));
  } catch {
    return [];
  }
}

export async function getSellOutUnmappedProducts(
  limit = 200,
): Promise<SellOutUnmappedProductRow[]> {
  await ensureSellOutProductMappingTable();
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
      SELECT
        key_name AS source_product_name,
        LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(NORMALIZE(key_name, NFD), r'\\pM', ''), r'[^a-zA-Z0-9]+', ' '))) AS source_product_name_normalized,
        CAST(MAX(u.uploaded_at) AS STRING) AS last_seen_at,
        COUNT(1) AS occurrences
      FROM \`chiesi-committee.chiesi_committee_raw.upload_rows_raw\` r
      JOIN \`chiesi-committee.chiesi_committee_raw.uploads\` u
        ON u.upload_id = r.upload_id
      CROSS JOIN UNNEST(JSON_KEYS(r.row_payload_json)) AS key_name
      WHERE LOWER(TRIM(u.module_code)) IN ('business_excellence_budget_sell_out', 'business_excellence_sell_out', 'sell_out')
        AND LOWER(REGEXP_REPLACE(key_name, r'[^a-z0-9]', '')) NOT IN ('date', 'fecha', 'period', 'periodo')
        AND SAFE.PARSE_DATE('%Y-%m-%d', TRIM(key_name)) IS NULL
        AND SAFE.PARSE_DATE('%d/%m/%Y', TRIM(key_name)) IS NULL
        AND SAFE.PARSE_DATE('%m/%d/%Y', TRIM(key_name)) IS NULL
        AND NOT STARTS_WITH(LOWER(key_name), 'column_')
      GROUP BY source_product_name, source_product_name_normalized
      UNION ALL
      SELECT
        s.source_product_raw AS source_product_name,
        LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(NORMALIZE(s.source_product_raw, NFD), r'\\pM', ''), r'[^a-zA-Z0-9]+', ' '))) AS source_product_name_normalized,
        CAST(MAX(u.uploaded_at) AS STRING) AS last_seen_at,
        COUNT(1) AS occurrences
      FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_stocks\` s
      JOIN \`chiesi-committee.chiesi_committee_raw.uploads\` u
        ON u.upload_id = s.upload_id
      WHERE LOWER(TRIM(u.module_code)) IN ('commercial_operations_stocks', 'stocks')
        AND s.source_product_raw IS NOT NULL
        AND TRIM(s.source_product_raw) != ''
      GROUP BY source_product_name, source_product_name_normalized
      UNION ALL
      SELECT
        s.source_product_raw AS source_product_name,
        LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(NORMALIZE(s.source_product_raw, NFD), r'\\pM', ''), r'[^a-zA-Z0-9]+', ' '))) AS source_product_name_normalized,
        CAST(MAX(u.uploaded_at) AS STRING) AS last_seen_at,
        COUNT(1) AS occurrences
      FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_government_contract_progress\` s
      JOIN \`chiesi-committee.chiesi_committee_raw.uploads\` u
        ON u.upload_id = s.upload_id
      WHERE LOWER(TRIM(u.module_code)) IN (
          'commercial_operations_government_contract_progress',
          'government_contract_progress',
          'contract_progress',
          'pcfp'
        )
        AND s.source_product_raw IS NOT NULL
        AND TRIM(s.source_product_raw) != ''
      GROUP BY source_product_name, source_product_name_normalized
    ),
    source_agg AS (
      SELECT
        source_product_name,
        source_product_name_normalized,
        CAST(MAX(SAFE_CAST(last_seen_at AS TIMESTAMP)) AS STRING) AS last_seen_at,
        SUM(occurrences) AS occurrences
      FROM source_columns
      GROUP BY source_product_name, source_product_name_normalized
    )
    SELECT
      s.source_product_name,
      s.source_product_name_normalized,
      s.occurrences,
      s.last_seen_at
    FROM source_agg s
    LEFT JOIN normalized_mapping m
      ON m.source_product_name_normalized = s.source_product_name_normalized
      AND m.is_active = TRUE
      AND (
        (m.product_id IS NOT NULL AND TRIM(m.product_id) != '')
        OR (m.market_group IS NOT NULL AND TRIM(m.market_group) != '')
      )
    WHERE m.source_product_name_normalized IS NULL
      AND NOT REGEXP_CONTAINS(s.source_product_name_normalized, r'^(date|fecha|period|periodo)(\\s|$)')
    ORDER BY s.source_product_name ASC
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params: { limit } });
  return (rows as Record<string, unknown>[]).map((row) => ({
    sourceProductName: String(row.source_product_name ?? ''),
    sourceProductNameNormalized: String(row.source_product_name_normalized ?? ''),
    occurrences: Number(row.occurrences ?? 0),
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
  }));
}

export async function getStocksUnmappedProducts(
  limit = 200,
): Promise<SellOutUnmappedProductRow[]> {
  await ensureSellOutProductMappingTable();
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
      SELECT
        s.source_product_raw AS source_product_name,
        LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(NORMALIZE(s.source_product_raw, NFD), r'\\pM', ''), r'[^a-zA-Z0-9]+', ' '))) AS source_product_name_normalized,
        CAST(MAX(u.uploaded_at) AS STRING) AS last_seen_at,
        COUNT(1) AS occurrences
      FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_stocks\` s
      JOIN \`chiesi-committee.chiesi_committee_raw.uploads\` u
        ON u.upload_id = s.upload_id
      WHERE LOWER(TRIM(u.module_code)) IN ('commercial_operations_stocks', 'stocks')
        AND s.source_product_raw IS NOT NULL
        AND TRIM(s.source_product_raw) != ''
      GROUP BY source_product_name, source_product_name_normalized
    )
    SELECT
      s.source_product_name,
      s.source_product_name_normalized,
      s.occurrences,
      s.last_seen_at
    FROM source_columns s
    LEFT JOIN normalized_mapping m
      ON m.source_product_name_normalized = s.source_product_name_normalized
      AND m.is_active = TRUE
      AND (
        (m.product_id IS NOT NULL AND TRIM(m.product_id) != '')
        OR (m.market_group IS NOT NULL AND TRIM(m.market_group) != '')
      )
    WHERE m.source_product_name_normalized IS NULL
      AND NOT REGEXP_CONTAINS(s.source_product_name_normalized, r'^(date|fecha|period|periodo)(\\s|$)')
    ORDER BY s.source_product_name ASC
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params: { limit } });
  return (rows as Record<string, unknown>[]).map((row) => ({
    sourceProductName: String(row.source_product_name ?? ''),
    sourceProductNameNormalized: String(row.source_product_name_normalized ?? ''),
    occurrences: Number(row.occurrences ?? 0),
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
  }));
}

export async function getContractsProductMappings(limit = 1000): Promise<SellOutProductMappingRow[]> {
  await ensureSellOutProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    WITH source_keys AS (
      SELECT DISTINCT
        LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(NORMALIZE(source_product_raw, NFD), r'\\pM', ''), r'[^a-zA-Z0-9]+', ' '))) AS source_product_name_normalized
      FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_government_contract_progress\`
      WHERE source_product_raw IS NOT NULL
        AND TRIM(source_product_raw) != ''
    )
    SELECT
      m.source_product_name,
      m.source_product_name_normalized,
      m.product_id,
      d.canonical_product_code,
      d.canonical_product_name,
      m.market_group,
      m.is_active,
      CAST(m.updated_at AS STRING) AS updated_at
    FROM \`chiesi-committee.chiesi_committee_admin.sell_out_product_mapping\` m
    JOIN source_keys s
      ON s.source_product_name_normalized = m.source_product_name_normalized
    LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_product\` d
      ON d.product_id = m.product_id
    WHERE m.is_active = TRUE
      AND (
        (m.product_id IS NOT NULL AND TRIM(m.product_id) != '')
        OR (m.market_group IS NOT NULL AND TRIM(m.market_group) != '')
      )
    ORDER BY m.source_product_name ASC
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({ query, params: { limit } });
    return (rows as Record<string, unknown>[]).map((row) => ({
      sourceProductName: String(row.source_product_name ?? ''),
      sourceProductNameNormalized: String(row.source_product_name_normalized ?? ''),
      productId: row.product_id ? String(row.product_id) : null,
      canonicalProductCode: row.canonical_product_code ? String(row.canonical_product_code) : null,
      canonicalProductName: row.canonical_product_name ? String(row.canonical_product_name) : null,
      marketGroup: row.market_group ? String(row.market_group) : null,
      isActive: Boolean(row.is_active ?? true),
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    }));
  } catch {
    return [];
  }
}

export async function getContractsUnmappedProducts(
  limit = 200,
): Promise<SellOutUnmappedProductRow[]> {
  await ensureSellOutProductMappingTable();
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
      SELECT
        s.source_product_raw AS source_product_name,
        LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(NORMALIZE(s.source_product_raw, NFD), r'\\pM', ''), r'[^a-zA-Z0-9]+', ' '))) AS source_product_name_normalized,
        CAST(MAX(u.uploaded_at) AS STRING) AS last_seen_at,
        COUNT(1) AS occurrences
      FROM \`chiesi-committee.chiesi_committee_stg.stg_commercial_operations_government_contract_progress\` s
      JOIN \`chiesi-committee.chiesi_committee_raw.uploads\` u
        ON u.upload_id = s.upload_id
      WHERE LOWER(TRIM(u.module_code)) IN (
          'commercial_operations_government_contract_progress',
          'government_contract_progress',
          'contract_progress',
          'pcfp'
        )
        AND s.source_product_raw IS NOT NULL
        AND TRIM(s.source_product_raw) != ''
      GROUP BY source_product_name, source_product_name_normalized
    )
    SELECT
      s.source_product_name,
      s.source_product_name_normalized,
      s.occurrences,
      s.last_seen_at
    FROM source_columns s
    LEFT JOIN normalized_mapping m
      ON m.source_product_name_normalized = s.source_product_name_normalized
      AND m.is_active = TRUE
      AND (
        (m.product_id IS NOT NULL AND TRIM(m.product_id) != '')
        OR (m.market_group IS NOT NULL AND TRIM(m.market_group) != '')
      )
    WHERE m.source_product_name_normalized IS NULL
      AND NOT REGEXP_CONTAINS(s.source_product_name_normalized, r'^(date|fecha|period|periodo)(\\s|$)')
    ORDER BY s.source_product_name ASC
    LIMIT @limit
  `;

  const [rows] = await client.query({ query, params: { limit } });
  return (rows as Record<string, unknown>[]).map((row) => ({
    sourceProductName: String(row.source_product_name ?? ''),
    sourceProductNameNormalized: String(row.source_product_name_normalized ?? ''),
    occurrences: Number(row.occurrences ?? 0),
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
  }));
}

export async function getSellOutMarketGroups(limit = 300): Promise<string[]> {
  await ensureSellOutProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    SELECT DISTINCT market_group
    FROM \`chiesi-committee.chiesi_committee_admin.sell_out_product_mapping\`
    WHERE market_group IS NOT NULL
      AND TRIM(market_group) != ''
    ORDER BY market_group ASC
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({ query, params: { limit } });
    return (rows as Record<string, unknown>[])
      .map((row) => String(row.market_group ?? '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function getSharedMarketGroups(limit = 500): Promise<string[]> {
  const client = getBigQueryClient();
  const query = `
    WITH all_groups AS (
      SELECT market_group FROM \`chiesi-committee.chiesi_committee_admin.closeup_product_mapping\`
      UNION ALL
      SELECT market_group FROM \`chiesi-committee.chiesi_committee_admin.pmm_product_mapping\`
      UNION ALL
      SELECT market_group FROM \`chiesi-committee.chiesi_committee_admin.sell_out_product_mapping\`
      UNION ALL
      SELECT market_group FROM \`chiesi-committee.chiesi_committee_admin.gob360_product_mapping\`
    )
    SELECT DISTINCT TRIM(market_group) AS market_group
    FROM all_groups
    WHERE market_group IS NOT NULL
      AND TRIM(market_group) != ''
    ORDER BY market_group ASC
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({ query, params: { limit } });
    return (rows as Record<string, unknown>[])
      .map((row) => String(row.market_group ?? '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function upsertGob360ProductMapping(input: {
  sourceClave: string;
  productId?: string;
  marketGroup?: string;
  isActive?: boolean;
  updatedBy?: string;
  createdBy?: string;
}) {
  const sourceClave = input.sourceClave.trim();
  const sourceClaveNormalized = sourceClave
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
  const productId = input.productId?.trim() || '';
  const marketGroup = input.marketGroup?.trim() || '';

  if (!sourceClave || !sourceClaveNormalized) {
    throw new Error('sourceClave is required.');
  }
  const resolvedIsActive = productId || marketGroup ? (input.isActive ?? true) : false;

  await ensureGob360ProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    MERGE \`chiesi-committee.chiesi_committee_admin.gob360_product_mapping\` AS target
    USING (
      SELECT
        @sourceClave AS source_clave,
        @sourceClaveNormalized AS source_clave_normalized,
        NULLIF(@productId, '') AS product_id,
        NULLIF(@marketGroup, '') AS market_group,
        @isActive AS is_active,
        @createdBy AS created_by,
        @updatedBy AS updated_by
    ) AS source
    ON target.source_clave_normalized = source.source_clave_normalized
    WHEN MATCHED THEN
      UPDATE SET
        source_clave = source.source_clave,
        product_id = source.product_id,
        market_group = source.market_group,
        is_active = source.is_active,
        updated_by = source.updated_by,
        updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN
      INSERT (
        source_clave,
        source_clave_normalized,
        product_id,
        market_group,
        is_active,
        created_at,
        created_by,
        updated_at,
        updated_by
      )
      VALUES (
        source.source_clave,
        source.source_clave_normalized,
        source.product_id,
        source.market_group,
        source.is_active,
        CURRENT_TIMESTAMP(),
        source.created_by,
        CURRENT_TIMESTAMP(),
        source.updated_by
      )
  `;

  await client.query({
    query,
    params: {
      sourceClave,
      sourceClaveNormalized,
      productId,
      marketGroup,
      isActive: resolvedIsActive,
      createdBy: input.createdBy?.trim() || 'system',
      updatedBy: input.updatedBy?.trim() || 'system',
    },
  });

  return { ok: true, sourceClave, sourceClaveNormalized, productId, marketGroup };
}

export async function getGob360ProductMappings(limit = 1000): Promise<Gob360ProductMappingRow[]> {
  await ensureGob360ProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    SELECT
      m.source_clave,
      m.source_clave_normalized,
      m.product_id,
      m.market_group,
      d.canonical_product_code,
      d.canonical_product_name,
      m.is_active,
      CAST(m.updated_at AS STRING) AS updated_at
    FROM \`chiesi-committee.chiesi_committee_admin.gob360_product_mapping\` m
    LEFT JOIN \`chiesi-committee.chiesi_committee_core.dim_product\` d
      ON d.product_id = m.product_id
    WHERE m.is_active = TRUE
      AND (
        (m.product_id IS NOT NULL AND TRIM(m.product_id) != '')
        OR (m.market_group IS NOT NULL AND TRIM(m.market_group) != '')
      )
    ORDER BY m.source_clave ASC
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({ query, params: { limit } });
    return (rows as Record<string, unknown>[]).map((row) => ({
      sourceClave: String(row.source_clave ?? ''),
      sourceClaveNormalized: String(row.source_clave_normalized ?? ''),
      productId: row.product_id ? String(row.product_id) : null,
      marketGroup: row.market_group ? String(row.market_group) : null,
      canonicalProductCode: row.canonical_product_code
        ? String(row.canonical_product_code)
        : null,
      canonicalProductName: row.canonical_product_name
        ? String(row.canonical_product_name)
        : null,
      isActive: Boolean(row.is_active ?? true),
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    }));
  } catch {
    return [];
  }
}

export async function getGob360UnmappedClaves(limit = 300): Promise<Gob360UnmappedClaveRow[]> {
  await ensureGob360ProductMappingTable();
  const gobClient = getGob360Client();
  const localClient = getBigQueryClient();
  const projectId = process.env.GOB360_PROJECT_ID || process.env.GCP_PROJECT_ID || 'chiesi-committee';
  const datasetId = process.env.GOB360_DATASET_ID || 'CHIESI_EXTERNAL';
  const pcTable = process.env.GOB360_PC_TABLE || 'CHIESI_PC_VENTAS_EXTERNAL';
  const scTable = process.env.GOB360_SC_TABLE || 'CHIESI_SC_VENTAS_EXTERNAL';

  const sourceQuery = `
    WITH source_claves AS (
      SELECT CAST(CLAVE AS STRING) AS source_clave
      FROM \`${projectId}.${datasetId}.${pcTable}\`
      WHERE CLAVE IS NOT NULL AND TRIM(CAST(CLAVE AS STRING)) != ''
      UNION ALL
      SELECT CAST(CLAVE AS STRING) AS source_clave
      FROM \`${projectId}.${datasetId}.${scTable}\`
      WHERE CLAVE IS NOT NULL AND TRIM(CAST(CLAVE AS STRING)) != ''
    ),
    normalized AS (
      SELECT
        source_clave,
        LOWER(REGEXP_REPLACE(TRIM(source_clave), r'[^a-zA-Z0-9]+', '')) AS source_clave_normalized
      FROM source_claves
    ),
    grouped AS (
      SELECT
        ANY_VALUE(source_clave) AS source_clave,
        source_clave_normalized,
        COUNT(1) AS occurrences
      FROM normalized
      WHERE source_clave_normalized IS NOT NULL AND source_clave_normalized != ''
      GROUP BY source_clave_normalized
    )
    SELECT
      source_clave,
      source_clave_normalized,
      occurrences
    FROM grouped
    ORDER BY source_clave ASC
    LIMIT @scanLimit
  `;

  try {
    const scanLimit = Math.max(limit * 20, 5000);
    const [sourceRows, mappedRows] = await Promise.all([
      gobClient.query({
        query: sourceQuery,
        params: { scanLimit },
        location: 'US',
      }),
      localClient.query({
        query: `
          SELECT source_clave_normalized
          FROM \`chiesi-committee.chiesi_committee_admin.gob360_product_mapping\`
          WHERE is_active = TRUE
            AND (
              (product_id IS NOT NULL AND TRIM(product_id) != '')
              OR (market_group IS NOT NULL AND TRIM(market_group) != '')
            )
        `,
      }),
    ]);

    const mappedSet = new Set(
      (mappedRows[0] as Record<string, unknown>[])
        .map((row) => String(row.source_clave_normalized ?? '').trim())
        .filter(Boolean),
    );

    const unmapped = (sourceRows[0] as Record<string, unknown>[])
      .filter((row) => {
        const normalized = String(row.source_clave_normalized ?? '').trim();
        return normalized.length > 0 && !mappedSet.has(normalized);
      })
      .slice(0, limit)
      .map((row) => ({
        sourceClave: String(row.source_clave ?? ''),
        sourceClaveNormalized: String(row.source_clave_normalized ?? ''),
        occurrences: Number(row.occurrences ?? 0),
      }));

    return unmapped;
  } catch {
    return [];
  }
}

export async function getGob360MarketGroups(limit = 300): Promise<string[]> {
  await ensureGob360ProductMappingTable();
  const client = getBigQueryClient();
  const query = `
    SELECT DISTINCT market_group
    FROM \`chiesi-committee.chiesi_committee_admin.gob360_product_mapping\`
    WHERE market_group IS NOT NULL
      AND TRIM(market_group) != ''
    ORDER BY market_group ASC
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({ query, params: { limit } });
    return (rows as Record<string, unknown>[])
      .map((row) => String(row.market_group ?? '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export type Gob360ConnectionTestResult = {
  ok: boolean;
  projectId: string;
  datasetId: string;
  clientEmail: string;
  sessionUser: string | null;
  pcTableReachable: boolean;
  scTableReachable: boolean;
  pcSampleClave: string | null;
  scSampleClave: string | null;
  errorMessage: string | null;
};

export async function testGob360Connection(): Promise<Gob360ConnectionTestResult> {
  const client = getGob360Client();
  const projectId = process.env.GOB360_PROJECT_ID || process.env.GCP_PROJECT_ID || 'chiesi-committee';
  const datasetId = process.env.GOB360_DATASET_ID || 'CHIESI_EXTERNAL';
  const pcTable = process.env.GOB360_PC_TABLE || 'CHIESI_PC_VENTAS_EXTERNAL';
  const scTable = process.env.GOB360_SC_TABLE || 'CHIESI_SC_VENTAS_EXTERNAL';
  const clientEmail = process.env.GOB360_CLIENT_EMAIL || '';

  try {
    const [whoRows] = await client.query({
      query: 'SELECT SESSION_USER() AS session_user',
      location: 'US',
    });
    const sessionUser = (whoRows as Array<Record<string, unknown>>)[0]?.session_user
      ? String((whoRows as Array<Record<string, unknown>>)[0].session_user)
      : null;

    let pcTableReachable = false;
    let scTableReachable = false;
    let pcSampleClave: string | null = null;
    let scSampleClave: string | null = null;

    try {
      const [pcRows] = await client.query({
        query: `SELECT CAST(CLAVE AS STRING) AS clave FROM \`${projectId}.${datasetId}.${pcTable}\` LIMIT 1`,
        location: 'US',
      });
      pcTableReachable = true;
      pcSampleClave = (pcRows as Array<Record<string, unknown>>)[0]?.clave
        ? String((pcRows as Array<Record<string, unknown>>)[0].clave)
        : null;
    } catch {
      pcTableReachable = false;
    }

    try {
      const [scRows] = await client.query({
        query: `SELECT CAST(CLAVE AS STRING) AS clave FROM \`${projectId}.${datasetId}.${scTable}\` LIMIT 1`,
        location: 'US',
      });
      scTableReachable = true;
      scSampleClave = (scRows as Array<Record<string, unknown>>)[0]?.clave
        ? String((scRows as Array<Record<string, unknown>>)[0].clave)
        : null;
    } catch {
      scTableReachable = false;
    }

    return {
      ok: pcTableReachable && scTableReachable,
      projectId,
      datasetId,
      clientEmail,
      sessionUser,
      pcTableReachable,
      scTableReachable,
      pcSampleClave,
      scSampleClave,
      errorMessage: null,
    };
  } catch (error) {
    return {
      ok: false,
      projectId,
      datasetId,
      clientEmail,
      sessionUser: null,
      pcTableReachable: false,
      scTableReachable: false,
      pcSampleClave: null,
      scSampleClave: null,
      errorMessage: error instanceof Error ? error.message : 'Unknown GOB360 error',
    };
  }
}


