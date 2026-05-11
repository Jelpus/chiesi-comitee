CREATE TABLE IF NOT EXISTS `chiesi-committee.chiesi_committee_admin.reporting_versions` (
  reporting_version_id STRING NOT NULL,
  period_month DATE NOT NULL,
  version_name STRING NOT NULL,
  version_number INT64 NOT NULL,
  status STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  created_by STRING,
  closed_at TIMESTAMP,
  closed_by STRING,
  notes STRING
);

