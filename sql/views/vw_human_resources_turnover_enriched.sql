CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_human_resources_turnover_enriched` AS
SELECT
  t.upload_id,
  t.row_number,
  u.reporting_version_id,
  rv.period_month AS report_period_month,
  u.source_as_of_month,
  u.uploaded_at AS source_uploaded_at,
  t.period_month,
  t.vol_non_vol,
  t.last_name,
  t.first_name,
  t.position_name,
  t.department,
  t.territory,
  t.manager,
  t.salary,
  t.salary_bands,
  t.salary_bands_pct,
  t.internal_or_external,
  t.key_people,
  t.key_position,
  t.hiring_date_month,
  t.last_working_day_month,
  t.quarter,
  t.year,
  t.years,
  t.seniority_cluster,
  t.age_as_of_date,
  t.seniority,
  t.gender,
  t.grade,
  t.termination_ad_rationale,
  t.source_payload_json,
  t.normalized_at
FROM `chiesi-committee.chiesi_committee_stg.stg_human_resources_turnover` t
JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
  ON u.upload_id = t.upload_id
LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
  ON rv.reporting_version_id = u.reporting_version_id
WHERE LOWER(TRIM(u.module_code)) IN ('human_resources_turnover')
  AND u.status IN ('normalized', 'published');

