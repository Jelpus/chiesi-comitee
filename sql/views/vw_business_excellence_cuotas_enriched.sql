CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_business_excellence_cuotas_enriched` AS
WITH active_cuotas_mapping AS (
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
    FROM `chiesi-committee.chiesi_committee_admin.cuotas_product_mapping` m
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
),
resolved AS (
  SELECT
    s.*,
    u.reporting_version_id,
    rv.period_month AS report_period_month,
    u.source_as_of_month,
    u.uploaded_at AS source_uploaded_at,
    map.product_id AS mapped_product_id,
    COALESCE(map.product_id, s.product_id) AS resolved_product_id,
    ROW_NUMBER() OVER (
      PARTITION BY
        u.reporting_version_id,
        s.period_month,
        s.business_unit,
        s.advisor,
        s.manager,
        s.source_product_normalized,
        LOWER(TRIM(s.channel))
      ORDER BY u.uploaded_at DESC, s.normalized_at DESC, s.upload_id DESC, s.row_number DESC
    ) AS rn
  FROM `chiesi-committee.chiesi_committee_stg.stg_business_excellence_cuotas` s
  JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
    ON u.upload_id = s.upload_id
  LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
    ON rv.reporting_version_id = u.reporting_version_id
  LEFT JOIN active_cuotas_mapping map
    ON map.source_product_name_normalized = s.source_product_normalized
  WHERE LOWER(TRIM(u.module_code)) IN ('business_excellence_cuotas', 'cuotas')
    AND u.status IN ('normalized', 'published')
)
SELECT
  r.upload_id,
  r.row_number,
  r.reporting_version_id,
  r.report_period_month,
  r.source_as_of_month,
  r.source_uploaded_at,
  r.business_unit,
  r.advisor,
  r.manager,
  r.period_raw,
  r.period_month,
  r.channel,
  r.quota_value,
  r.source_product_raw,
  r.source_product_normalized,
  r.product_id AS source_product_id,
  r.mapped_product_id,
  r.resolved_product_id,
  COALESCE(NULLIF(map.market_group, ''), NULLIF(r.market_group, '')) AS market_group,
  d.canonical_product_code,
  COALESCE(
    NULLIF(d.canonical_product_name, ''),
    NULLIF(r.canonical_product_name, ''),
    r.source_product_raw
  ) AS canonical_product_name,
  pm.brand_name,
  pm.subbrand_or_device,
  pm.product_group,
  pm.business_unit_code,
  pm.business_unit_name,
  pm.portfolio_name,
  pm.lifecycle_status,
  pm.display_order,
  pm.notes
FROM resolved r
LEFT JOIN active_cuotas_mapping map
  ON map.source_product_name_normalized = r.source_product_normalized
LEFT JOIN `chiesi-committee.chiesi_committee_core.dim_product` d
  ON d.product_id = r.resolved_product_id
LEFT JOIN product_metadata_dedup pm
  ON pm.product_id = r.resolved_product_id
WHERE r.rn = 1;
