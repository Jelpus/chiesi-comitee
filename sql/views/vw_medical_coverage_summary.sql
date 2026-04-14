CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_mart.vw_medical_coverage_summary` AS
-- Field Force Excellence - Summary layer
-- Source: chiesi_committee_mart.vw_medical_coverage_doctor_detail
WITH doctor_detail AS (
  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    months_in_scope,
    bu,
    district,
    territory_name,
    territory_normalized,
    doctor_id,
    objetivo,
    interacciones,
    objetivo_ajustado,
    status_visita,
    dias_fuera_territorio
  FROM `chiesi-committee.chiesi_committee_mart.vw_medical_coverage_doctor_detail`
),
territory_days AS (
  -- One row per territory/scope to avoid duplicating TFT by doctor count.
  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    months_in_scope,
    bu,
    district,
    territory_name,
    territory_normalized,
    MAX(dias_fuera_territorio) AS dias_fuera
  FROM doctor_detail
  GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
),
doctor_metrics AS (
  -- Doctor-based metrics for all requested aggregation levels.
  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    months_in_scope,
    'territory' AS aggregation_level,
    bu,
    district,
    territory_name,
    territory_normalized,
    COUNT(DISTINCT CONCAT(territory_normalized, '|', doctor_id)) AS clientes,
    SUM(COALESCE(objetivo, 0.0)) AS objetivo,
    SUM(COALESCE(interacciones, 0)) AS interacciones,
    SUM(COALESCE(objetivo_ajustado, 0.0)) AS objetivo_ajustado,
    COUNTIF(status_visita = 'no_visitado') AS no_visitados,
    COUNTIF(status_visita = 'subvisitado') AS subvisitados,
    COUNTIF(status_visita = 'en_objetivo') AS en_objetivo,
    COUNTIF(status_visita = 'sobrevisitado') AS sobrevisitados
  FROM doctor_detail
  GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9

  UNION ALL

  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    months_in_scope,
    'district' AS aggregation_level,
    bu,
    district,
    CAST(NULL AS STRING) AS territory_name,
    CAST(NULL AS STRING) AS territory_normalized,
    COUNT(DISTINCT CONCAT(territory_normalized, '|', doctor_id)) AS clientes,
    SUM(COALESCE(objetivo, 0.0)) AS objetivo,
    SUM(COALESCE(interacciones, 0)) AS interacciones,
    SUM(COALESCE(objetivo_ajustado, 0.0)) AS objetivo_ajustado,
    COUNTIF(status_visita = 'no_visitado') AS no_visitados,
    COUNTIF(status_visita = 'subvisitado') AS subvisitados,
    COUNTIF(status_visita = 'en_objetivo') AS en_objetivo,
    COUNTIF(status_visita = 'sobrevisitado') AS sobrevisitados
  FROM doctor_detail
  GROUP BY 1, 2, 3, 4, 5, 6, 7

  UNION ALL

  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    months_in_scope,
    'bu' AS aggregation_level,
    bu,
    CAST(NULL AS STRING) AS district,
    CAST(NULL AS STRING) AS territory_name,
    CAST(NULL AS STRING) AS territory_normalized,
    COUNT(DISTINCT CONCAT(territory_normalized, '|', doctor_id)) AS clientes,
    SUM(COALESCE(objetivo, 0.0)) AS objetivo,
    SUM(COALESCE(interacciones, 0)) AS interacciones,
    SUM(COALESCE(objetivo_ajustado, 0.0)) AS objetivo_ajustado,
    COUNTIF(status_visita = 'no_visitado') AS no_visitados,
    COUNTIF(status_visita = 'subvisitado') AS subvisitados,
    COUNTIF(status_visita = 'en_objetivo') AS en_objetivo,
    COUNTIF(status_visita = 'sobrevisitado') AS sobrevisitados
  FROM doctor_detail
  GROUP BY 1, 2, 3, 4, 5, 6

  UNION ALL

  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    months_in_scope,
    'total' AS aggregation_level,
    'TOTAL' AS bu,
    CAST(NULL AS STRING) AS district,
    CAST(NULL AS STRING) AS territory_name,
    CAST(NULL AS STRING) AS territory_normalized,
    COUNT(DISTINCT CONCAT(territory_normalized, '|', doctor_id)) AS clientes,
    SUM(COALESCE(objetivo, 0.0)) AS objetivo,
    SUM(COALESCE(interacciones, 0)) AS interacciones,
    SUM(COALESCE(objetivo_ajustado, 0.0)) AS objetivo_ajustado,
    COUNTIF(status_visita = 'no_visitado') AS no_visitados,
    COUNTIF(status_visita = 'subvisitado') AS subvisitados,
    COUNTIF(status_visita = 'en_objetivo') AS en_objetivo,
    COUNTIF(status_visita = 'sobrevisitado') AS sobrevisitados
  FROM doctor_detail
  GROUP BY 1, 2, 3, 4, 5, 6
),
day_metrics AS (
  -- Territory-based metrics (dias_fuera, territories) for all levels.
  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    months_in_scope,
    'territory' AS aggregation_level,
    bu,
    district,
    territory_name,
    territory_normalized,
    SUM(COALESCE(dias_fuera, 0.0)) AS dias_fuera,
    COUNT(*) AS total_territorios
  FROM territory_days
  GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9

  UNION ALL

  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    months_in_scope,
    'district' AS aggregation_level,
    bu,
    district,
    CAST(NULL AS STRING) AS territory_name,
    CAST(NULL AS STRING) AS territory_normalized,
    SUM(COALESCE(dias_fuera, 0.0)) AS dias_fuera,
    COUNT(*) AS total_territorios
  FROM territory_days
  GROUP BY 1, 2, 3, 4, 5, 6, 7

  UNION ALL

  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    months_in_scope,
    'bu' AS aggregation_level,
    bu,
    CAST(NULL AS STRING) AS district,
    CAST(NULL AS STRING) AS territory_name,
    CAST(NULL AS STRING) AS territory_normalized,
    SUM(COALESCE(dias_fuera, 0.0)) AS dias_fuera,
    COUNT(*) AS total_territorios
  FROM territory_days
  GROUP BY 1, 2, 3, 4, 5, 6

  UNION ALL

  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    months_in_scope,
    'total' AS aggregation_level,
    'TOTAL' AS bu,
    CAST(NULL AS STRING) AS district,
    CAST(NULL AS STRING) AS territory_name,
    CAST(NULL AS STRING) AS territory_normalized,
    SUM(COALESCE(dias_fuera, 0.0)) AS dias_fuera,
    COUNT(*) AS total_territorios
  FROM territory_days
  GROUP BY 1, 2, 3, 4, 5, 6
),
all_levels AS (
  SELECT
    dm.reporting_version_id,
    dm.report_period_month,
    dm.period_scope,
    dm.months_in_scope,
    dm.aggregation_level,
    dm.bu,
    dm.district,
    dm.territory_name,
    dm.territory_normalized,
    dd.total_territorios,
    dm.clientes,
    dm.objetivo,
    dm.interacciones,
    dd.dias_fuera,
    dm.objetivo_ajustado,
    dm.no_visitados,
    dm.subvisitados,
    dm.en_objetivo,
    dm.sobrevisitados
  FROM doctor_metrics dm
  JOIN day_metrics dd
    ON dd.reporting_version_id = dm.reporting_version_id
   AND dd.period_scope = dm.period_scope
   AND dd.aggregation_level = dm.aggregation_level
   AND dd.bu = dm.bu
   AND IFNULL(dd.district, '') = IFNULL(dm.district, '')
   AND IFNULL(dd.territory_normalized, '') = IFNULL(dm.territory_normalized, '')
),
with_kpis AS (
  SELECT
    al.*,
    SAFE_DIVIDE(al.interacciones, NULLIF(al.objetivo, 0.0)) AS cobertura,
    SAFE_DIVIDE(al.interacciones, NULLIF(al.objetivo_ajustado, 0.0)) AS cobertura_ajustada,
    SAFE_DIVIDE(
      GREATEST(0.0, (al.months_in_scope * 20.0 * al.total_territorios) - COALESCE(al.dias_fuera, 0.0)),
      NULLIF(al.months_in_scope * 20.0 * al.total_territorios, 0.0)
    ) AS porcentaje_tiempo_activo
  FROM all_levels al
),
total_coverage_ref AS (
  -- Total reference for BU evolution index.
  SELECT
    reporting_version_id,
    period_scope,
    cobertura AS cobertura_total,
    cobertura_ajustada AS cobertura_ajustada_total
  FROM with_kpis
  WHERE aggregation_level = 'total'
)
SELECT
  wk.reporting_version_id,
  wk.report_period_month,
  wk.period_scope,
  wk.aggregation_level,
  wk.bu,
  wk.district,
  wk.territory_name,
  wk.territory_normalized,
  wk.total_territorios,
  wk.clientes,
  wk.objetivo,
  wk.interacciones,
  wk.dias_fuera,
  wk.objetivo_ajustado,
  wk.cobertura,
  wk.cobertura_ajustada,
  wk.porcentaje_tiempo_activo,
  wk.no_visitados,
  wk.subvisitados,
  wk.en_objetivo,
  wk.sobrevisitados,
  CASE
    WHEN wk.aggregation_level = 'bu'
      THEN SAFE_MULTIPLY(SAFE_DIVIDE(wk.cobertura, NULLIF(tcr.cobertura_total, 0.0)), 100.0)
    ELSE NULL
  END AS indice_evolucion_bu,
  CASE
    WHEN wk.aggregation_level = 'bu'
      THEN SAFE_MULTIPLY(SAFE_DIVIDE(wk.cobertura_ajustada, NULLIF(tcr.cobertura_ajustada_total, 0.0)), 100.0)
    ELSE NULL
  END AS indice_evolucion_bu_ajustada
FROM with_kpis wk
LEFT JOIN total_coverage_ref tcr
  ON tcr.reporting_version_id = wk.reporting_version_id
 AND tcr.period_scope = wk.period_scope;

