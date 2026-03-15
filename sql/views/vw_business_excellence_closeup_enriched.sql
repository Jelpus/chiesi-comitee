CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_business_excellence_closeup_enriched` AS
WITH active_closeup_mapping AS (
  SELECT
    source_product_name,
    source_product_name_normalized,
    product_id,
    market_group
  FROM (
    SELECT
      m.*,
      ROW_NUMBER() OVER (
        PARTITION BY m.source_product_name_normalized
        ORDER BY m.updated_at DESC, m.created_at DESC
      ) AS rn
    FROM `chiesi-committee.chiesi_committee_admin.closeup_product_mapping` m
    WHERE m.is_active = TRUE
  )
  WHERE rn = 1
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
)
SELECT
  c.upload_id,
  c.row_number,
  u.reporting_version_id,
  rv.period_month AS report_period_month,
  u.source_as_of_month,
  u.uploaded_at AS source_uploaded_at,
  c.source_date_raw,
  c.source_date,
  c.period_raw,
  c.period_month,
  c.specialty,
  c.recetas_value,
  c.product_closeup_raw,
  c.product_closeup_normalized,
  c.product_id AS source_product_id,
  map.product_id AS mapped_product_id,
  COALESCE(map.product_id, c.product_id) AS resolved_product_id,
  COALESCE(NULLIF(map.market_group, ''), NULLIF(c.market_group, '')) AS market_group,
  d.canonical_product_code,
  COALESCE(
    NULLIF(d.canonical_product_name, ''),
    NULLIF(c.canonical_product_name, ''),
    c.product_closeup_raw
  ) AS canonical_product_name,
  c.visited_source_raw,
  c.visited,
  pm.brand_name,
  pm.subbrand_or_device,
  pm.product_group,
  pm.business_unit_code,
  pm.business_unit_name,
  pm.portfolio_name,
  pm.lifecycle_status,
  pm.display_order,
  pm.notes
FROM `chiesi-committee.chiesi_committee_stg.stg_business_excellence_closeup` c
JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
  ON u.upload_id = c.upload_id
LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
  ON rv.reporting_version_id = u.reporting_version_id
LEFT JOIN active_closeup_mapping map
  ON map.source_product_name_normalized = c.product_closeup_normalized
LEFT JOIN `chiesi-committee.chiesi_committee_core.dim_product` d
  ON d.product_id = COALESCE(map.product_id, c.product_id)
LEFT JOIN product_metadata_dedup pm
  ON pm.product_id = COALESCE(map.product_id, c.product_id)
WHERE LOWER(TRIM(u.module_code)) IN ('business_excellence_closeup', 'closeup')
  AND u.status IN ('normalized', 'published');
