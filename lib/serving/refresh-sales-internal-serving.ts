import 'server-only';
import type { BigQuery } from '@google-cloud/bigquery';

const SERVING_PROJECT = process.env.SALES_INTERNAL_VIEW_PROJECT ?? 'chiesi-committee';
const SERVING_DATASET = process.env.SALES_INTERNAL_DATASET ?? 'chiesi_committee_serving';
const SERVING_SCHEMA = `\`${SERVING_PROJECT}.${SERVING_DATASET}\``;

export async function refreshSalesInternalServingArtifacts(client: BigQuery) {
  await client.query({
    query: `
      CREATE SCHEMA IF NOT EXISTS ${SERVING_SCHEMA}
      OPTIONS(location = 'EU')
    `,
  });

  await client.query({
    query: `
      CREATE OR REPLACE TABLE ${SERVING_SCHEMA}.sales_internal_month_enriched AS
      WITH product_month AS (
        SELECT
          period_month,
          bu,
          channel,
          distribution_channel,
          distribution_channel_name,
          sales_group,
          product_id,
          canonical_product_code,
          canonical_product_name,
          actual_value,
          row_count,
          customer_count,
          last_normalized_at
        FROM \`chiesi-committee.chiesi_committee_mart.vw_sales_internal_product_month\`
      ),
      budget_month AS (
        SELECT
          period_month,
          bu,
          channel,
          sales_group,
          product_id,
          canonical_product_code,
          canonical_product_name,
          actual_value,
          budget_value,
          variance_vs_budget,
          variance_vs_budget_pct
        FROM \`chiesi-committee.chiesi_committee_mart.vw_sales_internal_product_month_vs_budget\`
      ),
      product_metadata_dedup AS (
        SELECT
          product_id,
          business_unit_name,
          portfolio_name,
          brand_name,
          subbrand_or_device
        FROM (
          SELECT
            pm.*,
            ROW_NUMBER() OVER (
              PARTITION BY pm.product_id
              ORDER BY pm.updated_at DESC, pm.created_at DESC
            ) AS rn
          FROM \`chiesi-committee.chiesi_committee_admin.product_metadata\` pm
        )
        WHERE rn = 1
      ),
      budget_agg AS (
        SELECT
          period_month,
          bu,
          channel,
          sales_group,
          product_id,
          canonical_product_code,
          SUM(budget_value) AS budget_value,
          SUM(variance_vs_budget) AS variance_vs_budget,
          SAFE_DIVIDE(SUM(variance_vs_budget), NULLIF(SUM(budget_value), 0)) AS variance_vs_budget_pct
        FROM budget_month
        GROUP BY
          period_month,
          bu,
          channel,
          sales_group,
          product_id,
          canonical_product_code
      )
      SELECT
        a.period_month,
        a.bu,
        a.channel,
        a.distribution_channel,
        a.distribution_channel_name,
        a.sales_group,
        a.product_id,
        a.canonical_product_code,
        a.canonical_product_name,
        COALESCE(pm.business_unit_name, a.bu) AS business_unit_name,
        pm.portfolio_name,
        pm.brand_name,
        pm.subbrand_or_device,
        a.actual_value,
        COALESCE(b.budget_value, 0) AS budget_value,
        COALESCE(b.variance_vs_budget, a.actual_value - COALESCE(b.budget_value, 0)) AS variance_vs_budget,
        COALESCE(
          b.variance_vs_budget_pct,
          SAFE_DIVIDE(a.actual_value - COALESCE(b.budget_value, 0), NULLIF(b.budget_value, 0))
        ) AS variance_vs_budget_pct,
        ly.actual_value AS ly_value,
        a.row_count,
        a.customer_count,
        a.last_normalized_at
      FROM product_month a
      LEFT JOIN budget_agg b
        ON a.period_month = b.period_month
       AND COALESCE(a.bu,'') = COALESCE(b.bu,'')
       AND COALESCE(a.channel,'') = COALESCE(b.channel,'')
       AND COALESCE(a.sales_group,'') = COALESCE(b.sales_group,'')
       AND COALESCE(a.product_id,'') = COALESCE(b.product_id,'')
      LEFT JOIN product_month ly
        ON ly.period_month = DATE_SUB(a.period_month, INTERVAL 1 YEAR)
       AND COALESCE(ly.bu,'') = COALESCE(a.bu,'')
       AND COALESCE(ly.channel,'') = COALESCE(a.channel,'')
       AND COALESCE(ly.distribution_channel,'') = COALESCE(a.distribution_channel,'')
       AND COALESCE(ly.distribution_channel_name,'') = COALESCE(a.distribution_channel_name,'')
       AND COALESCE(ly.sales_group,'') = COALESCE(a.sales_group,'')
       AND COALESCE(ly.product_id,'') = COALESCE(a.product_id,'')
      LEFT JOIN product_metadata_dedup pm
        ON pm.product_id = a.product_id
    `,
  });

  await client.query({
    query: `
      CREATE OR REPLACE VIEW ${SERVING_SCHEMA}.vw_sales_internal_product_month_active AS
      SELECT
        period_month,
        bu,
        channel,
        distribution_channel,
        distribution_channel_name,
        sales_group,
        product_id,
        canonical_product_code,
        canonical_product_name,
        actual_value,
        row_count,
        customer_count
      FROM ${SERVING_SCHEMA}.sales_internal_month_enriched
      WHERE ABS(actual_value) > 0.000001
    `,
  });

  await client.query({
    query: `
      CREATE OR REPLACE VIEW ${SERVING_SCHEMA}.vw_sales_internal_summary AS
      SELECT
        period_month,
        bu,
        channel,
        distribution_channel,
        distribution_channel_name,
        sales_group,
        SUM(actual_value) AS actual_value,
        SUM(row_count) AS row_count,
        SUM(customer_count) AS customer_count,
        MAX(last_normalized_at) AS last_normalized_at
      FROM ${SERVING_SCHEMA}.sales_internal_month_enriched
      GROUP BY
        period_month,
        bu,
        channel,
        distribution_channel,
        distribution_channel_name,
        sales_group
    `,
  });

  await client.query({
    query: `
      CREATE OR REPLACE VIEW ${SERVING_SCHEMA}.vw_sales_internal_product_month_vs_budget AS
      SELECT *
      FROM \`chiesi-committee.chiesi_committee_mart.vw_sales_internal_product_month_vs_budget\`
    `,
  });

  await client.query({
    query: `
      CREATE OR REPLACE TABLE ${SERVING_SCHEMA}.sales_internal_trend_ytd AS
      WITH latest AS (
        SELECT
          sales_group,
          MAX(period_month) AS max_period
        FROM ${SERVING_SCHEMA}.sales_internal_month_enriched
        GROUP BY sales_group
      ),
      base AS (
        SELECT
          e.sales_group,
          EXTRACT(YEAR FROM e.period_month) AS analysis_year,
          EXTRACT(MONTH FROM l.max_period) AS cutoff_month,
          EXTRACT(MONTH FROM e.period_month) AS month_value,
          SUM(e.actual_value) AS actual_value,
          SUM(COALESCE(e.ly_value, 0)) AS ly_value,
          SUM(COALESCE(e.budget_value, 0)) AS budget_value
        FROM ${SERVING_SCHEMA}.sales_internal_month_enriched e
        JOIN latest l
          ON l.sales_group = e.sales_group
         AND EXTRACT(YEAR FROM e.period_month) = EXTRACT(YEAR FROM l.max_period)
         AND EXTRACT(MONTH FROM e.period_month) <= EXTRACT(MONTH FROM l.max_period)
        GROUP BY 1,2,3,4
      ),
      totals AS (
        SELECT
          sales_group,
          analysis_year,
          cutoff_month,
          SUM(budget_value) AS budget_total
        FROM base
        GROUP BY 1,2,3
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
       AND t.cutoff_month = b.cutoff_month
    `,
  });

  await client.query({
    query: `
      CREATE OR REPLACE TABLE ${SERVING_SCHEMA}.sales_internal_driver_ytd AS
      WITH latest AS (
        SELECT
          sales_group,
          MAX(period_month) AS max_period
        FROM ${SERVING_SCHEMA}.sales_internal_month_enriched
        GROUP BY sales_group
      ),
      ytd AS (
        SELECT
          e.*,
          EXTRACT(YEAR FROM l.max_period) AS analysis_year,
          EXTRACT(MONTH FROM l.max_period) AS cutoff_month
        FROM ${SERVING_SCHEMA}.sales_internal_month_enriched e
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
       AND t.level_type = a.level_type
    `,
  });
}
