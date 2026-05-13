CREATE TABLE IF NOT EXISTS `chiesi-committee.chiesi_committee_admin.form_responsibles` (
  form_code STRING NOT NULL,
  form_label STRING NOT NULL,
  form_path STRING NOT NULL,
  owner_name STRING,
  email_owner STRING NOT NULL,
  is_active BOOL NOT NULL,
  notes STRING,
  created_at TIMESTAMP,
  created_by STRING,
  updated_at TIMESTAMP,
  updated_by STRING
);
