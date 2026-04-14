CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_mart.vw_medical_coverage_doctor_analysis` AS
-- Doctor analysis layer for Field Force UI
-- Includes BU-specific rows and duplicated TOTAL scope rows.
WITH base AS (
  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    LOWER(bu) AS bu,
    district,
    territory_name,
    territory_normalized,
    potencial,
    client_name,
    doctor_id,
    objetivo AS objetivo_base,
    objetivo_ajustado,
    interacciones,
    status_visita
  FROM `chiesi-committee.chiesi_committee_mart.vw_medical_coverage_doctor_detail`
  WHERE LOWER(bu) IN ('air', 'care')
),
total_rows AS (
  SELECT
    reporting_version_id,
    report_period_month,
    period_scope,
    'total' AS bu,
    district,
    territory_name,
    territory_normalized,
    potencial,
    client_name,
    doctor_id,
    objetivo_base,
    objetivo_ajustado,
    interacciones,
    status_visita
  FROM base
)
SELECT
  reporting_version_id,
  report_period_month,
  period_scope,
  bu,
  district,
  territory_name,
  territory_normalized,
  potencial,
  client_name,
  doctor_id,
  objetivo_base,
  objetivo_ajustado,
  interacciones,
  SAFE_DIVIDE(interacciones, NULLIF(objetivo_base, 0)) AS cobertura_base,
  SAFE_DIVIDE(interacciones, NULLIF(objetivo_ajustado, 0)) AS cobertura_ajustada,
  status_visita
FROM (
  SELECT * FROM base
  UNION ALL
  SELECT * FROM total_rows
);
