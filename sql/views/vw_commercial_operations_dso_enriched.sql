CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_commercial_operations_dso_enriched` AS
WITH base AS (
  SELECT
    d.upload_id,
    d.row_number,
    u.reporting_version_id,
    rv.period_month AS report_period_month,
    u.source_as_of_month,
    u.uploaded_at AS source_uploaded_at,
    d.group_name,
    LOWER(TRIM(REGEXP_REPLACE(COALESCE(d.group_name, ''), r'\s+', ' '))) AS group_name_normalized,
    CASE
      WHEN LOWER(TRIM(REGEXP_REPLACE(COALESCE(d.group_name, ''), r'\s+', ' '))) LIKE '%b2b%'
      THEN 'B2B'
      WHEN LOWER(TRIM(REGEXP_REPLACE(COALESCE(d.group_name, ''), r'\s+', ' '))) LIKE '%b2c%'
      THEN 'B2C'
      ELSE 'General'
    END AS customer_segment,
    CASE
      WHEN LOWER(TRIM(REGEXP_REPLACE(COALESCE(d.group_name, ''), r'\s+', ' '))) LIKE '%gobierno%'
      THEN 'Gobierno'
      WHEN LOWER(TRIM(REGEXP_REPLACE(COALESCE(d.group_name, ''), r'\s+', ' '))) LIKE '%privado%'
      THEN 'Privado'
      ELSE 'General'
    END AS channel_scope,
    d.period_month,
    d.dso_value,
    d.source_payload_json,
    d.normalized_at
  FROM `chiesi-committee.chiesi_committee_stg.stg_commercial_operations_dso` d
  JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
    ON u.upload_id = d.upload_id
  LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
    ON rv.reporting_version_id = u.reporting_version_id
  WHERE LOWER(TRIM(u.module_code)) IN (
    'commercial_operations_dso',
    'commercial_operations_days_sales_outstanding',
    'dso'
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
  b.group_name,
  b.group_name_normalized,
  b.customer_segment,
  b.channel_scope,
  b.period_month,
  b.dso_value,
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
  b.source_payload_json,
  b.normalized_at
FROM base b
JOIN max_ref m
  ON m.reporting_version_id = b.reporting_version_id
JOIN effective_ref e
  ON e.reporting_version_id = b.reporting_version_id;
