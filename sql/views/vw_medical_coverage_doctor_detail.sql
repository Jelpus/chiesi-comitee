CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_mart.vw_medical_coverage_doctor_detail` AS
-- Field Force Excellence - Doctor detail grain
-- Grain: reporting_version_id + period_scope + territory_normalized + doctor_id
WITH reporting_context AS (
  -- Reporting period anchor by version.
  SELECT
    rv.reporting_version_id,
    rv.period_month AS report_period_month
  FROM `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
),
period_scopes AS (
  -- Two supported scopes for each reporting version.
  SELECT
    reporting_version_id,
    report_period_month,
    'MTH' AS period_scope,
    report_period_month AS period_start_month,
    report_period_month AS period_end_month,
    1 AS months_in_scope
  FROM reporting_context
  UNION ALL
  SELECT
    reporting_version_id,
    report_period_month,
    'YTD' AS period_scope,
    DATE_TRUNC(report_period_month, YEAR) AS period_start_month,
    report_period_month AS period_end_month,
    DATE_DIFF(report_period_month, DATE_TRUNC(report_period_month, YEAR), MONTH) + 1 AS months_in_scope
  FROM reporting_context
),
uploads_filtered AS (
  -- Candidate uploads for the 3 sources.
  SELECT
    u.upload_id,
    u.reporting_version_id,
    u.period_month,
    u.source_as_of_month,
    u.uploaded_at,
    LOWER(TRIM(u.module_code)) AS module_code
  FROM `chiesi-committee.chiesi_committee_raw.uploads` u
  JOIN reporting_context rc
    ON rc.reporting_version_id = u.reporting_version_id
  WHERE u.status IN ('normalized', 'published')
),
latest_fichero_upload AS (
  -- Latest fichero <= report period (fallback to latest if source_as_of is null).
  SELECT
    uf.reporting_version_id,
    uf.upload_id
  FROM uploads_filtered uf
  JOIN reporting_context rc
    ON rc.reporting_version_id = uf.reporting_version_id
  WHERE uf.module_code IN (
    'business_excellence_salesforce_fichero_medico',
    'business_excellence_fichero_medico',
    'fichero_medico'
  )
    AND COALESCE(uf.source_as_of_month, uf.period_month) <= rc.report_period_month
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY uf.reporting_version_id
    ORDER BY COALESCE(uf.source_as_of_month, uf.period_month) DESC, uf.uploaded_at DESC
  ) = 1
),
latest_interactions_upload AS (
  -- Latest interacciones <= report period.
  SELECT
    uf.reporting_version_id,
    uf.upload_id
  FROM uploads_filtered uf
  JOIN reporting_context rc
    ON rc.reporting_version_id = uf.reporting_version_id
  WHERE uf.module_code IN (
    'business_excellence_salesforce_interacciones',
    'business_excellence_interacciones',
    'interacciones'
  )
    AND COALESCE(uf.source_as_of_month, uf.period_month) <= rc.report_period_month
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY uf.reporting_version_id
    ORDER BY COALESCE(uf.source_as_of_month, uf.period_month) DESC, uf.uploaded_at DESC
  ) = 1
),
latest_tft_upload AS (
  -- Latest TFT <= report period.
  SELECT
    uf.reporting_version_id,
    uf.upload_id
  FROM uploads_filtered uf
  JOIN reporting_context rc
    ON rc.reporting_version_id = uf.reporting_version_id
  WHERE uf.module_code IN (
    'business_excellence_salesforce_tft',
    'business_excellence_tft',
    'tft'
  )
    AND COALESCE(uf.source_as_of_month, uf.period_month) <= rc.report_period_month
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY uf.reporting_version_id
    ORDER BY COALESCE(uf.source_as_of_month, uf.period_month) DESC, uf.uploaded_at DESC
  ) = 1
),
base_fichero_raw AS (
  -- Dominant base (raw). BU filtered to AIR/CARE.
  SELECT
    lf.reporting_version_id,
    UPPER(COALESCE(NULLIF(TRIM(f.territory_normalized), ''), REGEXP_REPLACE(TRIM(COALESCE(f.territory, '')), r'[^a-zA-Z0-9]+', ''))) AS territory_normalized,
    f.territory AS territory_name,
    CASE
      WHEN LOWER(TRIM(COALESCE(f.bu, ''))) LIKE '%air%' THEN 'AIR'
      WHEN LOWER(TRIM(COALESCE(f.bu, ''))) LIKE '%care%' THEN 'CARE'
      ELSE NULL
    END AS bu,
    NULLIF(TRIM(f.district), '') AS district,
    NULLIF(TRIM(f.potencial), '') AS potencial,
    COALESCE(NULLIF(TRIM(f.full_name), ''), 'N/A') AS client_name,
    UPPER(REGEXP_REPLACE(TRIM(COALESCE(NULLIF(f.ims_id, ''), NULLIF(f.onekey_id, ''))), r'[^a-zA-Z0-9]+', '')) AS doctor_id,
    COALESCE(SAFE_CAST(f.objetivo AS FLOAT64), 0.0) AS objetivo
  FROM `chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file` f
  JOIN latest_fichero_upload lf
    ON lf.upload_id = f.upload_id
  WHERE UPPER(REGEXP_REPLACE(TRIM(COALESCE(NULLIF(f.ims_id, ''), NULLIF(f.onekey_id, ''))), r'[^a-zA-Z0-9]+', '')) IS NOT NULL
    AND UPPER(REGEXP_REPLACE(TRIM(COALESCE(NULLIF(f.ims_id, ''), NULLIF(f.onekey_id, ''))), r'[^a-zA-Z0-9]+', '')) != ''
    AND CASE
      WHEN LOWER(TRIM(COALESCE(f.bu, ''))) LIKE '%air%' THEN 'AIR'
      WHEN LOWER(TRIM(COALESCE(f.bu, ''))) LIKE '%care%' THEN 'CARE'
      ELSE NULL
    END IN ('AIR', 'CARE')
),
base_fichero AS (
  -- Deduplicate fichero to analytical grain: territory + doctor.
  -- Prevents multiplying interactions when source fichero has repeated rows for the same account-route pair.
  SELECT
    reporting_version_id,
    territory_normalized,
    ARRAY_AGG(territory_name IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS territory_name,
    ARRAY_AGG(bu IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS bu,
    ARRAY_AGG(district IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS district,
    ARRAY_AGG(potencial IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS potencial,
    ARRAY_AGG(client_name IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS client_name,
    doctor_id,
    MAX(COALESCE(objetivo, 0.0)) AS objetivo
  FROM base_fichero_raw
  GROUP BY 1, 2, 8
),
interacciones_base AS (
  -- Event table filtered to sent interactions.
  SELECT
    li.reporting_version_id,
    UPPER(COALESCE(NULLIF(TRIM(i.territory_normalized), ''), REGEXP_REPLACE(TRIM(COALESCE(i.territory, '')), r'[^a-zA-Z0-9]+', ''))) AS territory_normalized,
    UPPER(REGEXP_REPLACE(TRIM(COALESCE(i.onekey_id, '')), r'[^a-zA-Z0-9]+', '')) AS doctor_id,
    i.submit_period_month AS event_month,
    i.interaction_id
  FROM `chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_interactions` i
  JOIN latest_interactions_upload li
    ON li.upload_id = i.upload_id
  WHERE i.submit_period_month IS NOT NULL
    AND UPPER(REGEXP_REPLACE(TRIM(COALESCE(i.onekey_id, '')), r'[^a-zA-Z0-9]+', '')) != ''
    AND LOWER(TRIM(COALESCE(
      JSON_VALUE(i.source_payload_json, '$.Estado'),
      JSON_VALUE(i.source_payload_json, '$.estado'),
      JSON_VALUE(i.source_payload_json, '$.Status'),
      JSON_VALUE(i.source_payload_json, '$.status'),
      ''
    ))) IN ('enviado', 'sent')
),
interacciones_por_doctor AS (
  -- Interactions aggregated by doctor and period scope.
  SELECT
    ps.reporting_version_id,
    ps.period_scope,
    ib.territory_normalized,
    ib.doctor_id,
    COUNT(*) AS interacciones
  FROM period_scopes ps
  JOIN interacciones_base ib
    ON ib.reporting_version_id = ps.reporting_version_id
   AND ib.event_month BETWEEN ps.period_start_month AND ps.period_end_month
  GROUP BY 1, 2, 3, 4
),
ausencias_base AS (
  -- TFT normalized to days-equivalent.
  SELECT
    lt.reporting_version_id,
    UPPER(COALESCE(NULLIF(TRIM(t.territory_normalized), ''), REGEXP_REPLACE(TRIM(COALESCE(t.territorio, '')), r'[^a-zA-Z0-9]+', ''))) AS territory_normalized,
    t.period_month AS event_month,
    CASE
      WHEN LOWER(TRIM(COALESCE(t.absence_type, ''))) LIKE '%hora%'
        OR LOWER(TRIM(COALESCE(t.absence_name, ''))) LIKE '%hora%'
        THEN COALESCE(SAFE_CAST(t.days_value AS FLOAT64), 0.0) / 8.0
      ELSE COALESCE(SAFE_CAST(t.days_value AS FLOAT64), 0.0)
    END AS dias_fuera_equivalentes
  FROM `chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_tft` t
  JOIN latest_tft_upload lt
    ON lt.upload_id = t.upload_id
  WHERE t.period_month IS NOT NULL
),
ausencias_por_territorio AS (
  -- TFT aggregated by territory and scope.
  SELECT
    ps.reporting_version_id,
    ps.period_scope,
    ab.territory_normalized,
    SUM(ab.dias_fuera_equivalentes) AS dias_fuera
  FROM period_scopes ps
  JOIN ausencias_base ab
    ON ab.reporting_version_id = ps.reporting_version_id
   AND ab.event_month BETWEEN ps.period_start_month AND ps.period_end_month
  GROUP BY 1, 2, 3
),
doctor_detail AS (
  -- Final doctor-level KPI layer.
  SELECT
    ps.reporting_version_id,
    ps.report_period_month,
    ps.period_scope,
    ps.period_start_month,
    ps.period_end_month,
    ps.months_in_scope,
    bf.bu,
    bf.district,
    bf.territory_name,
    bf.territory_normalized,
    bf.potencial,
    bf.client_name,
    bf.doctor_id,
    COALESCE(bf.objetivo, 0.0) AS objetivo,
    COALESCE(ipd.interacciones, 0) AS interacciones,
    COALESCE(apt.dias_fuera, 0.0) AS dias_fuera_territorio,
    GREATEST(0.0, (ps.months_in_scope * 20.0) - COALESCE(apt.dias_fuera, 0.0)) AS dias_activos_territorio,
    SAFE_DIVIDE(
      GREATEST(0.0, (ps.months_in_scope * 20.0) - COALESCE(apt.dias_fuera, 0.0)),
      ps.months_in_scope * 20.0
    ) AS porcentaje_tiempo_activo_territorio
  FROM period_scopes ps
  JOIN base_fichero bf
    ON bf.reporting_version_id = ps.reporting_version_id
  LEFT JOIN interacciones_por_doctor ipd
    ON ipd.reporting_version_id = ps.reporting_version_id
   AND ipd.period_scope = ps.period_scope
   AND ipd.territory_normalized = bf.territory_normalized
   AND ipd.doctor_id = bf.doctor_id
  LEFT JOIN ausencias_por_territorio apt
    ON apt.reporting_version_id = ps.reporting_version_id
   AND apt.period_scope = ps.period_scope
   AND apt.territory_normalized = bf.territory_normalized
)
SELECT
  reporting_version_id,
  report_period_month,
  period_scope,
  period_start_month,
  period_end_month,
  months_in_scope,
  bu,
  district,
  territory_name,
  territory_normalized,
  potencial,
  client_name,
  doctor_id,
  -- Objective must scale with period scope (MTH=1, YTD=n months).
  objetivo * months_in_scope AS objetivo,
  interacciones,
  dias_fuera_territorio,
  dias_activos_territorio,
  porcentaje_tiempo_activo_territorio,
  (objetivo * months_in_scope) * porcentaje_tiempo_activo_territorio AS objetivo_ajustado,
  SAFE_DIVIDE(interacciones, NULLIF(objetivo * months_in_scope, 0.0)) AS cobertura,
  SAFE_DIVIDE(interacciones, NULLIF((objetivo * months_in_scope) * porcentaje_tiempo_activo_territorio, 0.0)) AS cobertura_ajustada,
  CASE
    WHEN interacciones = 0 THEN 'no_visitado'
    WHEN interacciones < (objetivo * months_in_scope) THEN 'subvisitado'
    WHEN interacciones = (objetivo * months_in_scope) THEN 'en_objetivo'
    WHEN interacciones > (objetivo * months_in_scope) THEN 'sobrevisitado'
    ELSE 'sin_clasificacion'
  END AS status_visita
FROM doctor_detail;
