CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_business_excellence_field_force_enriched` AS
WITH fichero AS (
  SELECT
    'fichero' AS source_type,
    s.upload_id,
    s.row_number,
    u.reporting_version_id,
    rv.period_month AS report_period_month,
    u.source_as_of_month,
    u.uploaded_at AS source_uploaded_at,
    s.period_month,
    UPPER(COALESCE(
      NULLIF(TRIM(s.territory_normalized), ''),
      REGEXP_REPLACE(TRIM(COALESCE(s.territory, '')), r'[^a-zA-Z0-9]+', '')
    )) AS territory_key,
    UPPER(REGEXP_REPLACE(TRIM(COALESCE(
      NULLIF(TRIM(s.onekey_id), ''),
      NULLIF(TRIM(s.ims_id), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."Onekey ID"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."OneKey ID"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."ONEKEY ID"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."IMD ID"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."Imd ID"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$.IMD_ID')), '')
    )), r'[^a-zA-Z0-9]+', '')) AS account_key,
    CASE
      WHEN LOWER(TRIM(COALESCE(
        s.bu,
        JSON_VALUE(s.source_payload_json, '$.BU'),
        JSON_VALUE(s.source_payload_json, '$."Business Unit"'),
        JSON_VALUE(s.source_payload_json, '$."Unidad de Negocio"')
      ))) LIKE '%air%' THEN 'air'
      WHEN LOWER(TRIM(COALESCE(
        s.bu,
        JSON_VALUE(s.source_payload_json, '$.BU'),
        JSON_VALUE(s.source_payload_json, '$."Business Unit"'),
        JSON_VALUE(s.source_payload_json, '$."Unidad de Negocio"')
      ))) LIKE '%care%' THEN 'care'
      ELSE NULL
    END AS bu,
    COALESCE(SAFE_CAST(s.objetivo AS FLOAT64), 0) AS target_visits,
    CAST(NULL AS STRING) AS interaction_id,
    CAST(NULL AS BOOL) AS is_sent,
    CAST(NULL AS FLOAT64) AS tft_days_equivalent
  FROM `chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file` s
  JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
    ON u.upload_id = s.upload_id
  LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
    ON rv.reporting_version_id = u.reporting_version_id
  WHERE LOWER(TRIM(u.module_code)) IN (
    'business_excellence_salesforce_fichero_medico',
    'business_excellence_fichero_medico',
    'fichero_medico'
  )
    AND u.status IN ('normalized', 'published')
),
interacciones AS (
  WITH fichero_match AS (
    SELECT
      f.reporting_version_id,
      f.period_month,
      f.territory_key,
      f.account_key,
      f.bu,
      f.target_visits
    FROM fichero f
    WHERE f.account_key IS NOT NULL
      AND f.account_key != ''
      AND f.territory_key IS NOT NULL
      AND f.territory_key != ''
  )
  SELECT
    source_type,
    upload_id,
    row_number,
    reporting_version_id,
    report_period_month,
    source_as_of_month,
    source_uploaded_at,
    period_month,
    territory_key,
    account_key,
    match_bu AS bu,
    match_target_visits AS target_visits,
    interaction_id,
    is_sent,
    tft_days_equivalent
  FROM (
  SELECT
    'interacciones' AS source_type,
    s.upload_id,
    s.row_number,
    u.reporting_version_id,
    rv.period_month AS report_period_month,
    u.source_as_of_month,
    u.uploaded_at AS source_uploaded_at,
    s.interaction_period_month AS period_month,
    UPPER(COALESCE(
      NULLIF(TRIM(s.territory_normalized), ''),
      REGEXP_REPLACE(TRIM(COALESCE(s.territory, '')), r'[^a-zA-Z0-9]+', '')
    )) AS territory_key,
    UPPER(REGEXP_REPLACE(TRIM(COALESCE(
      NULLIF(TRIM(s.onekey_id), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."Cuenta: Código OneKey"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."Cuenta: Codigo OneKey"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."Codigo OneKey"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."IMD ID"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."Imd ID"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$.IMD_ID')), '')
    )), r'[^a-zA-Z0-9]+', '')) AS account_key,
    fm.bu AS match_bu,
    fm.target_visits AS match_target_visits,
    s.interaction_id,
    LOWER(TRIM(COALESCE(
      JSON_VALUE(s.source_payload_json, '$.Estado'),
      JSON_VALUE(s.source_payload_json, '$.estado'),
      JSON_VALUE(s.source_payload_json, '$.Status'),
      JSON_VALUE(s.source_payload_json, '$.status'),
      ''
    ))) IN ('enviado', 'sent') AS is_sent,
    CAST(NULL AS FLOAT64) AS tft_days_equivalent
  FROM `chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_interactions` s
  JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
    ON u.upload_id = s.upload_id
  LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
    ON rv.reporting_version_id = u.reporting_version_id
  LEFT JOIN fichero_match fm
    ON fm.reporting_version_id = u.reporting_version_id
   AND fm.account_key = UPPER(REGEXP_REPLACE(TRIM(COALESCE(
      NULLIF(TRIM(s.onekey_id), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."Cuenta: Código OneKey"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."Cuenta: Codigo OneKey"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."Codigo OneKey"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."IMD ID"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$."Imd ID"')), ''),
      NULLIF(TRIM(JSON_VALUE(s.source_payload_json, '$.IMD_ID')), '')
    )), r'[^a-zA-Z0-9]+', ''))
   AND fm.territory_key = UPPER(COALESCE(
     NULLIF(TRIM(s.territory_normalized), ''),
     REGEXP_REPLACE(TRIM(COALESCE(s.territory, '')), r'[^a-zA-Z0-9]+', '')
   ))
   AND fm.period_month <= s.interaction_period_month
  WHERE LOWER(TRIM(u.module_code)) IN (
    'business_excellence_salesforce_interacciones',
    'business_excellence_interacciones',
    'interacciones'
  )
    AND u.status IN ('normalized', 'published')
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY s.upload_id, s.row_number
    ORDER BY fm.period_month DESC NULLS LAST
  ) = 1
  )
),
tft AS (
  SELECT
    'tft' AS source_type,
    s.upload_id,
    s.row_number,
    u.reporting_version_id,
    rv.period_month AS report_period_month,
    u.source_as_of_month,
    u.uploaded_at AS source_uploaded_at,
    s.period_month,
    UPPER(COALESCE(
      NULLIF(TRIM(s.territory_normalized), ''),
      REGEXP_REPLACE(TRIM(COALESCE(s.territorio, '')), r'[^a-zA-Z0-9]+', '')
    )) AS territory_key,
    CAST(NULL AS STRING) AS account_key,
    CAST(NULL AS STRING) AS bu,
    CAST(NULL AS FLOAT64) AS target_visits,
    CAST(NULL AS STRING) AS interaction_id,
    CAST(NULL AS BOOL) AS is_sent,
    CASE
      WHEN LOWER(TRIM(COALESCE(s.absence_type, ''))) LIKE '%hora%'
        OR LOWER(TRIM(COALESCE(s.absence_name, ''))) LIKE '%hora%'
        THEN COALESCE(SAFE_CAST(s.days_value AS FLOAT64), 0) / 8.0
      ELSE COALESCE(SAFE_CAST(s.days_value AS FLOAT64), 0)
    END AS tft_days_equivalent
  FROM `chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_tft` s
  JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
    ON u.upload_id = s.upload_id
  LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
    ON rv.reporting_version_id = u.reporting_version_id
  WHERE LOWER(TRIM(u.module_code)) IN (
    'business_excellence_salesforce_tft',
    'business_excellence_tft',
    'tft'
  )
    AND u.status IN ('normalized', 'published')
)
SELECT * FROM fichero
UNION ALL
SELECT * FROM interacciones
UNION ALL
SELECT * FROM tft;
