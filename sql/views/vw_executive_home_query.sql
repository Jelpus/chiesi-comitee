CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_mart.vw_executive_home_query` AS
SELECT
  CAST(period AS STRING) AS period,
  version,
  area,
  main_kpi_value,
  target_value,
  variance_value,
  landing_url
FROM `chiesi-committee.chiesi_committee_mart.mart_executive_home_query_snapshot`;
