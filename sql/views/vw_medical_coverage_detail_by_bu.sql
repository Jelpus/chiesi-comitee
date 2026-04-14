CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_mart.vw_medical_coverage_detail_by_bu` AS
-- Operational detail layer for Field Force UI
-- Returns both Territory and District granularities, with BU and Total rollups.
WITH base AS (
  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    bu,
    district,
    territory_name,
    territory_normalized,
    doctor_id,
    objetivo AS objetivo_base,
    objetivo_ajustado,
    interacciones
  FROM `chiesi-committee.chiesi_committee_mart.vw_medical_coverage_doctor_detail`
  WHERE LOWER(bu) IN ('air', 'care')
),
territory_bu AS (
  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    'territory' AS view_mode,
    LOWER(bu) AS bu,
    territory_name AS dimension_label,
    COUNT(DISTINCT CONCAT(territory_normalized, '|', doctor_id)) AS clients,
    SUM(objetivo_base) AS objetivo_base,
    SUM(objetivo_ajustado) AS objetivo_ajustado,
    SUM(interacciones) AS interacciones
  FROM base
  GROUP BY 1,2,3,4,5,6
),
district_bu AS (
  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    'district' AS view_mode,
    LOWER(bu) AS bu,
    COALESCE(district, 'N/A') AS dimension_label,
    COUNT(DISTINCT CONCAT(territory_normalized, '|', doctor_id)) AS clients,
    SUM(objetivo_base) AS objetivo_base,
    SUM(objetivo_ajustado) AS objetivo_ajustado,
    SUM(interacciones) AS interacciones
  FROM base
  GROUP BY 1,2,3,4,5,6
),
territory_total AS (
  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    'territory' AS view_mode,
    'total' AS bu,
    territory_name AS dimension_label,
    COUNT(DISTINCT CONCAT(territory_normalized, '|', doctor_id)) AS clients,
    SUM(objetivo_base) AS objetivo_base,
    SUM(objetivo_ajustado) AS objetivo_ajustado,
    SUM(interacciones) AS interacciones
  FROM base
  GROUP BY 1,2,3,4,5,6
),
district_total AS (
  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    'district' AS view_mode,
    'total' AS bu,
    COALESCE(district, 'N/A') AS dimension_label,
    COUNT(DISTINCT CONCAT(territory_normalized, '|', doctor_id)) AS clients,
    SUM(objetivo_base) AS objetivo_base,
    SUM(objetivo_ajustado) AS objetivo_ajustado,
    SUM(interacciones) AS interacciones
  FROM base
  GROUP BY 1,2,3,4,5,6
),
all_rows AS (
  SELECT * FROM territory_bu
  UNION ALL SELECT * FROM district_bu
  UNION ALL SELECT * FROM territory_total
  UNION ALL SELECT * FROM district_total
)
SELECT
  reporting_version_id,
  report_period_month,
  period_scope,
  view_mode,
  bu,
  dimension_label,
  clients,
  objetivo_base,
  objetivo_ajustado,
  interacciones,
  SAFE_DIVIDE(interacciones, NULLIF(objetivo_base, 0)) AS cobertura_base,
  SAFE_DIVIDE(interacciones, NULLIF(objetivo_ajustado, 0)) AS cobertura_ajustada
FROM all_rows;

