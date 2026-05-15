CREATE SCHEMA IF NOT EXISTS `chiesi-committee.performance`
OPTIONS(location = 'EU');

CREATE TABLE IF NOT EXISTS `chiesi-committee.performance.recompra_lexicomp` (
  upload_id STRING,
  reporting_version_id STRING,
  upload_period_month DATE,
  source_as_of_month DATE,
  row_number INT64,
  period_month DATE,
  fecha DATE,
  distribuidor STRING,
  anio INT64,
  mes STRING,
  ciudad_entrega STRING,
  estado_entrega STRING,
  cliente STRING,
  agrupador STRING,
  corporativo STRING,
  units NUMERIC,
  medico STRING,
  ruta STRING,
  ejecutivo STRING,
  gerente STRING,
  source_payload_json JSON,
  normalized_at TIMESTAMP
)
PARTITION BY period_month
CLUSTER BY reporting_version_id, cliente, ejecutivo;
