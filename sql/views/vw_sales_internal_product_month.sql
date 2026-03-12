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

  -- DATA ACTUAL
  SELECT *
  FROM stg_latest

  UNION ALL

  -- HISTORICO SOLO SI NO EXISTE EN STG
  SELECT h.*
  FROM `chiesi-committee.chiesi_committee_stg.historic_data_sales_intern` h
  LEFT JOIN stg_latest s
    ON s.period_month = h.period_month
   AND REGEXP_REPLACE(COALESCE(NULLIF(s.fpna_code,''), NULLIF(s.material,'')), r'^0+', '') =
       REGEXP_REPLACE(COALESCE(NULLIF(h.fpna_code,''), NULLIF(h.material,'')), r'^0+', '')
   AND COALESCE(s.sales_group,'') = COALESCE(h.sales_group,'')
  WHERE s.period_month IS NULL

),

enriched AS (
  SELECT
    s.period_month,
    s.bu,
    s.channel,
    s.distribution_channel,
    s.sales_group,
    s.distribution_channel_name,

    COALESCE(
      d.product_id,
      NULL
    ) AS product_id,

    COALESCE(
      d.canonical_product_code,
      COALESCE(NULLIF(s.fpna_code,''), NULLIF(s.material,''))
    ) AS canonical_product_code,

    COALESCE(
      d.canonical_product_name,
      COALESCE(NULLIF(s.fpna_description,''), NULLIF(s.material_name,''))
    ) AS canonical_product_name,

    s.amount_value,
    s.customer,
    s.normalized_at
  FROM base_data s
  LEFT JOIN dim_product_dedup d
    ON d.canonical_code_norm =
       REGEXP_REPLACE(COALESCE(NULLIF(s.fpna_code,''), NULLIF(s.material,'')), r'^0+', '')
)

SELECT
  period_month,
  bu,
  channel,
  distribution_channel,
  sales_group,
  distribution_channel_name,
  product_id,
  canonical_product_code,
  canonical_product_name,
  SUM(amount_value) AS actual_value,
  COUNT(*) AS row_count,
  COUNT(DISTINCT customer) AS customer_count,
  MAX(normalized_at) AS last_normalized_at
FROM enriched
GROUP BY
  period_month,
  bu,
  channel,
  distribution_channel,
  sales_group,
  distribution_channel_name,
  product_id,
  canonical_product_code,
  canonical_product_name
