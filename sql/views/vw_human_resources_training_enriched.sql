CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_human_resources_training_enriched` AS
SELECT
  t.upload_id,
  t.row_number,
  u.reporting_version_id,
  rv.period_month AS report_period_month,
  u.source_as_of_month,
  u.uploaded_at AS source_uploaded_at,
  t.period_month,
  t.user_name,
  t.active_user,
  t.first_name,
  t.last_name,
  t.middle_name,
  t.entity_id,
  t.item_type,
  t.entity_type,
  t.item_revision_date_month,
  t.revision_number,
  t.entity_title,
  t.class_id,
  t.completion_date_month,
  t.grade,
  t.completion_status_id,
  t.completion_status,
  t.total_hours,
  t.credit_hours_professional_associations,
  t.contact_hours,
  t.cpe,
  t.tuition,
  t.currency_symbol,
  t.currency_id,
  t.instructor,
  t.last_update_user,
  t.last_update_time_month,
  t.e_signature_meaning_code,
  t.comments,
  t.source_payload_json,
  t.normalized_at
FROM `chiesi-committee.chiesi_committee_stg.stg_human_resources_training` t
JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
  ON u.upload_id = t.upload_id
LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
  ON rv.reporting_version_id = u.reporting_version_id
WHERE LOWER(TRIM(u.module_code)) IN (
  'human_resources_training',
  'human_resources_entrenamiento'
)
  AND u.status IN ('normalized', 'published');

