-- AIR serving layer
-- Run in BigQuery (Standard SQL)
-- Project: chiesi-committee
-- Region: EU
--
-- The application refresh implementation lives in:
-- lib/serving/refresh-air-serving.ts
--
-- Objects created by the refresh:
-- 1) chiesi_committee_serving.air_medical_file_rows
-- 2) chiesi_committee_serving.air_closeup_doctor_mat

CREATE SCHEMA IF NOT EXISTS `chiesi-committee.chiesi_committee_serving`
OPTIONS (
  location = 'EU',
  description = 'Serving dataset for Next.js and BI application-ready views'
);

-- The TypeScript refresh creates partitioned and clustered tables so /air can read
-- prefiltered AIR medical rows and preaggregated CloseUp MAT metrics instead of
-- scanning staging views on every page load.
