CREATE TABLE IF NOT EXISTS `chiesi-committee.chiesi_committee_admin.prepare_reuse_confirmations` (
  confirmation_id STRING NOT NULL,
  reporting_version_id STRING NOT NULL,
  period_month DATE NOT NULL,
  area_code STRING NOT NULL,
  module_code STRING NOT NULL,
  ddd_source STRING,
  original_upload_id STRING NOT NULL,
  confirmed_by STRING,
  confirmed_at TIMESTAMP NOT NULL,
  notes STRING
);
