CREATE TABLE IF NOT EXISTS `chiesi-committee.chiesi_committee_stg.stg_business_excellence_closeup` (
  upload_id STRING,
  row_number INT64,
  product_closeup_raw STRING,
  product_closeup_normalized STRING,
  product_id STRING,
  canonical_product_name STRING,
  market_group STRING,
  specialty STRING,
  source_date_raw STRING,
  source_date DATE,
  period_month DATE,
  recetas_value NUMERIC,
  source_payload_json JSON,
  normalized_at TIMESTAMP
);
