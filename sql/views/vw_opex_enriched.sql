CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_opex_enriched` AS
WITH catalog_dedup AS (
  SELECT
    upload_id,
    key1,
    key2,
    account,
    pl_group,
    area,
    ceco,
    ceco_name,
    cost_element,
    element,
    business_unit,
    owner,
    responsible
  FROM (
    SELECT
      c.*,
      ROW_NUMBER() OVER (
        PARTITION BY c.upload_id, c.key1, c.key2
        ORDER BY c.row_number
      ) AS rn
    FROM `chiesi-committee.chiesi_committee_stg.stg_opex_master_catalog` c
  )
  WHERE rn = 1
),
base AS (
  SELECT
    m.upload_id,
    m.row_number,
    u.reporting_version_id,
    rv.period_month AS report_period_month,
    u.source_as_of_month,
    u.uploaded_at AS source_uploaded_at,
    m.key1,
    m.key2,
    m.period_month,
    m.metric_name,
    m.amount_value,
    c.account,
    c.pl_group,
    c.area,
    c.ceco,
    c.ceco_name,
    c.cost_element,
    c.element,
    c.business_unit,
    c.owner,
    c.responsible,
    m.source_payload_json,
    m.normalized_at
  FROM `chiesi-committee.chiesi_committee_stg.stg_opex_movements` m
  JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
    ON u.upload_id = m.upload_id
  LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
    ON rv.reporting_version_id = u.reporting_version_id
  LEFT JOIN catalog_dedup c
    ON c.upload_id = m.upload_id
   AND c.key1 = m.key1
   AND IFNULL(c.key2, '') = IFNULL(m.key2, '')
  WHERE LOWER(TRIM(u.module_code)) IN ('opex_by_cc', 'opex_master_catalog')
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
  b.key1,
  b.key2,
  b.account,
  b.pl_group,
  b.area,
  b.ceco,
  b.ceco_name,
  b.cost_element,
  b.element,
  b.business_unit,
  b.owner,
  b.responsible,
  b.period_month,
  b.metric_name,
  b.amount_value,
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
