CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_mart.vw_private_sellout` AS
WITH max_ref AS (
  SELECT
    reporting_version_id,
    MAX(source_date) AS max_source_date
  FROM `chiesi-committee.chiesi_committee_stg.vw_business_excellence_pmm_enriched`
  GROUP BY reporting_version_id
),

/* =========================================================
   PMM actuals: Units / Net Sales
========================================================= */
base AS (
  SELECT
    t.*,
    m.max_source_date,

    CASE
      WHEN EXTRACT(YEAR FROM t.source_date) = EXTRACT(YEAR FROM m.max_source_date)
       AND EXTRACT(MONTH FROM t.source_date) <= EXTRACT(MONTH FROM m.max_source_date)
      THEN TRUE ELSE FALSE
    END AS is_ytd,

    CASE
      WHEN EXTRACT(YEAR FROM t.source_date) = EXTRACT(YEAR FROM DATE_SUB(m.max_source_date, INTERVAL 1 YEAR))
       AND EXTRACT(MONTH FROM t.source_date) <= EXTRACT(MONTH FROM m.max_source_date)
      THEN TRUE ELSE FALSE
    END AS is_ytd_py,

    CASE
      WHEN t.source_date = m.max_source_date
      THEN TRUE ELSE FALSE
    END AS is_mth,

    CASE
      WHEN t.source_date = DATE_SUB(m.max_source_date, INTERVAL 1 YEAR)
      THEN TRUE ELSE FALSE
    END AS is_mth_py

  FROM `chiesi-committee.chiesi_committee_stg.vw_business_excellence_pmm_enriched` t
  JOIN max_ref m
    ON t.reporting_version_id = m.reporting_version_id
),

agg AS (
  SELECT
    reporting_version_id,
    market_group,
    brand_name,

    -- YTD Units
    SUM(IF(is_ytd AND sales_group = 'Units', amount_value, 0)) AS ytd_units,
    SUM(IF(is_ytd_py AND sales_group = 'Units', amount_value, 0)) AS ytd_units_py,
    SUM(IF(is_ytd AND sales_group = 'Units' AND LOWER(CAST(visited AS STRING)) = 'true', amount_value, 0)) AS ytd_units_visited,

    -- YTD Net Sales
    SUM(IF(is_ytd AND sales_group = 'Net Sales', amount_value, 0)) AS ytd_net_sales,
    SUM(IF(is_ytd_py AND sales_group = 'Net Sales', amount_value, 0)) AS ytd_net_sales_py,

    -- MTH Units
    SUM(IF(is_mth AND sales_group = 'Units', amount_value, 0)) AS mth_units,
    SUM(IF(is_mth_py AND sales_group = 'Units', amount_value, 0)) AS mth_units_py,
    SUM(IF(is_mth AND sales_group = 'Units' AND LOWER(CAST(visited AS STRING)) = 'true', amount_value, 0)) AS mth_units_visited,

    -- MTH Net Sales
    SUM(IF(is_mth AND sales_group = 'Net Sales', amount_value, 0)) AS mth_net_sales,
    SUM(IF(is_mth_py AND sales_group = 'Net Sales', amount_value, 0)) AS mth_net_sales_py

  FROM base
  WHERE brand_name IS NOT NULL
  GROUP BY 1,2,3
),

market AS (
  SELECT
    reporting_version_id,
    market_group,

    SUM(IF(is_ytd AND sales_group = 'Units', amount_value, 0)) AS market_ytd_units,
    SUM(IF(is_ytd_py AND sales_group = 'Units', amount_value, 0)) AS market_ytd_units_py,
    SUM(IF(is_ytd AND sales_group = 'Units' AND LOWER(CAST(visited AS STRING)) = 'true', amount_value, 0)) AS market_ytd_units_visited,

    SUM(IF(is_ytd AND sales_group = 'Net Sales', amount_value, 0)) AS market_ytd_net_sales,
    SUM(IF(is_ytd_py AND sales_group = 'Net Sales', amount_value, 0)) AS market_ytd_net_sales_py,

    SUM(IF(is_mth AND sales_group = 'Units', amount_value, 0)) AS market_mth_units,
    SUM(IF(is_mth_py AND sales_group = 'Units', amount_value, 0)) AS market_mth_units_py,
    SUM(IF(is_mth AND sales_group = 'Units' AND LOWER(CAST(visited AS STRING)) = 'true', amount_value, 0)) AS market_mth_units_visited,

    SUM(IF(is_mth AND sales_group = 'Net Sales', amount_value, 0)) AS market_mth_net_sales,
    SUM(IF(is_mth_py AND sales_group = 'Net Sales', amount_value, 0)) AS market_mth_net_sales_py

  FROM base
  WHERE market_group IS NOT NULL
  GROUP BY 1,2
),

/* =========================================================
   Budget privado
========================================================= */
budget_base AS (
  SELECT
    b.*,
    m.max_source_date,

    CASE
      WHEN EXTRACT(YEAR FROM b.period_month) = EXTRACT(YEAR FROM m.max_source_date)
       AND EXTRACT(MONTH FROM b.period_month) <= EXTRACT(MONTH FROM m.max_source_date)
      THEN TRUE ELSE FALSE
    END AS is_budget_ytd,

    CASE
      WHEN b.period_month = DATE_TRUNC(m.max_source_date, MONTH)
      THEN TRUE ELSE FALSE
    END AS is_budget_mth

  FROM `chiesi-committee.chiesi_committee_stg.vw_business_excellence_budget_sell_out_enriched` b
  JOIN max_ref m
    ON b.reporting_version_id = m.reporting_version_id
  WHERE LOWER(b.channel) = 'privado'
),

budget_agg AS (
  SELECT
    reporting_version_id,
    market_group,
    brand_name,

    SUM(IF(is_budget_ytd AND sales_group = 'Units', amount_value, 0)) AS budget_ytd_units,
    SUM(IF(is_budget_ytd AND sales_group = 'Net Sales', amount_value, 0)) AS budget_ytd_net_sales,

    SUM(IF(is_budget_mth AND sales_group = 'Units', amount_value, 0)) AS budget_mth_units,
    SUM(IF(is_budget_mth AND sales_group = 'Net Sales', amount_value, 0)) AS budget_mth_net_sales

  FROM budget_base
  WHERE brand_name IS NOT NULL
  GROUP BY 1,2,3
),

/* =========================================================
   CloseUp actuals: Rx
========================================================= */
rx_base AS (
  SELECT
    c.reporting_version_id,
    c.market_group,
    c.brand_name,
    c.source_date,
    c.visited,
    c.specialty,
    REGEXP_REPLACE(
      LOWER(TRIM(NORMALIZE(c.specialty, NFD))),
      r'[^a-z0-9]',
      ''
    ) AS specialty_normalized,
    CAST(c.recetas_value AS NUMERIC) AS rx_value,
    m.max_source_date,

    CASE
      WHEN EXTRACT(YEAR FROM c.source_date) = EXTRACT(YEAR FROM m.max_source_date)
       AND EXTRACT(MONTH FROM c.source_date) <= EXTRACT(MONTH FROM m.max_source_date)
      THEN TRUE ELSE FALSE
    END AS is_ytd,

    CASE
      WHEN EXTRACT(YEAR FROM c.source_date) = EXTRACT(YEAR FROM DATE_SUB(m.max_source_date, INTERVAL 1 YEAR))
       AND EXTRACT(MONTH FROM c.source_date) <= EXTRACT(MONTH FROM m.max_source_date)
      THEN TRUE ELSE FALSE
    END AS is_ytd_py,

    CASE
      WHEN c.source_date = m.max_source_date
      THEN TRUE ELSE FALSE
    END AS is_mth,

    CASE
      WHEN c.source_date = DATE_SUB(m.max_source_date, INTERVAL 1 YEAR)
      THEN TRUE ELSE FALSE
    END AS is_mth_py

  FROM `chiesi-committee.chiesi_committee_stg.vw_business_excellence_closeup_enriched` c
  JOIN max_ref m
    ON c.reporting_version_id = m.reporting_version_id
  WHERE c.brand_name IS NOT NULL
),

rx_agg AS (
  SELECT
    reporting_version_id,
    market_group,
    brand_name,

    -- Base Rx
    SUM(IF(is_ytd, rx_value, 0)) AS ytd_rx,
    SUM(IF(is_ytd_py, rx_value, 0)) AS ytd_rx_py,
    SUM(IF(is_ytd AND LOWER(CAST(visited AS STRING)) = 'true', rx_value, 0)) AS ytd_rx_visited,

    SUM(IF(is_mth, rx_value, 0)) AS mth_rx,
    SUM(IF(is_mth_py, rx_value, 0)) AS mth_rx_py,
    SUM(IF(is_mth AND LOWER(CAST(visited AS STRING)) = 'true', rx_value, 0)) AS mth_rx_visited,

    -- Rx by MG
    SUM(
      IF(
        is_ytd
        AND specialty_normalized IN ('medicgral', 'medicinageneral', 'medicogeneral', 'medgral'),
        rx_value,
        0
      )
    ) AS ytd_rx_by_mg,

    SUM(
      IF(
        is_mth
        AND specialty_normalized IN ('medicgral', 'medicinageneral', 'medicogeneral', 'medgral'),
        rx_value,
        0
      )
    ) AS mth_rx_by_mg,

    -- Rx by Neumo
    SUM(
      IF(
        is_ytd
        AND specialty_normalized IN ('neumologia'),
        rx_value,
        0
      )
    ) AS ytd_rx_by_neumo,

    SUM(
      IF(
        is_mth
        AND specialty_normalized IN ('neumologia'),
        rx_value,
        0
      )
    ) AS mth_rx_by_neumo

  FROM rx_base
  GROUP BY 1,2,3
),

rx_market AS (
  SELECT
    reporting_version_id,
    market_group,

    SUM(IF(is_ytd, rx_value, 0)) AS market_ytd_rx,
    SUM(IF(is_ytd_py, rx_value, 0)) AS market_ytd_rx_py,
    SUM(IF(is_ytd AND LOWER(CAST(visited AS STRING)) = 'true', rx_value, 0)) AS market_ytd_rx_visited,

    SUM(IF(is_mth, rx_value, 0)) AS market_mth_rx,
    SUM(IF(is_mth_py, rx_value, 0)) AS market_mth_rx_py,
    SUM(IF(is_mth AND LOWER(CAST(visited AS STRING)) = 'true', rx_value, 0)) AS market_mth_rx_visited

  FROM rx_base
  GROUP BY 1,2
)

SELECT
  a.reporting_version_id,
  a.market_group,
  a.brand_name,
  mr.max_source_date AS last_available_month,
  DATE_SUB(mr.max_source_date, INTERVAL 1 YEAR) AS last_available_month_py,

  -- =========================
  -- YTD Units
  -- =========================
  a.ytd_units,
  a.ytd_units_py,
  a.ytd_units - a.ytd_units_py AS growth_vs_py_ytd_units,
  SAFE_DIVIDE(a.ytd_units - a.ytd_units_py, NULLIF(a.ytd_units_py, 0)) AS growth_vs_py_ytd_units_pct,
  SAFE_DIVIDE(a.ytd_units, NULLIF(m.market_ytd_units, 0)) AS ms_ytd_units_pct,
  SAFE_DIVIDE(a.ytd_units_py, NULLIF(m.market_ytd_units_py, 0)) AS ms_ytd_units_pct_py,
  CAST(
    ROUND(
      SAFE_DIVIDE(
        SAFE_DIVIDE(a.ytd_units, NULLIF(m.market_ytd_units, 0)),
        NULLIF(SAFE_DIVIDE(a.ytd_units_py, NULLIF(m.market_ytd_units_py, 0)), 0)
      ) * 100,
      0
    ) AS INT64
  ) AS ei_ytd_units,
  a.ytd_units_visited,
  SAFE_DIVIDE(a.ytd_units_visited, NULLIF(a.ytd_units, 0)) AS ytd_units_visited_ratio,
  m.market_ytd_units_visited,
  SAFE_DIVIDE(m.market_ytd_units_visited, NULLIF(m.market_ytd_units, 0)) AS market_ytd_units_visited_ratio,

  -- =========================
  -- YTD Net Sales
  -- =========================
  a.ytd_net_sales,
  a.ytd_net_sales_py,
  a.ytd_net_sales - a.ytd_net_sales_py AS growth_vs_py_ytd_net_sales,
  SAFE_DIVIDE(a.ytd_net_sales - a.ytd_net_sales_py, NULLIF(a.ytd_net_sales_py, 0)) AS growth_vs_py_ytd_net_sales_pct,
  SAFE_DIVIDE(a.ytd_net_sales, NULLIF(m.market_ytd_net_sales, 0)) AS ms_ytd_net_sales_pct,
  SAFE_DIVIDE(a.ytd_net_sales_py, NULLIF(m.market_ytd_net_sales_py, 0)) AS ms_ytd_net_sales_pct_py,
  CAST(
    ROUND(
      SAFE_DIVIDE(
        SAFE_DIVIDE(a.ytd_net_sales, NULLIF(m.market_ytd_net_sales, 0)),
        NULLIF(SAFE_DIVIDE(a.ytd_net_sales_py, NULLIF(m.market_ytd_net_sales_py, 0)), 0)
      ) * 100,
      0
    ) AS INT64
  ) AS ei_ytd_net_sales,

  -- =========================
  -- YTD Rx
  -- =========================
  COALESCE(r.ytd_rx, 0) AS ytd_rx,
  COALESCE(r.ytd_rx_py, 0) AS ytd_rx_py,
  COALESCE(r.ytd_rx, 0) - COALESCE(r.ytd_rx_py, 0) AS growth_vs_py_ytd_rx,
  SAFE_DIVIDE(
    COALESCE(r.ytd_rx, 0) - COALESCE(r.ytd_rx_py, 0),
    NULLIF(r.ytd_rx_py, 0)
  ) AS growth_vs_py_ytd_rx_pct,
  SAFE_DIVIDE(COALESCE(r.ytd_rx, 0), NULLIF(rm.market_ytd_rx, 0)) AS ms_ytd_rx_pct,
  SAFE_DIVIDE(COALESCE(r.ytd_rx_py, 0), NULLIF(rm.market_ytd_rx_py, 0)) AS ms_ytd_rx_pct_py,
  CAST(
    ROUND(
      SAFE_DIVIDE(
        SAFE_DIVIDE(COALESCE(r.ytd_rx, 0), NULLIF(rm.market_ytd_rx, 0)),
        NULLIF(SAFE_DIVIDE(COALESCE(r.ytd_rx_py, 0), NULLIF(rm.market_ytd_rx_py, 0)), 0)
      ) * 100,
      0
    ) AS INT64
  ) AS ei_ytd_rx,
  COALESCE(r.ytd_rx_visited, 0) AS ytd_rx_visited,
  SAFE_DIVIDE(COALESCE(r.ytd_rx_visited, 0), NULLIF(r.ytd_rx, 0)) AS ytd_rx_visited_ratio,
  COALESCE(rm.market_ytd_rx_visited, 0) AS market_ytd_rx_visited,
  SAFE_DIVIDE(COALESCE(rm.market_ytd_rx_visited, 0), NULLIF(rm.market_ytd_rx, 0)) AS market_ytd_rx_visited_ratio,
  COALESCE(r.ytd_rx_by_mg, 0) AS ytd_rx_by_mg,
  SAFE_DIVIDE(COALESCE(r.ytd_rx_by_mg, 0), NULLIF(r.ytd_rx, 0)) AS ytd_rx_mg_ratio,
  COALESCE(r.ytd_rx_by_neumo, 0) AS ytd_rx_by_neumo,
  SAFE_DIVIDE(COALESCE(r.ytd_rx_by_neumo, 0), NULLIF(r.ytd_rx, 0)) AS ytd_rx_neumo_ratio,

  -- =========================
  -- Budget YTD
  -- =========================
  COALESCE(b.budget_ytd_units, 0) AS budget_ytd_units,
  COALESCE(b.budget_ytd_net_sales, 0) AS budget_ytd_net_sales,
  a.ytd_units - COALESCE(b.budget_ytd_units, 0) AS variance_vs_budget_ytd_units,
  SAFE_DIVIDE(a.ytd_units - COALESCE(b.budget_ytd_units, 0), NULLIF(b.budget_ytd_units, 0)) AS variance_vs_budget_ytd_units_pct,
  a.ytd_net_sales - COALESCE(b.budget_ytd_net_sales, 0) AS variance_vs_budget_ytd_net_sales,
  SAFE_DIVIDE(a.ytd_net_sales - COALESCE(b.budget_ytd_net_sales, 0), NULLIF(b.budget_ytd_net_sales, 0)) AS variance_vs_budget_ytd_net_sales_pct,

  -- =========================
  -- MTH Units
  -- =========================
  a.mth_units,
  a.mth_units_py,
  a.mth_units - a.mth_units_py AS growth_vs_py_mth_units,
  SAFE_DIVIDE(a.mth_units - a.mth_units_py, NULLIF(a.mth_units_py, 0)) AS growth_vs_py_mth_units_pct,
  SAFE_DIVIDE(a.mth_units, NULLIF(m.market_mth_units, 0)) AS ms_mth_units_pct,
  SAFE_DIVIDE(a.mth_units_py, NULLIF(m.market_mth_units_py, 0)) AS ms_mth_units_pct_py,
  CAST(
    ROUND(
      SAFE_DIVIDE(
        SAFE_DIVIDE(a.mth_units, NULLIF(m.market_mth_units, 0)),
        NULLIF(SAFE_DIVIDE(a.mth_units_py, NULLIF(m.market_mth_units_py, 0)), 0)
      ) * 100,
      0
    ) AS INT64
  ) AS ei_mth_units,
  a.mth_units_visited,
  SAFE_DIVIDE(a.mth_units_visited, NULLIF(a.mth_units, 0)) AS mth_units_visited_ratio,
  m.market_mth_units_visited,
  SAFE_DIVIDE(m.market_mth_units_visited, NULLIF(m.market_mth_units, 0)) AS market_mth_units_visited_ratio,

  -- =========================
  -- MTH Net Sales
  -- =========================
  a.mth_net_sales,
  a.mth_net_sales_py,
  a.mth_net_sales - a.mth_net_sales_py AS growth_vs_py_mth_net_sales,
  SAFE_DIVIDE(a.mth_net_sales - a.mth_net_sales_py, NULLIF(a.mth_net_sales_py, 0)) AS growth_vs_py_mth_net_sales_pct,
  SAFE_DIVIDE(a.mth_net_sales, NULLIF(m.market_mth_net_sales, 0)) AS ms_mth_net_sales_pct,
  SAFE_DIVIDE(a.mth_net_sales_py, NULLIF(m.market_mth_net_sales_py, 0)) AS ms_mth_net_sales_pct_py,
  CAST(
    ROUND(
      SAFE_DIVIDE(
        SAFE_DIVIDE(a.mth_net_sales, NULLIF(m.market_mth_net_sales, 0)),
        NULLIF(SAFE_DIVIDE(a.mth_net_sales_py, NULLIF(m.market_mth_net_sales_py, 0)), 0)
      ) * 100,
      0
    ) AS INT64
  ) AS ei_mth_net_sales,

  -- =========================
  -- MTH Rx
  -- =========================
  COALESCE(r.mth_rx, 0) AS mth_rx,
  COALESCE(r.mth_rx_py, 0) AS mth_rx_py,
  COALESCE(r.mth_rx, 0) - COALESCE(r.mth_rx_py, 0) AS growth_vs_py_mth_rx,
  SAFE_DIVIDE(
    COALESCE(r.mth_rx, 0) - COALESCE(r.mth_rx_py, 0),
    NULLIF(r.mth_rx_py, 0)
  ) AS growth_vs_py_mth_rx_pct,
  SAFE_DIVIDE(COALESCE(r.mth_rx, 0), NULLIF(rm.market_mth_rx, 0)) AS ms_mth_rx_pct,
  SAFE_DIVIDE(COALESCE(r.mth_rx_py, 0), NULLIF(rm.market_mth_rx_py, 0)) AS ms_mth_rx_pct_py,
  CAST(
    ROUND(
      SAFE_DIVIDE(
        SAFE_DIVIDE(COALESCE(r.mth_rx, 0), NULLIF(rm.market_mth_rx, 0)),
        NULLIF(SAFE_DIVIDE(COALESCE(r.mth_rx_py, 0), NULLIF(rm.market_mth_rx_py, 0)), 0)
      ) * 100,
      0
    ) AS INT64
  ) AS ei_mth_rx,
  COALESCE(r.mth_rx_visited, 0) AS mth_rx_visited,
  SAFE_DIVIDE(COALESCE(r.mth_rx_visited, 0), NULLIF(r.mth_rx, 0)) AS mth_rx_visited_ratio,
  COALESCE(rm.market_mth_rx_visited, 0) AS market_mth_rx_visited,
  SAFE_DIVIDE(COALESCE(rm.market_mth_rx_visited, 0), NULLIF(rm.market_mth_rx, 0)) AS market_mth_rx_visited_ratio,
  COALESCE(r.mth_rx_by_mg, 0) AS mth_rx_by_mg,
  SAFE_DIVIDE(COALESCE(r.mth_rx_by_mg, 0), NULLIF(r.mth_rx, 0)) AS mth_rx_mg_ratio,
  COALESCE(r.mth_rx_by_neumo, 0) AS mth_rx_by_neumo,
  SAFE_DIVIDE(COALESCE(r.mth_rx_by_neumo, 0), NULLIF(r.mth_rx, 0)) AS mth_rx_neumo_ratio,

  -- =========================
  -- Budget MTH
  -- =========================
  COALESCE(b.budget_mth_units, 0) AS budget_mth_units,
  COALESCE(b.budget_mth_net_sales, 0) AS budget_mth_net_sales,
  a.mth_units - COALESCE(b.budget_mth_units, 0) AS variance_vs_budget_mth_units,
  SAFE_DIVIDE(a.mth_units - COALESCE(b.budget_mth_units, 0), NULLIF(b.budget_mth_units, 0)) AS variance_vs_budget_mth_units_pct,
  a.mth_net_sales - COALESCE(b.budget_mth_net_sales, 0) AS variance_vs_budget_mth_net_sales,
  SAFE_DIVIDE(a.mth_net_sales - COALESCE(b.budget_mth_net_sales, 0), NULLIF(b.budget_mth_net_sales, 0)) AS variance_vs_budget_mth_net_sales_pct

FROM agg a
LEFT JOIN market m
  ON a.reporting_version_id = m.reporting_version_id
 AND a.market_group = m.market_group
LEFT JOIN budget_agg b
  ON a.reporting_version_id = b.reporting_version_id
 AND a.market_group = b.market_group
 AND a.brand_name = b.brand_name
LEFT JOIN rx_agg r
  ON a.reporting_version_id = r.reporting_version_id
 AND a.market_group = r.market_group
 AND a.brand_name = r.brand_name
LEFT JOIN rx_market rm
  ON a.reporting_version_id = rm.reporting_version_id
 AND a.market_group = rm.market_group
LEFT JOIN max_ref mr
  ON a.reporting_version_id = mr.reporting_version_id
ORDER BY
  a.reporting_version_id,
  a.market_group,
  a.brand_name;