CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_business_excellence_budget_sell_out_enriched` AS
WITH active_sell_out_mapping AS (
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
    FROM `chiesi-committee.chiesi_committee_admin.sell_out_product_mapping` m
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
direct_upload_scope AS (
  SELECT
    u.upload_id,
    u.reporting_version_id,
    u.period_month AS upload_period_month,
    u.source_as_of_month,
    u.uploaded_at,
    u.source_file_name,
    u.ddd_source,
    u.module_code
  FROM `chiesi-committee.chiesi_committee_raw.uploads` u
  WHERE LOWER(TRIM(u.module_code)) IN (
    'business_excellence_budget_sell_out',
    'business_excellence_sell_out',
    'sell_out'
  )
    AND u.status IN ('normalized', 'published')
),
reuse_upload_scope AS (
  SELECT
    original.upload_id,
    reuse.reporting_version_id,
    reuse.period_month AS upload_period_month,
    original.source_as_of_month,
    original.uploaded_at,
    original.source_file_name,
    original.ddd_source,
    original.module_code
  FROM `chiesi-committee.chiesi_committee_admin.prepare_reuse_confirmations` reuse
  JOIN `chiesi-committee.chiesi_committee_raw.uploads` original
    ON original.upload_id = reuse.original_upload_id
  WHERE LOWER(TRIM(reuse.module_code)) IN (
    'business_excellence_budget_sell_out',
    'business_excellence_sell_out',
    'sell_out'
  )
    AND LOWER(TRIM(original.module_code)) IN (
      'business_excellence_budget_sell_out',
      'business_excellence_sell_out',
      'sell_out'
    )
    AND original.status IN ('normalized', 'published')
    AND NOT EXISTS (
      SELECT 1
      FROM direct_upload_scope direct
      WHERE direct.reporting_version_id = reuse.reporting_version_id
        AND LOWER(TRIM(direct.module_code)) = LOWER(TRIM(reuse.module_code))
        AND COALESCE(LOWER(TRIM(direct.ddd_source)), '') = COALESCE(LOWER(TRIM(reuse.ddd_source)), '')
    )
),
upload_scope AS (
  SELECT * FROM direct_upload_scope
  UNION ALL
  SELECT * FROM reuse_upload_scope
),
budget_resolved AS (
  SELECT
    s.*,
    u.reporting_version_id,
    rv.period_month AS report_period_month,
    u.source_as_of_month,
    u.uploaded_at AS source_uploaded_at,
    COALESCE(
      NULLIF(TRIM(u.ddd_source), ''),
      CASE
        WHEN LOWER(u.source_file_name) LIKE '%privado%' THEN 'privado'
        WHEN LOWER(u.source_file_name) LIKE '%private%' THEN 'privado'
        WHEN LOWER(u.source_file_name) LIKE '%gobierno%' THEN 'gobierno'
        WHEN LOWER(u.source_file_name) LIKE '%government%' THEN 'gobierno'
        ELSE 'unknown'
      END
    ) AS source_scope,
    map.product_id AS mapped_product_id,
    COALESCE(map.product_id, s.product_id) AS resolved_product_id_raw,
    CASE
      WHEN COALESCE(map.product_id, s.product_id) = 'PRD_000012' THEN 'PRD_000007'
      ELSE COALESCE(map.product_id, s.product_id)
    END AS resolved_product_id,
    CASE
      WHEN UPPER(TRIM(COALESCE(s.sales_group, ''))) = 'UNITS'
       AND COALESCE(map.product_id, s.product_id) = 'PRD_000012'
      THEN s.amount_value * 2
      ELSE s.amount_value
    END AS amount_value_adjusted
  FROM `chiesi-committee.chiesi_committee_stg.stg_business_excellence_budget_sell_out` s
  JOIN upload_scope u
    ON u.upload_id = s.upload_id
  LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
    ON rv.reporting_version_id = u.reporting_version_id
  LEFT JOIN active_sell_out_mapping map
    ON map.source_product_name_normalized = s.source_product_normalized
)
SELECT
  s.upload_id,
  s.row_number,
  s.reporting_version_id,
  s.report_period_month,
  s.source_as_of_month,
  s.source_uploaded_at,
  s.source_scope,
  s.period_month,
  s.channel,
  s.sales_group,
  s.amount_value_adjusted AS amount_value,
  s.source_product_raw,
  s.source_product_normalized,
  s.product_id AS source_product_id,
  s.mapped_product_id,
  s.resolved_product_id,
  COALESCE(NULLIF(map.market_group, ''), NULLIF(s.market_group, '')) AS market_group,
  d.canonical_product_code,
  COALESCE(
    NULLIF(d.canonical_product_name, ''),
    NULLIF(s.canonical_product_name, ''),
    s.source_product_raw
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
FROM budget_resolved s
LEFT JOIN active_sell_out_mapping map
  ON map.source_product_name_normalized = s.source_product_normalized
LEFT JOIN `chiesi-committee.chiesi_committee_core.dim_product` d
  ON d.product_id = s.resolved_product_id
LEFT JOIN product_metadata_dedup pm
  ON pm.product_id = s.resolved_product_id
;
