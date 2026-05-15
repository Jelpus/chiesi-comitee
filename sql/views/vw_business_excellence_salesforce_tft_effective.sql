CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_business_excellence_salesforce_tft_effective` AS
WITH parsed AS (
  SELECT
    s.*,
    COALESCE(
      SAFE.PARSE_DATETIME('%d/%m/%Y, %H:%M', NULLIF(TRIM(s.start_date_raw), '')),
      SAFE.PARSE_DATETIME('%d/%m/%Y %H:%M', NULLIF(TRIM(s.start_date_raw), '')),
      SAFE.PARSE_DATETIME('%d/%m/%Y', NULLIF(TRIM(s.start_date_raw), '')),
      SAFE.PARSE_DATETIME('%Y-%m-%d %H:%M:%S', NULLIF(TRIM(s.start_date_raw), '')),
      SAFE.PARSE_DATETIME('%Y-%m-%dT%H:%M:%S', NULLIF(TRIM(s.start_date_raw), ''))
    ) AS start_dt,
    COALESCE(
      SAFE.PARSE_DATETIME('%d/%m/%Y, %H:%M', NULLIF(TRIM(s.end_date_raw), '')),
      SAFE.PARSE_DATETIME('%d/%m/%Y %H:%M', NULLIF(TRIM(s.end_date_raw), '')),
      SAFE.PARSE_DATETIME('%d/%m/%Y', NULLIF(TRIM(s.end_date_raw), '')),
      SAFE.PARSE_DATETIME('%Y-%m-%d %H:%M:%S', NULLIF(TRIM(s.end_date_raw), '')),
      SAFE.PARSE_DATETIME('%Y-%m-%dT%H:%M:%S', NULLIF(TRIM(s.end_date_raw), ''))
    ) AS end_dt
  FROM `chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_tft` s
),
base AS (
  SELECT
    *,
    DATE_TRUNC(DATE(start_dt), MONTH) AS start_month,
    DATE_TRUNC(DATE(end_dt), MONTH) AS end_month
  FROM parsed
  WHERE start_dt IS NOT NULL
    AND end_dt IS NOT NULL
    AND end_dt >= start_dt
),
expanded AS (
  SELECT
    b.*,
    month_start AS effective_period_month,
    GREATEST(b.start_dt, DATETIME(month_start)) AS effective_start_dt,
    LEAST(b.end_dt, DATETIME(DATE_ADD(month_start, INTERVAL 1 MONTH))) AS effective_end_dt
  FROM base b,
  UNNEST(GENERATE_DATE_ARRAY(b.start_month, b.end_month, INTERVAL 1 MONTH)) AS month_start
),
calculated AS (
  SELECT
    *,
    CASE
      WHEN effective_start_dt IS NULL OR effective_end_dt IS NULL OR effective_end_dt < effective_start_dt THEN NULL
      WHEN TIME(effective_start_dt) = TIME '00:00:00' AND TIME(effective_end_dt) = TIME '00:00:00'
        THEN CAST(GREATEST(DATE_DIFF(DATE(effective_end_dt), DATE(effective_start_dt), DAY), 1) AS NUMERIC)
      ELSE TRUNC(CAST(GREATEST(DATETIME_DIFF(effective_end_dt, effective_start_dt, MINUTE), 0) AS NUMERIC) / 480, 2)
    END AS effective_days_value
  FROM expanded
)
SELECT
  * EXCEPT(
    start_dt,
    end_dt,
    start_month,
    end_month,
    effective_period_month,
    effective_start_dt,
    effective_end_dt,
    effective_days_value
  ) REPLACE (
    effective_period_month AS period_month,
    CAST(
      COALESCE(
        effective_days_value,
        SAFE_CAST(days_value AS NUMERIC)
      ) AS NUMERIC
    ) AS days_value
  ),
  effective_start_dt,
  effective_end_dt,
  DATE(effective_start_dt) AS effective_start_date,
  DATE(effective_end_dt) AS effective_end_date
FROM calculated;
