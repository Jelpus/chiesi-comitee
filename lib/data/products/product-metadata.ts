import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';

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


