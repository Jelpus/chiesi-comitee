CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_business_excellence_weekly_enriched` AS
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
normalized_weekly_base AS (
  SELECT
    w.*,
    REGEXP_REPLACE(LOWER(TRIM(COALESCE(w.brick_code, ''))), r'[^a-z0-9]', '') AS brick_code_normalized,
    LOWER(
      TRIM(
        REGEXP_REPLACE(
          REGEXP_REPLACE(NORMALIZE(COALESCE(w.pack_des, ''), NFD), r'\\pM', ''),
          r'[^a-zA-Z0-9]+',
          ' '
        )
      )
    ) AS pack_des_normalized
  FROM `chiesi-committee.chiesi_committee_stg.stg_business_excellence_weekly_tracking` w
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
active_brick_assignment AS (
  SELECT
    brick_code,
    brick_description,
    state,
    district,
    manager,
    territory,
    visited
  FROM (
    SELECT
      b.*,
      ROW_NUMBER() OVER (
        PARTITION BY REGEXP_REPLACE(LOWER(TRIM(COALESCE(b.brick_code, ''))), r'[^a-z0-9]', '')
        ORDER BY b.period_month DESC, b.row_number DESC
      ) AS rn
    FROM `chiesi-committee.chiesi_committee_stg.stg_business_excellence_brick_assignment` b
  )
  WHERE rn = 1
)
SELECT
  w.upload_id,
  w.row_number,
  u.reporting_version_id,
  rv.period_month AS report_period_month,
  u.source_as_of_month,
  u.uploaded_at AS source_uploaded_at,
  w.week_raw,
  w.period_month,
  w.brick_code,
  w.brick_code_normalized,
  COALESCE(NULLIF(ba.brick_description, ''), w.brick_description) AS brick_description,
  w.prod_des,
  w.prod_code,
  w.pack_des,
  w.pack_des_normalized,
  w.atciv_code,
  w.atciv_desc,
  w.pack_code,
  w.market_code,
  w.sales_group,
  w.amount_value,
  CAST(NULL AS STRING) AS source_product_id,
  map.product_id AS mapped_product_id,
  map.product_id AS resolved_product_id,
  map.market_group AS market_group,
  d.canonical_product_code,
  COALESCE(
    NULLIF(d.canonical_product_name, ''),
    NULLIF(w.pack_des, ''),
    NULLIF(w.prod_des, ''),
    NULLIF(w.prod_code, '')
  ) AS canonical_product_name,
  pm.brand_name,
  pm.subbrand_or_device,
  pm.product_group,
  pm.business_unit_code,
  pm.business_unit_name,
  pm.portfolio_name,
  pm.lifecycle_status,
  pm.display_order,
  pm.notes,
  ba.state,
  ba.district,
  ba.manager,
  ba.territory,
  COALESCE(ba.visited, FALSE) AS visited
FROM normalized_weekly_base w
JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
  ON u.upload_id = w.upload_id
LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
  ON rv.reporting_version_id = u.reporting_version_id
LEFT JOIN active_pmm_mapping map
  ON map.source_pack_des_normalized = w.pack_des_normalized
LEFT JOIN `chiesi-committee.chiesi_committee_core.dim_product` d
  ON d.product_id = map.product_id
LEFT JOIN product_metadata_dedup pm
  ON pm.product_id = map.product_id
LEFT JOIN active_brick_assignment ba
  ON LTRIM(w.brick_code_normalized, '0')
   = LTRIM(REGEXP_REPLACE(LOWER(TRIM(COALESCE(ba.brick_code, ''))), r'[^a-z0-9]', ''), '0')
WHERE LOWER(TRIM(u.module_code)) IN (
  'business_excellence_iqvia_weekly',
  'business_excellence_weekly_tracking',
  'iqvia_weekly',
  'weekly_tracking'
)
  AND u.status IN ('normalized', 'published');
