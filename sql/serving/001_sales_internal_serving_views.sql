-- Sales Internal serving layer
-- Run in BigQuery (Standard SQL)
-- Project: chiesi-committee
-- Region: EU

CREATE SCHEMA IF NOT EXISTS `chiesi-committee.chiesi_committee_serving`
OPTIONS (
  location = 'EU',
  description = 'Serving dataset for Next.js and BI application-ready views'
);

-- 1) Compatibility views (drop-in replacement for current app queries)
CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_serving.vw_sales_internal_summary` AS
SELECT *
FROM `chiesi-committee.chiesi_committee_mart.vw_sales_internal_summary`;

CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_serving.vw_sales_internal_product_month_active` AS
SELECT *
FROM `chiesi-committee.chiesi_committee_mart.vw_sales_internal_product_month_active`;

CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_serving.vw_sales_internal_product_month_vs_budget` AS
SELECT *
FROM `chiesi-committee.chiesi_committee_mart.vw_sales_internal_product_month_vs_budget`;

-- 2) Enriched monthly grain for app analytics (actual + LY + budget + metadata)
CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_serving.vw_sales_internal_month_enriched` AS
SELECT
  p.period_month,
  p.bu,
  p.channel,
  p.distribution_channel,
  p.distribution_channel_name,
  p.sales_group,
  p.product_id,
  p.canonical_product_code,
  p.canonical_product_name,
  COALESCE(pm.business_unit_name, p.bu) AS business_unit_name,
  pm.portfolio_name,
  pm.brand_name,
  pm.subbrand_or_device,
  p.actual_value,
  ly.actual_value AS ly_value,
  b.budget_value,
  COALESCE(p.actual_value, 0) - COALESCE(b.budget_value, 0) AS variance_vs_budget,
  SAFE_DIVIDE(p.actual_value, NULLIF(b.budget_value, 0)) AS coverage_pct,
  p.row_count,
  p.customer_count
FROM `chiesi-committee.chiesi_committee_mart.vw_sales_internal_product_month_active` p
LEFT JOIN `chiesi-committee.chiesi_committee_admin.product_metadata` pm
  ON pm.product_id = p.product_id
LEFT JOIN `chiesi-committee.chiesi_committee_mart.vw_sales_internal_product_month_active` ly
  ON ly.product_id = p.product_id
  AND ly.sales_group = p.sales_group
  AND ly.bu = p.bu
  AND ly.channel = p.channel
  AND ly.distribution_channel = p.distribution_channel
  AND ly.period_month = DATE_SUB(p.period_month, INTERVAL 1 YEAR)
LEFT JOIN `chiesi-committee.chiesi_committee_mart.vw_sales_internal_product_month_vs_budget` b
  ON b.product_id = p.product_id
  AND b.sales_group = p.sales_group
  AND b.bu = p.bu
  AND b.channel = p.channel
  AND b.period_month = p.period_month;

-- 3) Monthly YTD trend (actual, LY, budget, budget run rate)
CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_serving.vw_sales_internal_month_trend_ytd` AS
WITH latest AS (
  SELECT
    sales_group,
    MAX(period_month) AS max_period
  FROM `chiesi-committee.chiesi_committee_mart.vw_sales_internal_product_month_active`
  GROUP BY sales_group
),
base AS (
  SELECT
    e.sales_group,
    EXTRACT(YEAR FROM e.period_month) AS analysis_year,
    EXTRACT(MONTH FROM e.period_month) AS cutoff_month,
    EXTRACT(MONTH FROM e.period_month) AS month_value,
    SUM(e.actual_value) AS actual_value,
    SUM(COALESCE(e.ly_value, 0)) AS ly_value,
    SUM(COALESCE(e.budget_value, 0)) AS budget_value
  FROM `chiesi-committee.chiesi_committee_serving.vw_sales_internal_month_enriched` e
  JOIN latest l
    ON l.sales_group = e.sales_group
    AND EXTRACT(YEAR FROM e.period_month) = EXTRACT(YEAR FROM l.max_period)
    AND EXTRACT(MONTH FROM e.period_month) <= EXTRACT(MONTH FROM l.max_period)
  GROUP BY 1, 2, 3, 4
),
totals AS (
  SELECT
    sales_group,
    analysis_year,
    cutoff_month,
    SUM(budget_value) AS budget_total
  FROM base
  GROUP BY 1, 2, 3
)
SELECT
  b.sales_group,
  b.analysis_year,
  b.cutoff_month,
  b.month_value,
  b.actual_value,
  b.ly_value,
  b.budget_value,
  SAFE_DIVIDE(t.budget_total, NULLIF(b.cutoff_month, 0)) AS budget_run_rate
FROM base b
JOIN totals t
  ON t.sales_group = b.sales_group
  AND t.analysis_year = b.analysis_year
  AND t.cutoff_month = b.cutoff_month;

-- 4) Drivers YTD by analysis level (channel, distribution, BU, portfolio, brand, SKU)
CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_serving.vw_sales_internal_driver_ytd` AS
WITH latest AS (
  SELECT
    sales_group,
    MAX(period_month) AS max_period
  FROM `chiesi-committee.chiesi_committee_serving.vw_sales_internal_month_enriched`
  GROUP BY sales_group
),
ytd AS (
  SELECT
    e.*,
    EXTRACT(YEAR FROM l.max_period) AS analysis_year,
    EXTRACT(MONTH FROM l.max_period) AS cutoff_month
  FROM `chiesi-committee.chiesi_committee_serving.vw_sales_internal_month_enriched` e
  JOIN latest l
    ON l.sales_group = e.sales_group
    AND EXTRACT(YEAR FROM e.period_month) = EXTRACT(YEAR FROM l.max_period)
    AND EXTRACT(MONTH FROM e.period_month) <= EXTRACT(MONTH FROM l.max_period)
),
aggregated AS (
  SELECT sales_group, analysis_year, cutoff_month, 'channel' AS level_type, channel AS level_key, channel AS level_label,
    SUM(actual_value) AS actual_value, SUM(COALESCE(ly_value, 0)) AS ly_value, SUM(COALESCE(budget_value, 0)) AS budget_value
  FROM ytd GROUP BY 1,2,3,4,5,6
  UNION ALL
  SELECT sales_group, analysis_year, cutoff_month, 'distribution' AS level_type, distribution_channel AS level_key, distribution_channel_name AS level_label,
    SUM(actual_value), SUM(COALESCE(ly_value, 0)), SUM(COALESCE(budget_value, 0))
  FROM ytd GROUP BY 1,2,3,4,5,6
  UNION ALL
  SELECT sales_group, analysis_year, cutoff_month, 'business_unit' AS level_type, COALESCE(business_unit_name, bu) AS level_key, COALESCE(business_unit_name, bu) AS level_label,
    SUM(actual_value), SUM(COALESCE(ly_value, 0)), SUM(COALESCE(budget_value, 0))
  FROM ytd GROUP BY 1,2,3,4,5,6
  UNION ALL
  SELECT sales_group, analysis_year, cutoff_month, 'portfolio' AS level_type, COALESCE(portfolio_name, 'Unclassified') AS level_key, COALESCE(portfolio_name, 'Unclassified') AS level_label,
    SUM(actual_value), SUM(COALESCE(ly_value, 0)), SUM(COALESCE(budget_value, 0))
  FROM ytd GROUP BY 1,2,3,4,5,6
  UNION ALL
  SELECT sales_group, analysis_year, cutoff_month, 'brand' AS level_type, COALESCE(brand_name, 'Unclassified') AS level_key, COALESCE(brand_name, 'Unclassified') AS level_label,
    SUM(actual_value), SUM(COALESCE(ly_value, 0)), SUM(COALESCE(budget_value, 0))
  FROM ytd GROUP BY 1,2,3,4,5,6
  UNION ALL
  SELECT sales_group, analysis_year, cutoff_month, 'sku' AS level_type, product_id AS level_key, canonical_product_name AS level_label,
    SUM(actual_value), SUM(COALESCE(ly_value, 0)), SUM(COALESCE(budget_value, 0))
  FROM ytd GROUP BY 1,2,3,4,5,6
),
totals AS (
  SELECT sales_group, level_type, SUM(actual_value) AS total_actual
  FROM aggregated
  GROUP BY 1,2
)
SELECT
  a.sales_group,
  a.analysis_year,
  a.cutoff_month,
  a.level_type,
  a.level_key,
  a.level_label,
  a.actual_value,
  a.ly_value,
  a.budget_value,
  a.actual_value - a.ly_value AS variance_vs_ly,
  SAFE_DIVIDE(a.actual_value - a.ly_value, NULLIF(a.ly_value, 0)) AS variance_vs_ly_pct,
  a.actual_value - a.budget_value AS variance_vs_budget,
  SAFE_DIVIDE(a.actual_value - a.budget_value, NULLIF(a.budget_value, 0)) AS variance_vs_budget_pct,
  SAFE_DIVIDE(a.actual_value, NULLIF(a.budget_value, 0)) AS coverage_pct,
  SAFE_DIVIDE(a.actual_value, NULLIF(t.total_actual, 0)) AS mix_share_pct
FROM aggregated a
JOIN totals t
  ON t.sales_group = a.sales_group
  AND t.level_type = a.level_type;

-- 5) Filter options from enriched serving view
CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_serving.vw_sales_internal_filter_options` AS
SELECT DISTINCT
  period_month,
  bu,
  channel,
  distribution_channel,
  distribution_channel_name,
  sales_group,
  business_unit_name,
  portfolio_name,
  brand_name
FROM `chiesi-committee.chiesi_committee_serving.vw_sales_internal_month_enriched`;
