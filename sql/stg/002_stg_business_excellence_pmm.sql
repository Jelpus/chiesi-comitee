CREATE TABLE IF NOT EXISTS `chiesi-committee.chiesi_committee_stg.stg_business_excellence_pmm` (
  upload_id STRING,
  row_number INT64,
  pack_des_raw STRING,
  pack_des_normalized STRING,
  product_id STRING,
  canonical_product_name STRING,
  market_group STRING,
  brick STRING,
  source_month_raw STRING,
  source_year_raw STRING,
  source_date DATE,
  period_month DATE,
  sales_group STRING,
  amount_value NUMERIC,
  source_payload_json JSON,
  normalized_at TIMESTAMP
);
