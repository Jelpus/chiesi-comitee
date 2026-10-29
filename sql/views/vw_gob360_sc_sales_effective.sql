CREATE OR REPLACE VIEW `chiesi-committee.gob360_snapshots.vw_sc_sales_effective` AS
WITH active AS (
  SELECT snapshot_id, validated_through_month
  FROM `chiesi-committee.gob360_snapshots.manifest`
  WHERE module_code = 'business_excellence_gob360_care' AND status = 'active'
  QUALIFY ROW_NUMBER() OVER (ORDER BY published_at DESC, created_at DESC) = 1
), controls AS (
  SELECT p.clave, p.clave_normalized, p.clue, p.clue_normalized,
    p.period_month, p.pieces
  FROM `chiesi-committee.gob360_snapshots.pieces` p
  JOIN active a ON a.snapshot_id = p.snapshot_id
  WHERE p.period_month <= a.validated_through_month
), base AS (
  SELECT s.*,
    LOWER(REGEXP_REPLACE(TRIM(CAST(s.CLAVE AS STRING)), r'[^a-zA-Z0-9]+', '')) AS clave_key,
    UPPER(TRIM(CAST(s.CLUE AS STRING))) AS clue_key,
    DATE_TRUNC(s.FECHA, MONTH) AS period_month,
    SUM(COALESCE(s.PIEZAS, 0)) OVER (
      PARTITION BY LOWER(REGEXP_REPLACE(TRIM(CAST(s.CLAVE AS STRING)), r'[^a-zA-Z0-9]+', '')),
        UPPER(TRIM(CAST(s.CLUE AS STRING))), DATE_TRUNC(s.FECHA, MONTH)
    ) AS base_total,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(REGEXP_REPLACE(TRIM(CAST(s.CLAVE AS STRING)), r'[^a-zA-Z0-9]+', '')),
        UPPER(TRIM(CAST(s.CLUE AS STRING))), DATE_TRUNC(s.FECHA, MONTH)
      ORDER BY s.RUTA, s.DB
    ) AS row_rank
  FROM `chiesi-committee.gob360_mirror.sc_sales_source` s
), effective_base AS (
  SELECT b.DB, b.CLUE, b.CLAVE, b.FECHA, b.RUTA, b.REFERENCIA,
    b.PRIORIDAD,
    CASE
      WHEN c.clave_normalized IS NULL THEN b.PIEZAS
      WHEN b.base_total != 0 THEN b.PIEZAS * CAST(c.pieces AS FLOAT64) / b.base_total
      ELSE b.PIEZAS
    END AS PIEZAS,
    b.CUOTA, b.PRECIO, b.FECHA_MOVIL
  FROM base b
  LEFT JOIN controls c
    ON c.clave_normalized = b.clave_key
    AND c.clue_normalized = b.clue_key
    AND c.period_month = b.period_month
), file_only AS (
  SELECT CAST(NULL AS STRING) AS DB, c.clue AS CLUE, c.clave AS CLAVE,
    c.period_month AS FECHA, CAST(NULL AS STRING) AS RUTA,
    CAST(NULL AS STRING) AS REFERENCIA, CAST(NULL AS STRING) AS PRIORIDAD,
    CAST(c.pieces AS FLOAT64) AS PIEZAS, CAST(NULL AS FLOAT64) AS CUOTA,
    CAST(NULL AS FLOAT64) AS PRECIO, c.period_month AS FECHA_MOVIL
  FROM controls c
  LEFT JOIN base b
    ON b.clave_key = c.clave_normalized
    AND b.clue_key = c.clue_normalized
    AND b.period_month = c.period_month
    AND b.row_rank = 1
  WHERE b.clave_key IS NULL OR b.base_total = 0
)
SELECT * FROM effective_base
UNION ALL
SELECT * FROM file_only;
