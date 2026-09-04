CREATE TABLE IF NOT EXISTS `chiesi-committee.chiesi_committee_admin.committee_notification_dispatches` (
  dispatch_id STRING NOT NULL,
  reporting_version_id STRING NOT NULL,
  period_month DATE NOT NULL,
  notification_type STRING NOT NULL,
  dispatch_date DATE NOT NULL,
  source STRING NOT NULL,
  status STRING NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  sent_count INT64,
  message STRING
);
