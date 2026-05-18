CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_commercial_operations_sanctions_enriched` AS
WITH active_sanctions_mapping AS (
  SELECT source_product_name, source_product_name_normalized, product_id, market_group
  FROM (
    SELECT
      m.*,
      ROW_NUMBER() OVER (
        PARTITION BY m.source_product_name_normalized
        ORDER BY m.updated_at DESC, m.created_at DESC
      ) AS rn
    FROM `chiesi-committee.chiesi_committee_admin.sanctions_product_mapping` m
    WHERE m.is_active = TRUE
  )
  WHERE rn = 1
),
product_metadata_dedup AS (
  SELECT *
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
staged AS (
  SELECT
    s.*,
    u.reporting_version_id,
    rv.period_month AS report_period_month,
    u.source_as_of_month,
    u.uploaded_at AS source_uploaded_at
  FROM `chiesi-committee.chiesi_committee_stg.stg_commercial_operations_sanctions` s
  JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
    ON u.upload_id = s.upload_id
  LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
    ON rv.reporting_version_id = u.reporting_version_id
  WHERE LOWER(TRIM(u.module_code)) IN ('commercial_operations_sanctions', 'sanctions')
    AND LOWER(TRIM(u.status)) IN ('normalized', 'published')
),
base AS (
  SELECT
    s.upload_id,
    s.row_number,
    s.reporting_version_id,
    s.report_period_month,
    s.source_as_of_month,
    s.source_uploaded_at,
    s.period_month,
    s.provision_year,
    s.estimated_month_raw,
    s.sanction_date,
    s.order_number,
    s.document_number,
    s.contract_number,
    s.client_institution,
    s.business_unit,
    s.sanction_responsible,
    s.channel_raw,
    s.channel_group,
    s.source_product_raw,
    s.source_product_normalized,
    s.sku,
    map.product_id AS mapped_product_id,
    map.product_id AS resolved_product_id,
    map.market_group AS market_group,
    d.canonical_product_code AS canonical_product_code,
    COALESCE(NULLIF(d.canonical_product_name, ''), s.source_product_raw) AS canonical_product_name,
    pm.brand_name AS brand_name,
    pm.business_unit_name AS product_business_unit_name,
    s.sanction_type,
    s.sanction_reason,
    s.sanction_status,
    s.sanction_amount,
    s.invoiced_amount,
    s.days_count,
    s.observations,
    s.source_payload_json,
    s.normalized_at
  FROM staged s
  LEFT JOIN active_sanctions_mapping map
    ON map.source_product_name_normalized = s.source_product_normalized
  LEFT JOIN `chiesi-committee.chiesi_committee_core.dim_product` d
    ON d.product_id = map.product_id
  LEFT JOIN product_metadata_dedup pm
    ON pm.product_id = map.product_id
),
max_ref AS (
  SELECT
    reporting_version_id,
    COALESCE(
      GREATEST(MAX(source_as_of_month), MAX(report_period_month)),
      MAX(source_as_of_month),
      MAX(report_period_month),
      MAX(period_month)
    ) AS reference_cutoff_month
  FROM base
  GROUP BY reporting_version_id
),
effective_ref AS (
  SELECT
    b.reporting_version_id,
    COALESCE(
      MAX(IF(b.period_month <= m.reference_cutoff_month, b.period_month, NULL)),
      MAX(b.period_month)
    ) AS max_effective_period_month
  FROM base b
  JOIN max_ref m
    ON m.reporting_version_id = b.reporting_version_id
  GROUP BY b.reporting_version_id
)
SELECT
  b.*,
  e.max_effective_period_month AS latest_period_month,
  DATE_SUB(e.max_effective_period_month, INTERVAL 1 YEAR) AS latest_period_month_py,
  CASE
    WHEN EXTRACT(YEAR FROM b.period_month) = EXTRACT(YEAR FROM e.max_effective_period_month)
      AND EXTRACT(MONTH FROM b.period_month) <= EXTRACT(MONTH FROM e.max_effective_period_month)
    THEN TRUE ELSE FALSE
  END AS is_ytd,
  CASE WHEN b.period_month = e.max_effective_period_month THEN TRUE ELSE FALSE END AS is_mth,
  CASE
    WHEN EXTRACT(YEAR FROM b.period_month) = EXTRACT(YEAR FROM e.max_effective_period_month) - 1
      AND EXTRACT(MONTH FROM b.period_month) <= EXTRACT(MONTH FROM e.max_effective_period_month)
    THEN TRUE ELSE FALSE
  END AS is_ytd_py,
  CASE WHEN b.period_month = DATE_SUB(e.max_effective_period_month, INTERVAL 1 YEAR) THEN TRUE ELSE FALSE END AS is_mth_py
FROM base b
JOIN effective_ref e
  ON e.reporting_version_id = b.reporting_version_id;
