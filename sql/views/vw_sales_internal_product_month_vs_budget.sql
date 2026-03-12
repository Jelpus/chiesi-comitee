WITH latest_stg_upload_per_period AS (
  SELECT
    period_month,
    ARRAY_AGG(upload_id ORDER BY normalized_at DESC LIMIT 1)[OFFSET(0)] AS latest_upload_id
  FROM `chiesi-committee.chiesi_committee_stg.stg_sales_internal`
  GROUP BY period_month
),

stg_latest AS (
  SELECT s.*
  FROM `chiesi-committee.chiesi_committee_stg.stg_sales_internal` s
  JOIN latest_stg_upload_per_period l
    ON l.period_month = s.period_month
   AND l.latest_upload_id = s.upload_id
),

dim_product_dedup AS (
  SELECT
    product_id,
    canonical_product_code,
    canonical_product_name,
    REGEXP_REPLACE(canonical_product_code, r'^0+', '') AS canonical_code_norm
  FROM (
    SELECT
      d.*,
      ROW_NUMBER() OVER (
        PARTITION BY REGEXP_REPLACE(d.canonical_product_code, r'^0+', '')
        ORDER BY d.product_id
      ) AS rn
    FROM `chiesi-committee.chiesi_committee_core.dim_product` d
    WHERE d.canonical_product_code IS NOT NULL
  )
  WHERE rn = 1
),

base_data AS (

  SELECT *
  FROM stg_latest

  UNION ALL

  SELECT h.*
  FROM `chiesi-committee.chiesi_committee_stg.historic_data_sales_intern` h
  LEFT JOIN stg_latest s
    ON s.period_month = h.period_month
   AND REGEXP_REPLACE(COALESCE(NULLIF(s.fpna_code,''), NULLIF(s.material,'')), r'^0+', '') =
       REGEXP_REPLACE(COALESCE(NULLIF(h.fpna_code,''), NULLIF(h.material,'')), r'^0+', '')
   AND COALESCE(s.sales_group,'') = COALESCE(h.sales_group,'')
   AND COALESCE(s.channel,'') = COALESCE(h.channel,'')
  WHERE s.period_month IS NULL

),

actual_enriched AS (
  SELECT
    s.period_month,
    s.bu,
    s.channel,
    s.sales_group,

    d.product_id,

    COALESCE(
      d.canonical_product_code,
      COALESCE(NULLIF(s.fpna_code,''), NULLIF(s.material,''))
    ) AS canonical_product_code,

    COALESCE(
      d.canonical_product_name,
      COALESCE(NULLIF(s.fpna_description,''), NULLIF(s.material_name,''))
    ) AS canonical_product_name,

    s.amount_value,
    s.normalized_at
  FROM base_data s
  LEFT JOIN dim_product_dedup d
    ON d.canonical_code_norm =
       REGEXP_REPLACE(COALESCE(NULLIF(s.fpna_code,''), NULLIF(s.material,'')), r'^0+', '')
),

actual_agg AS (
  SELECT
    period_month,
    bu,
    channel,
    sales_group,
    product_id,
    canonical_product_code,
    canonical_product_name,
    SUM(amount_value) AS actual_value,
    MAX(normalized_at) AS last_normalized_at
  FROM actual_enriched
  GROUP BY
    period_month,
    bu,
    channel,
    sales_group,
    product_id,
    canonical_product_code,
    canonical_product_name
),

budget_enriched AS (
  SELECT
    b.period_month,
    b.bu,
    b.channel,
    b.sales_group,

    d.product_id,

    COALESCE(
      d.canonical_product_code,
      COALESCE(NULLIF(b.fpna_code,''), NULLIF(b.material,''))
    ) AS canonical_product_code,

    COALESCE(
      d.canonical_product_name,
      COALESCE(NULLIF(b.fpna_description,''), NULLIF(b.material_name,''))
    ) AS canonical_product_name,

    b.amount_value AS budget_value
  FROM `chiesi-committee.chiesi_committee_stg.historic_budget_sales_internal` b
  LEFT JOIN dim_product_dedup d
    ON d.canonical_code_norm =
       REGEXP_REPLACE(COALESCE(NULLIF(b.fpna_code,''), NULLIF(b.material,'')), r'^0+', '')
),

budget_agg AS (
  SELECT
    period_month,
    bu,
    channel,
    sales_group,
    product_id,
    canonical_product_code,
    canonical_product_name,
    SUM(budget_value) AS budget_value
  FROM budget_enriched
  GROUP BY
    period_month,
    bu,
    channel,
    sales_group,
    product_id,
    canonical_product_code,
    canonical_product_name
)

SELECT
  a.period_month,
  a.bu,
  a.channel,
  a.sales_group,
  a.product_id,
  a.canonical_product_code,
  a.canonical_product_name,
  a.actual_value,
  COALESCE(b.budget_value, 0) AS budget_value,
  a.actual_value - COALESCE(b.budget_value, 0) AS variance_vs_budget,
  SAFE_DIVIDE(a.actual_value - COALESCE(b.budget_value, 0), NULLIF(b.budget_value, 0)) AS variance_vs_budget_pct,
  a.last_normalized_at
FROM actual_agg a
LEFT JOIN budget_agg b
  ON a.period_month = b.period_month
 AND COALESCE(a.bu,'') = COALESCE(b.bu,'')
 AND COALESCE(a.channel,'') = COALESCE(b.channel,'')
 AND COALESCE(a.sales_group,'') = COALESCE(b.sales_group,'')
 AND COALESCE(a.product_id,'') = COALESCE(b.product_id,'')
