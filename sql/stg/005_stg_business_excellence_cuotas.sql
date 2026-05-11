CREATE TABLE IF NOT EXISTS `chiesi-committee.chiesi_committee_stg.stg_business_excellence_cuotas` (
  upload_id STRING,
  row_number INT64,
  business_unit STRING,
  advisor STRING,
  manager STRING,
  source_product_raw STRING,
  source_product_normalized STRING,
  product_id STRING,
  canonical_product_name STRING,
  market_group STRING,
  channel STRING,
  period_raw STRING,
  period_month DATE,
  quota_value NUMERIC,
  source_payload_json JSON,
  normalized_at TIMESTAMP
);
