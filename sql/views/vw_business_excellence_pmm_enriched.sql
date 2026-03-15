CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_business_excellence_pmm_enriched` AS
WITH active_pmm_mapping AS (
  SELECT
    source_pack_des,
    source_pack_des_normalized,
    product_id,
    market_group
  FROM (
    SELECT
      m.*,
      ROW_NUMBER() OVER (
        PARTITION BY m.source_pack_des_normalized
        ORDER BY m.updated_at DESC, m.created_at DESC
      ) AS rn
    FROM `chiesi-committee.chiesi_committee_admin.pmm_product_mapping` m
    WHERE m.is_active = TRUE
  )
  WHERE rn = 1
),
normalized_pmm_base AS (
  SELECT
    p.*,
    NULLIF(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(COALESCE(p.brick, '')), r'\\s+', ''), r'^0+', ''), '') AS brick_join_key
  FROM `chiesi-committee.chiesi_committee_stg.stg_business_excellence_pmm` p
),
product_metadata_dedup AS (
  SELECT
    product_id,
    brand_name,
    subbrand_or_device,
    product_group,
    business_unit_code,
    business_unit_name,
    portfolio_name,
    lifecycle_status,
    display_order,
    notes
  FROM (
    SELECT
      pm.*,
      ROW_NUMBER() OVER (
        PARTITION BY pm.product_id
        ORDER BY pm.updated_at DESC, pm.created_at DESC
      ) AS rn
    FROM `chiesi-committee.chiesi_committee_admin.product_metadata` pm
  )
  WHERE rn = 1
),
brick_assignment_dedup AS (
  SELECT
    reporting_version_id,
    brick_code,
    brick_join_key,
    brick_description,
    state,
    category,
    district,
    territory_id,
    manager,
    territory,
    visited
  FROM (
    SELECT
      u.reporting_version_id,
      b.brick_code,
      NULLIF(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(COALESCE(b.brick_code, '')), r'\\s+', ''), r'^0+', ''), '') AS brick_join_key,
      b.brick_description,
      b.state,
      b.category,
      b.district,
      b.territory_id,
      b.manager,
      b.territory,
      b.visited,
      ROW_NUMBER() OVER (
        PARTITION BY u.reporting_version_id, b.brick_code
        ORDER BY u.uploaded_at DESC, b.row_number DESC
      ) AS rn
    FROM `chiesi-committee.chiesi_committee_stg.stg_business_excellence_brick_assignment` b
    JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
      ON u.upload_id = b.upload_id
    WHERE LOWER(TRIM(u.module_code)) IN (
      'business_excellence_brick_assignment',
      'business_excellence_bricks_visited',
      'bricks_visited'
    )
      AND u.status IN ('normalized', 'published')
  )
  WHERE rn = 1
)
SELECT
  p.upload_id,
  p.row_number,
  u.reporting_version_id,
  rv.period_month AS report_period_month,
  u.source_as_of_month,
  u.uploaded_at AS source_uploaded_at,
  COALESCE(
    NULLIF(TRIM(u.ddd_source), ''),
    CASE
      WHEN LOWER(u.source_file_name) LIKE '%innovair%' THEN 'innovair'
      WHEN LOWER(u.source_file_name) LIKE '%ribuspir%' THEN 'ribuspir'
      WHEN LOWER(u.source_file_name) LIKE '%rinoclenil%' THEN 'rinoclenil'
      ELSE 'unknown'
    END
  ) AS ddd_source,
  p.period_month,
  p.source_date,
  p.source_month_raw,
  p.source_year_raw,
  p.sales_group,
  p.amount_value,
  p.pack_des_raw,
  p.pack_des_normalized,
  p.brick,
  p.product_id AS source_product_id,
  map.product_id AS mapped_product_id,
  COALESCE(map.product_id, p.product_id) AS resolved_product_id,
  COALESCE(NULLIF(map.market_group, ''), NULLIF(p.market_group, '')) AS market_group,
  d.canonical_product_code,
  COALESCE(
    NULLIF(d.canonical_product_name, ''),
    NULLIF(p.canonical_product_name, ''),
    p.pack_des_raw
  ) AS canonical_product_name,
  ba.brick_code,
  ba.brick_description,
  ba.state,
  ba.category,
  ba.district,
  ba.territory_id,
  ba.manager,
  ba.territory,
  ba.visited,
  pm.brand_name,
  pm.subbrand_or_device,
  pm.product_group,
  pm.business_unit_code,
  pm.business_unit_name,
  pm.portfolio_name,
  pm.lifecycle_status,
  pm.display_order,
  pm.notes
FROM normalized_pmm_base p
JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
  ON u.upload_id = p.upload_id
LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
  ON rv.reporting_version_id = u.reporting_version_id
LEFT JOIN active_pmm_mapping map
  ON map.source_pack_des_normalized = p.pack_des_normalized
LEFT JOIN `chiesi-committee.chiesi_committee_core.dim_product` d
  ON d.product_id = COALESCE(map.product_id, p.product_id)
LEFT JOIN product_metadata_dedup pm
  ON pm.product_id = COALESCE(map.product_id, p.product_id)
LEFT JOIN brick_assignment_dedup ba
  ON ba.reporting_version_id = u.reporting_version_id
 AND ba.brick_join_key = p.brick_join_key
WHERE LOWER(TRIM(u.module_code)) IN ('business_excellence_ddd', 'business_excellence_pmm', 'pmm', 'ddd')
  AND u.status IN ('normalized', 'published');
