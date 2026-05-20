import 'server-only';
import type { BigQuery } from '@google-cloud/bigquery';

const SERVING_PROJECT = process.env.BUSINESS_EXCELLENCE_FF_VIEW_PROJECT ?? 'chiesi-committee';
const SERVING_DATASET = process.env.BUSINESS_EXCELLENCE_FF_DATASET ?? 'chiesi_committee_serving';
const SERVING_SCHEMA = `\`${SERVING_PROJECT}.${SERVING_DATASET}\``;

const RAW_UPLOADS = '`chiesi-committee.chiesi_committee_raw.uploads`';
const MEDICAL_FILE = '`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file`';
const INTERACTIONS = '`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_interactions`';
const TFT = '`chiesi-committee.chiesi_committee_stg.vw_business_excellence_salesforce_tft_effective`';
const STANDARD_DAYS = '`chiesi-committee.chiesi_committee_stg.stg_business_excellence_standard_days`';

type FieldForceRefreshScope = {
  reportingVersionId?: string;
};

const TFT_EFFECTIVE_VIEW_SQL = `
CREATE OR REPLACE VIEW ${TFT} AS
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
  FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_tft\` s
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
FROM calculated
`;

export async function ensureBusinessExcellenceTftEffectiveView(client: BigQuery) {
  await client.query({ query: TFT_EFFECTIVE_VIEW_SQL });
}

function latestUploadCtes() {
  return `
    upload_scope AS (
      SELECT
        upload_id,
        reporting_version_id,
        LOWER(TRIM(module_code)) AS module_code,
        source_as_of_month,
        period_month,
        uploaded_at
      FROM ${RAW_UPLOADS}
      WHERE status IN ('normalized', 'published')
        AND LOWER(TRIM(module_code)) IN (
          'business_excellence_salesforce_fichero_medico',
          'business_excellence_fichero_medico',
          'fichero_medico',
          'business_excellence_salesforce_interacciones',
          'business_excellence_interacciones',
          'interacciones',
          'business_excellence_salesforce_tft',
          'business_excellence_tft',
          'tft',
          'business_excellence_standard_days'
        )
    ),
    latest_medical_upload AS (
      SELECT upload_id, reporting_version_id
      FROM upload_scope
      WHERE module_code IN (
        'business_excellence_salesforce_fichero_medico',
        'business_excellence_fichero_medico',
        'fichero_medico'
      )
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY reporting_version_id
        ORDER BY COALESCE(source_as_of_month, period_month) DESC, uploaded_at DESC
      ) = 1
    ),
    latest_interactions_upload AS (
      SELECT upload_id, reporting_version_id
      FROM upload_scope
      WHERE module_code IN (
        'business_excellence_salesforce_interacciones',
        'business_excellence_interacciones',
        'interacciones'
      )
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY reporting_version_id
        ORDER BY COALESCE(source_as_of_month, period_month) DESC, uploaded_at DESC
      ) = 1
    ),
    latest_tft_upload AS (
      SELECT upload_id, reporting_version_id
      FROM upload_scope
      WHERE module_code IN (
        'business_excellence_salesforce_tft',
        'business_excellence_tft',
        'tft'
      )
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY reporting_version_id
        ORDER BY COALESCE(source_as_of_month, period_month) DESC, uploaded_at DESC
      ) = 1
    ),
    latest_standard_days_upload AS (
      SELECT upload_id, reporting_version_id
      FROM upload_scope
      WHERE module_code = 'business_excellence_standard_days'
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY reporting_version_id
        ORDER BY COALESCE(source_as_of_month, period_month) DESC, uploaded_at DESC
      ) = 1
    )
  `;
}

async function clearServingTable(client: BigQuery, tableName: string, scope: FieldForceRefreshScope) {
  if (scope.reportingVersionId) {
    await client.query({
      query: `
        DELETE FROM ${SERVING_SCHEMA}.${tableName}
        WHERE reporting_version_id = @reportingVersionId
      `,
      params: { reportingVersionId: scope.reportingVersionId },
    });
    return;
  }

  await client.query({ query: `TRUNCATE TABLE ${SERVING_SCHEMA}.${tableName}` });
}

export async function refreshBusinessExcellenceFieldForceServingArtifacts(
  client: BigQuery,
  scope: FieldForceRefreshScope = {},
) {
  await client.query({
    query: `
      CREATE SCHEMA IF NOT EXISTS ${SERVING_SCHEMA}
      OPTIONS(location = 'EU')
    `,
  });

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS ${STANDARD_DAYS} (
        upload_id STRING,
        row_number INT64,
        period_month DATE,
        standard_days NUMERIC,
        source_payload_json JSON,
        normalized_at TIMESTAMP
      )
    `,
  });

  await ensureBusinessExcellenceTftEffectiveView(client);

  await client.query({
    query: `
      CREATE OR REPLACE VIEW ${SERVING_SCHEMA}.vw_business_excellence_ff_t1_medical_universe AS
      WITH ${latestUploadCtes()}
      SELECT
        lu.reporting_version_id,
        m.upload_id,
        m.period_month,
        LOWER(TRIM(m.bu)) AS bu,
        NULLIF(TRIM(m.district), '') AS district,
        NULLIF(TRIM(m.territory), '') AS territory_name,
        UPPER(COALESCE(NULLIF(TRIM(m.territory_normalized), ''), REGEXP_REPLACE(TRIM(COALESCE(m.territory, '')), r'[^a-zA-Z0-9]+', ''))) AS territory_normalized,
        COALESCE(NULLIF(TRIM(m.potencial), ''), 'N/A') AS potencial,
        COALESCE(NULLIF(TRIM(m.specialty_consolidated), ''), 'N/A') AS specialty_consolidated,
        NULLIF(TRIM(m.full_name), '') AS client_name,
        UPPER(REGEXP_REPLACE(TRIM(COALESCE(NULLIF(m.onekey_id, ''), NULLIF(m.ims_id, ''))), r'[^a-zA-Z0-9]+', '')) AS doctor_key,
        UPPER(REGEXP_REPLACE(TRIM(COALESCE(m.onekey_id, '')), r'[^a-zA-Z0-9]+', '')) AS onekey_key,
        UPPER(REGEXP_REPLACE(TRIM(COALESCE(m.ims_id, '')), r'[^a-zA-Z0-9]+', '')) AS ims_key,
        SAFE_CAST(m.objetivo AS NUMERIC) AS objective,
        JSON_VALUE(m.source_payload_json, '$."Account Type"') AS account_type,
        m.normalized_at
      FROM ${MEDICAL_FILE} m
      JOIN latest_medical_upload lu
        ON lu.upload_id = m.upload_id
      WHERE LOWER(TRIM(m.bu)) IN ('air', 'care')
        AND SAFE_CAST(m.objetivo AS NUMERIC) > 0
        AND COALESCE(NULLIF(TRIM(m.onekey_id), ''), NULLIF(TRIM(m.ims_id), '')) IS NOT NULL
    `,
  });

  await client.query({
    query: `
      CREATE OR REPLACE VIEW ${SERVING_SCHEMA}.vw_business_excellence_ff_t2_interactions_matched AS
      WITH ${latestUploadCtes()},
      interactions_base AS (
        SELECT
          lu.reporting_version_id,
          i.upload_id,
          i.interaction_period_month AS period_month,
          UPPER(REGEXP_REPLACE(TRIM(COALESCE(i.onekey_id, '')), r'[^a-zA-Z0-9]+', '')) AS interaction_key,
          UPPER(COALESCE(NULLIF(TRIM(i.territory_normalized), ''), REGEXP_REPLACE(TRIM(COALESCE(i.territory, '')), r'[^a-zA-Z0-9]+', ''))) AS territory_normalized,
          COALESCE(NULLIF(TRIM(i.channel), ''), 'Unknown') AS channel,
          COALESCE(NULLIF(TRIM(i.visit_type), ''), 'Unknown') AS visit_type,
          COALESCE(NULLIF(TRIM(i.interaction_id), ''), CONCAT('row:', CAST(i.row_number AS STRING))) AS interaction_id,
          i.owner_name,
          i.normalized_at
        FROM ${INTERACTIONS} i
        JOIN latest_interactions_upload lu
          ON lu.upload_id = i.upload_id
        WHERE i.onekey_id IS NOT NULL
          AND TRIM(i.onekey_id) != ''
          AND LOWER(TRIM(COALESCE(
            JSON_VALUE(i.source_payload_json, '$.Estado'),
            JSON_VALUE(i.source_payload_json, '$.estado'),
            JSON_VALUE(i.source_payload_json, '$.Status'),
            JSON_VALUE(i.source_payload_json, '$.status'),
            ''
          ))) IN ('enviado', 'sent')
      )
      SELECT
        ib.reporting_version_id,
        ib.upload_id,
        ib.period_month,
        mf.bu,
        mf.district,
        mf.territory_name,
        mf.territory_normalized,
        mf.potencial,
        mf.specialty_consolidated,
        mf.account_type,
        mf.client_name,
        mf.doctor_key,
        ib.channel,
        ib.visit_type,
        ib.interaction_id,
        ib.owner_name,
        ib.normalized_at
      FROM interactions_base ib
      JOIN ${SERVING_SCHEMA}.vw_business_excellence_ff_t1_medical_universe mf
        ON mf.reporting_version_id = ib.reporting_version_id
       AND mf.period_month = ib.period_month
       AND mf.territory_normalized = ib.territory_normalized
       AND ib.interaction_key IN (mf.onekey_key, mf.ims_key)
    `,
  });

  await client.query({
    query: `
      CREATE OR REPLACE VIEW ${SERVING_SCHEMA}.vw_business_excellence_ff_t3_effective_days AS
      WITH ${latestUploadCtes()},
      territory_periods AS (
        SELECT DISTINCT
          reporting_version_id,
          period_month,
          bu,
          territory_normalized
        FROM ${SERVING_SCHEMA}.vw_business_excellence_ff_t1_medical_universe
      ),
      tft_month AS (
        SELECT
          lu.reporting_version_id,
          t.period_month,
          UPPER(COALESCE(NULLIF(TRIM(t.territory_normalized), ''), REGEXP_REPLACE(TRIM(COALESCE(t.territorio, '')), r'[^a-zA-Z0-9]+', ''))) AS territory_normalized,
          SUM(SAFE_CAST(t.days_value AS NUMERIC)) AS days_out
        FROM ${TFT} t
        JOIN latest_tft_upload lu
          ON lu.upload_id = t.upload_id
        GROUP BY 1, 2, 3
      ),
      standard_days_month AS (
        SELECT
          lu.reporting_version_id,
          sd.period_month,
          MAX(SAFE_CAST(sd.standard_days AS NUMERIC)) AS days_standard
        FROM ${STANDARD_DAYS} sd
        JOIN latest_standard_days_upload lu
          ON lu.upload_id = sd.upload_id
        GROUP BY 1, 2
      )
      SELECT
        tp.reporting_version_id,
        tp.period_month,
        tp.bu,
        tp.territory_normalized,
        COALESCE(sd.days_standard, 20) AS days_standard,
        COALESCE(tm.days_out, 0) AS days_out,
        GREATEST(0, COALESCE(sd.days_standard, 20) - COALESCE(tm.days_out, 0)) AS days_adjusted,
        SAFE_DIVIDE(
          GREATEST(0, COALESCE(sd.days_standard, 20) - COALESCE(tm.days_out, 0)),
          NULLIF(COALESCE(sd.days_standard, 20), 0)
        ) AS coverage_effective
      FROM territory_periods tp
      LEFT JOIN tft_month tm
        ON tm.reporting_version_id = tp.reporting_version_id
       AND tm.period_month = tp.period_month
       AND tm.territory_normalized = tp.territory_normalized
      LEFT JOIN standard_days_month sd
        ON sd.reporting_version_id = tp.reporting_version_id
       AND sd.period_month = tp.period_month
    `,
  });

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS ${SERVING_SCHEMA}.business_excellence_ff_hcp_month (
        reporting_version_id STRING,
        period_month DATE,
        bu STRING,
        district STRING,
        territory_name STRING,
        territory_normalized STRING,
        potencial STRING,
        specialty_consolidated STRING,
        account_type STRING,
        client_name STRING,
        doctor_key STRING,
        onekey_key STRING,
        ims_key STRING,
        objective NUMERIC,
        coverage_effective NUMERIC,
        adjusted_objective NUMERIC,
        interactions INT64,
        in_frequency BOOL,
        in_frequency_adjusted BOOL,
        days_standard NUMERIC,
        days_out NUMERIC,
        days_adjusted NUMERIC,
        normalized_at TIMESTAMP
      )
      PARTITION BY period_month
      CLUSTER BY reporting_version_id, bu, territory_normalized, district
    `,
  });

  await clearServingTable(client, 'business_excellence_ff_hcp_month', scope);
  await client.query({
    query: `
      INSERT INTO ${SERVING_SCHEMA}.business_excellence_ff_hcp_month (
        reporting_version_id,
        period_month,
        bu,
        district,
        territory_name,
        territory_normalized,
        potencial,
        specialty_consolidated,
        account_type,
        client_name,
        doctor_key,
        onekey_key,
        ims_key,
        objective,
        coverage_effective,
        adjusted_objective,
        interactions,
        in_frequency,
        in_frequency_adjusted,
        days_standard,
        days_out,
        days_adjusted,
        normalized_at
      )
      WITH doctor_month AS (
        SELECT
          reporting_version_id,
          period_month,
          bu,
          district,
          territory_name,
          territory_normalized,
          potencial,
          specialty_consolidated,
          COALESCE(NULLIF(TRIM(account_type), ''), 'N/A') AS account_type,
          COALESCE(ANY_VALUE(client_name), doctor_key) AS client_name,
          doctor_key,
          ANY_VALUE(onekey_key) AS onekey_key,
          ANY_VALUE(ims_key) AS ims_key,
          MAX(objective) AS objective,
          MAX(normalized_at) AS normalized_at
        FROM ${SERVING_SCHEMA}.vw_business_excellence_ff_t1_medical_universe
        WHERE doctor_key != ''
          ${scope.reportingVersionId ? 'AND reporting_version_id = @reportingVersionId' : ''}
        GROUP BY 1,2,3,4,5,6,7,8,9,11
      ),
      interaction_counts AS (
        SELECT
          reporting_version_id,
          period_month,
          bu,
          territory_normalized,
          COALESCE(NULLIF(TRIM(account_type), ''), 'N/A') AS account_type,
          doctor_key,
          COUNT(DISTINCT interaction_id) AS interactions
        FROM ${SERVING_SCHEMA}.vw_business_excellence_ff_t2_interactions_matched
        WHERE 1 = 1
          ${scope.reportingVersionId ? 'AND reporting_version_id = @reportingVersionId' : ''}
        GROUP BY 1,2,3,4,5,6
      )
      SELECT
        dm.reporting_version_id,
        dm.period_month,
        dm.bu,
        dm.district,
        dm.territory_name,
        dm.territory_normalized,
        dm.potencial,
        dm.specialty_consolidated,
        dm.account_type,
        dm.client_name,
        dm.doctor_key,
        dm.onekey_key,
        dm.ims_key,
        dm.objective,
        COALESCE(ed.coverage_effective, 1) AS coverage_effective,
        dm.objective * COALESCE(ed.coverage_effective, 1) AS adjusted_objective,
        COALESCE(ic.interactions, 0) AS interactions,
        COALESCE(ic.interactions, 0) >= dm.objective AS in_frequency,
        COALESCE(ic.interactions, 0) >= dm.objective * COALESCE(ed.coverage_effective, 1) AS in_frequency_adjusted,
        COALESCE(ed.days_standard, 20) AS days_standard,
        COALESCE(ed.days_out, 0) AS days_out,
        COALESCE(ed.days_adjusted, 20) AS days_adjusted,
        dm.normalized_at
      FROM doctor_month dm
      LEFT JOIN interaction_counts ic
        ON ic.reporting_version_id = dm.reporting_version_id
       AND ic.period_month = dm.period_month
       AND ic.bu = dm.bu
       AND ic.territory_normalized = dm.territory_normalized
       AND ic.account_type = dm.account_type
       AND ic.doctor_key = dm.doctor_key
      LEFT JOIN ${SERVING_SCHEMA}.vw_business_excellence_ff_t3_effective_days ed
        ON ed.reporting_version_id = dm.reporting_version_id
       AND ed.period_month = dm.period_month
       AND ed.bu = dm.bu
       AND ed.territory_normalized = dm.territory_normalized
    `,
    params: scope.reportingVersionId ? { reportingVersionId: scope.reportingVersionId } : undefined,
  });

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS ${SERVING_SCHEMA}.business_excellence_ff_hcp_channel_month (
        reporting_version_id STRING,
        period_month DATE,
        bu STRING,
        district STRING,
        territory_name STRING,
        territory_normalized STRING,
        potencial STRING,
        specialty_consolidated STRING,
        account_type STRING,
        client_name STRING,
        doctor_key STRING,
        channel STRING,
        visit_type STRING,
        interactions INT64
      )
      PARTITION BY period_month
      CLUSTER BY reporting_version_id, bu, channel, visit_type
    `,
  });

  await clearServingTable(client, 'business_excellence_ff_hcp_channel_month', scope);
  await client.query({
    query: `
      INSERT INTO ${SERVING_SCHEMA}.business_excellence_ff_hcp_channel_month (
        reporting_version_id,
        period_month,
        bu,
        district,
        territory_name,
        territory_normalized,
        potencial,
        specialty_consolidated,
        account_type,
        client_name,
        doctor_key,
        channel,
        visit_type,
        interactions
      )
      SELECT
        reporting_version_id,
        period_month,
        bu,
        district,
        territory_name,
        territory_normalized,
        potencial,
        specialty_consolidated,
        account_type,
        client_name,
        doctor_key,
        channel,
        visit_type,
        COUNT(DISTINCT interaction_id) AS interactions
      FROM ${SERVING_SCHEMA}.vw_business_excellence_ff_t2_interactions_matched
      WHERE 1 = 1
        ${scope.reportingVersionId ? 'AND reporting_version_id = @reportingVersionId' : ''}
      GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13
    `,
    params: scope.reportingVersionId ? { reportingVersionId: scope.reportingVersionId } : undefined,
  });
}
