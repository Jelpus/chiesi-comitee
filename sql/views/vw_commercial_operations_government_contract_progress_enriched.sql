CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_commercial_operations_government_contract_progress_enriched` AS
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
base AS (
  SELECT
    s.upload_id,
    s.row_number,
    u.reporting_version_id,
    rv.period_month AS report_period_month,
    u.source_as_of_month,
    u.uploaded_at AS source_uploaded_at,
    s.contract_key,
    s.contract_type,
    s.vigencia,
    s.category,
    s.responsible,
    s.cb_code,
    s.source_product_raw,
    s.source_product_normalized,
    CAST(NULL AS STRING) AS source_product_id,
    map.product_id AS mapped_product_id,
    map.product_id AS resolved_product_id,
    map.market_group,
    d.canonical_product_code,
    COALESCE(NULLIF(d.canonical_product_name, ''), s.source_product_raw) AS canonical_product_name,
    pm.brand_name,
    pm.subbrand_or_device,
    pm.product_group,
    pm.business_unit_code,
    pm.business_unit_name,
    pm.portfolio_name,
    pm.lifecycle_status,
    pm.display_order,
    pm.notes,
    s.tender_number,
    s.contract_number,
    s.event_type,
    s.centralized_opd,
    s.central_institution,
    s.institution,
    s.assigned_to,
    s.business_model,
    s.assignment_status,
    s.business_unit,
    s.period_month,
    s.delivered_quantity,
    COALESCE(
      SAFE_CAST(
        REGEXP_REPLACE(
          COALESCE(
            JSON_VALUE(s.source_payload_json, '$."CANTIDAD MÁXIMA 2025"'),
            JSON_VALUE(s.source_payload_json, '$."CANTIDAD MAXIMA 2025"'),
            JSON_VALUE(s.source_payload_json, '$."CANTIDAD MÃXIMA 2025"')
          ),
          r'[^0-9\-]',
          ''
        ) AS NUMERIC
      ),
      s.max_quantity_2025
    ) AS max_quantity_2025,
    COALESCE(
      SAFE_CAST(
        REGEXP_REPLACE(
          COALESCE(
            JSON_VALUE(s.source_payload_json, '$."CANTIDAD MÁXIMA 2026"'),
            JSON_VALUE(s.source_payload_json, '$."CANTIDAD MAXIMA 2026"'),
            JSON_VALUE(s.source_payload_json, '$."CANTIDAD MÃXIMA 2026"')
          ),
          r'[^0-9\-]',
          ''
        ) AS NUMERIC
      ),
      s.max_quantity_2026
    ) AS max_quantity_2026,
    s.total_2025,
    s.total_2026,
    COALESCE(
      SAFE_CAST(
        REGEXP_REPLACE(
          COALESCE(
            JSON_VALUE(s.source_payload_json, '$."TOTAL 2025-2026"')
          ),
          r'[^0-9\-]',
          ''
        ) AS NUMERIC
      ),
      s.total_2025_2026
    ) AS total_2025_2026,
    s.progress_pct_total,
    s.progress_pct_2025,
    s.progress_pct_2026,
    COALESCE(
      SAFE_CAST(
        REGEXP_REPLACE(
          COALESCE(
            JSON_VALUE(s.source_payload_json, '$."CANTIDAD TOTAL DEL CONTRATO"')
          ),
          r'[^0-9\-]',
          ''
        ) AS NUMERIC
      ),
      s.max_contract_quantity
    ) AS max_contract_quantity,
    COALESCE(
      SAFE_CAST(
        REGEXP_REPLACE(
          COALESCE(
            JSON_VALUE(s.source_payload_json, '$."CANTIDAD TOTAL DEL CONTRATO"')
          ),
          r'[^0-9\-]',
          ''
        ) AS NUMERIC
      ),
      s.contract_total_quantity
    ) AS contract_total_quantity,
    s.source_payload_json,
    s.normalized_at
  FROM `chiesi-committee.chiesi_committee_stg.stg_commercial_operations_government_contract_progress` s
  JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
    ON u.upload_id = s.upload_id
  LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
    ON rv.reporting_version_id = u.reporting_version_id
  LEFT JOIN active_sell_out_mapping map
    ON map.source_product_name_normalized = s.source_product_normalized
  LEFT JOIN `chiesi-committee.chiesi_committee_core.dim_product` d
    ON d.product_id = map.product_id
  LEFT JOIN product_metadata_dedup pm
    ON pm.product_id = map.product_id
  WHERE LOWER(TRIM(u.module_code)) IN (
      'commercial_operations_government_contract_progress',
      'government_contract_progress',
      'contract_progress',
      'pcfp'
    )
    AND LOWER(TRIM(u.status)) IN ('normalized', 'published')
),
max_ref AS (
  SELECT
    reporting_version_id,
    MAX(period_month) AS max_period_month,
    MAX(source_as_of_month) AS max_source_as_of_month,
    MAX(report_period_month) AS max_report_period_month,
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
  b.upload_id,
  b.row_number,
  b.reporting_version_id,
  b.report_period_month,
  b.source_as_of_month,
  b.source_uploaded_at,
  b.contract_key,
  b.contract_type,
  b.vigencia,
  b.category,
  b.responsible,
  b.cb_code,
  b.source_product_raw,
  b.source_product_normalized,
  b.source_product_id,
  b.mapped_product_id,
  b.resolved_product_id,
  b.market_group,
  b.canonical_product_code,
  b.canonical_product_name,
  b.brand_name,
  b.subbrand_or_device,
  b.product_group,
  b.business_unit_code,
  b.business_unit_name,
  b.portfolio_name,
  b.lifecycle_status,
  b.display_order,
  b.notes,
  b.tender_number,
  b.contract_number,
  b.event_type,
  b.centralized_opd,
  b.central_institution,
  b.institution,
  b.assigned_to,
  b.business_model,
  b.assignment_status,
  b.business_unit,
  b.period_month,
  b.delivered_quantity,
  b.max_quantity_2025,
  b.max_quantity_2026,
  b.total_2025,
  b.total_2026,
  b.total_2025_2026,
  b.progress_pct_total,
  b.progress_pct_2025,
  b.progress_pct_2026,
  b.max_contract_quantity,
  b.contract_total_quantity,
  e.max_effective_period_month AS latest_period_month,
  DATE_SUB(e.max_effective_period_month, INTERVAL 1 YEAR) AS latest_period_month_py,
  CASE
    WHEN EXTRACT(YEAR FROM b.period_month) = EXTRACT(YEAR FROM e.max_effective_period_month)
      AND EXTRACT(MONTH FROM b.period_month) <= EXTRACT(MONTH FROM e.max_effective_period_month)
    THEN TRUE ELSE FALSE
  END AS is_ytd,
  CASE
    WHEN EXTRACT(YEAR FROM b.period_month) = EXTRACT(YEAR FROM DATE_SUB(e.max_effective_period_month, INTERVAL 1 YEAR))
      AND EXTRACT(MONTH FROM b.period_month) <= EXTRACT(MONTH FROM e.max_effective_period_month)
    THEN TRUE ELSE FALSE
  END AS is_ytd_py,
  CASE
    WHEN b.period_month = e.max_effective_period_month
    THEN TRUE ELSE FALSE
  END AS is_mth,
  CASE
    WHEN b.period_month = DATE_SUB(e.max_effective_period_month, INTERVAL 1 YEAR)
    THEN TRUE ELSE FALSE
  END AS is_mth_py,
  CASE
    WHEN b.period_month BETWEEN DATE_SUB(e.max_effective_period_month, INTERVAL 11 MONTH) AND e.max_effective_period_month
    THEN TRUE ELSE FALSE
  END AS is_mat,
  CASE
    WHEN b.period_month BETWEEN DATE_SUB(e.max_effective_period_month, INTERVAL 23 MONTH) AND DATE_SUB(e.max_effective_period_month, INTERVAL 12 MONTH)
    THEN TRUE ELSE FALSE
  END AS is_mat_py,
  b.source_payload_json,
  b.normalized_at
FROM base b
JOIN max_ref m
  ON m.reporting_version_id = b.reporting_version_id
JOIN effective_ref e
  ON e.reporting_version_id = b.reporting_version_id;
