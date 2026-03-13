CREATE TABLE IF NOT EXISTS `chiesi-committee.chiesi_committee_stg.stg_business_excellence_brick_assignment` (
  upload_id STRING,
  row_number INT64,
  brick_code STRING,
  brick_description STRING,
  state STRING,
  category STRING,
  district STRING,
  territory_id STRING,
  manager STRING,
  territory STRING,
  visited BOOL,
  period_month DATE,
  source_payload_json JSON,
  normalized_at TIMESTAMP
);
