CREATE TABLE IF NOT EXISTS `chiesi-committee.chiesi_committee_admin.app_settings` (
  setting_key STRING NOT NULL,
  setting_value STRING NOT NULL,
  description STRING,
  updated_at TIMESTAMP NOT NULL,
  updated_by STRING
);

MERGE `chiesi-committee.chiesi_committee_admin.app_settings` AS target
USING UNNEST([
  STRUCT('committee_responsible_name' AS setting_key, 'Adriana Rodriguez' AS setting_value, 'Committee responsible name' AS description),
  STRUCT('committee_responsible_email', 'a.rodriguezp@chiesi.com', 'Committee responsible email'),
  STRUCT('planning_reminder_1_days_before', '10', 'Default days before Committee for first reminder'),
  STRUCT('planning_reminder_2_days_before', '5', 'Default days before Committee for second reminder'),
  STRUCT('planning_validation_days_before', '3', 'Default days before Committee for validation')
]) AS source
ON target.setting_key = source.setting_key
WHEN NOT MATCHED THEN INSERT (setting_key, setting_value, description, updated_at, updated_by)
VALUES (source.setting_key, source.setting_value, source.description, CURRENT_TIMESTAMP(), 'migration_009');

CREATE TABLE IF NOT EXISTS `chiesi-committee.chiesi_committee_admin.committee_planning` (
  planning_id STRING NOT NULL,
  period_month DATE NOT NULL,
  committee_date DATE NOT NULL,
  request_info_date DATE NOT NULL,
  reminder_1_date DATE NOT NULL,
  reminder_2_date DATE NOT NULL,
  validation_date DATE NOT NULL,
  reporting_version_id STRING,
  is_active BOOL NOT NULL,
  notes STRING,
  created_at TIMESTAMP NOT NULL,
  created_by STRING,
  updated_at TIMESTAMP NOT NULL,
  updated_by STRING
);

CREATE TABLE IF NOT EXISTS `chiesi-committee.chiesi_committee_admin.committee_automation_log` (
  planning_id STRING NOT NULL,
  event_type STRING NOT NULL,
  scheduled_date DATE NOT NULL,
  status STRING NOT NULL,
  processed_at TIMESTAMP NOT NULL,
  message STRING,
  reporting_version_id STRING
);
