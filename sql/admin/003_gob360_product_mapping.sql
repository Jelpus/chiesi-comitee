CREATE TABLE IF NOT EXISTS `chiesi-committee.chiesi_committee_admin.gob360_product_mapping` (
  source_clave STRING NOT NULL,
  source_clave_normalized STRING NOT NULL,
  product_id STRING,
  market_group STRING,
  is_active BOOL NOT NULL,
  created_at TIMESTAMP NOT NULL,
  created_by STRING,
  updated_at TIMESTAMP NOT NULL,
  updated_by STRING
);
