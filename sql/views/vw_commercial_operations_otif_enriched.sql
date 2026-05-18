CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_commercial_operations_otif_enriched` AS
WITH base AS (
  SELECT
    s.upload_id,
    s.row_number,
    u.reporting_version_id,
    rv.period_month AS report_period_month,
    u.source_as_of_month,
    u.uploaded_at AS source_uploaded_at,
    s.no_value,
    s.mes_raw,
    s.tipo_raw,
    s.orden,
    s.referencia_cliente,
    s.order_date,
    s.delivery,
    s.solicitante,
    s.description,
    s.goods_consignee,
    s.customer_description,
    s.ship_to_city,
    s.region,
    s.facturas_nc,
    s.canal,
    s.channel_group,
    s.status,
    s.false_otif_reason,
    s.observacion,
    s.returned_pieces,
    s.on_time_delivery,
    s.delivered_pieces,
    s.otif,
    s.period_month,
    s.source_payload_json,
    s.normalized_at
  FROM `chiesi-committee.chiesi_committee_stg.stg_commercial_operations_incidencias` s
  JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
    ON u.upload_id = s.upload_id
  LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
    ON rv.reporting_version_id = u.reporting_version_id
  WHERE LOWER(TRIM(u.module_code)) IN ('commercial_operations_incidencias', 'commercial_operations_otif', 'otif')
    AND LOWER(TRIM(u.status)) IN ('normalized', 'published')
),
max_ref AS (
  SELECT
    reporting_version_id,
    MAX(period_month) AS max_period_month,
    MAX(source_as_of_month) AS max_source_as_of_month,
    MAX(report_period_month) AS max_report_period_month,
    COALESCE(
      GREATEST(MAX(source_as_of_month), MAX(report_period_month)),
      MAX(source_as_of_month),
      MAX(report_period_month),
      MAX(period_month)
    ) AS reference_cutoff_month
  FROM base
  GROUP BY reporting_version_id
),
effective_ref AS (
  SELECT
    b.reporting_version_id,
    COALESCE(
      MAX(IF(b.period_month <= m.reference_cutoff_month, b.period_month, NULL)),
      MAX(b.period_month)
    ) AS max_effective_period_month
  FROM base b
  JOIN max_ref m
    ON m.reporting_version_id = b.reporting_version_id
  GROUP BY b.reporting_version_id
)
SELECT
  b.*,
  e.max_effective_period_month AS latest_period_month,
  DATE_SUB(e.max_effective_period_month, INTERVAL 1 YEAR) AS latest_period_month_py,
  CASE
    WHEN EXTRACT(YEAR FROM b.period_month) = EXTRACT(YEAR FROM e.max_effective_period_month)
      AND EXTRACT(MONTH FROM b.period_month) <= EXTRACT(MONTH FROM e.max_effective_period_month)
    THEN TRUE ELSE FALSE
  END AS is_ytd,
  CASE
    WHEN b.period_month = e.max_effective_period_month
    THEN TRUE ELSE FALSE
  END AS is_mth
FROM base b
JOIN effective_ref e
  ON e.reporting_version_id = b.reporting_version_id;
