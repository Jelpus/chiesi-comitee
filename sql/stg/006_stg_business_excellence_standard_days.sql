CREATE TABLE IF NOT EXISTS `chiesi-committee.chiesi_committee_stg.stg_business_excellence_standard_days` (
  upload_id STRING,
  row_number INT64,
  period_month DATE,
  standard_days NUMERIC,
  source_payload_json JSON,
  normalized_at TIMESTAMP
);
