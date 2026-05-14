CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_human_resources_open_vacancy_enriched` AS
SELECT
  v.upload_id,
  v.row_number,
  u.reporting_version_id,
  rv.period_month AS report_period_month,
  u.source_as_of_month,
  u.uploaded_at AS source_uploaded_at,
  v.period_month,
  v.status,
  v.location,
  v.employer,
  v.area,
  v.vacancy_type,
  v.subtype,
  v.covering_for,
  v.manager,
  v.comments_initial,
  v.resp_hr,
  v.agency_type,
  v.agency,
  v.assigned_recruiter,
  v.levantamiento_date,
  v.search_start_date,
  v.end_date,
  v.time_to_fill_days,
  v.hire_date,
  v.comments_final,
  v.target_days,
  SAFE_CAST(v.time_to_fill_days <= v.target_days AS BOOL) AS within_target,
  v.source_payload_json,
  v.normalized_at
FROM `chiesi-committee.chiesi_committee_stg.stg_human_resources_open_vacancy` v
JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
  ON u.upload_id = v.upload_id
LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
  ON rv.reporting_version_id = u.reporting_version_id
WHERE LOWER(TRIM(u.module_code)) = 'human_resources_open_vacancy'
  AND u.status IN ('normalized', 'published');
