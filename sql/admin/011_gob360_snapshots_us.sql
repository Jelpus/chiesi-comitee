-- Run as a separate BigQuery job in US. The source GOB360 sales tables are in US.
CREATE SCHEMA IF NOT EXISTS `chiesi-committee.gob360_snapshots`
OPTIONS (location = 'US');

CREATE TABLE IF NOT EXISTS `chiesi-committee.gob360_snapshots.manifest` (
  snapshot_id STRING NOT NULL,
  module_code STRING NOT NULL,
  reporting_version_id STRING,
  validated_through_month DATE NOT NULL,
  source_file_name STRING,
  source_sha256 STRING,
  source_rows INT64,
  control_rows INT64,
  status STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  published_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `chiesi-committee.gob360_snapshots.pieces` (
  snapshot_id STRING NOT NULL,
  module_code STRING NOT NULL,
  clave STRING NOT NULL,
  clave_normalized STRING NOT NULL,
  clue STRING NOT NULL,
  clue_normalized STRING NOT NULL,
  period_month DATE NOT NULL,
  pieces NUMERIC NOT NULL
)
PARTITION BY period_month
CLUSTER BY module_code, clave_normalized, clue_normalized;
