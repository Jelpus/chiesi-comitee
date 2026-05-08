import 'server-only';
import type { BigQuery } from '@google-cloud/bigquery';

const SERVING_PROJECT = process.env.BUSINESS_EXCELLENCE_FF_VIEW_PROJECT ?? 'chiesi-committee';
const SERVING_DATASET = process.env.BUSINESS_EXCELLENCE_FF_DATASET ?? 'chiesi_committee_serving';
const SERVING_SCHEMA = `\`${SERVING_PROJECT}.${SERVING_DATASET}\``;

const RAW_UPLOADS = '`chiesi-committee.chiesi_committee_raw.uploads`';
const MEDICAL_FILE = '`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file`';
const INTERACTIONS = '`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_interactions`';
const TFT = '`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_tft`';

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
          'tft'
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
    )
  `;
}

export async function refreshBusinessExcellenceFieldForceServingArtifacts(client: BigQuery) {
  await client.query({
    query: `
      CREATE SCHEMA IF NOT EXISTS ${SERVING_SCHEMA}
      OPTIONS(location = 'EU')
    `,
  });

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
        AND JSON_VALUE(m.source_payload_json, '$."Account Type"') IN (
          'MP (Medical Professional)_BR',
          'MP (Medical Professional) MX',
          'Private Practice MX'
        )
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
      )
      SELECT
        tp.reporting_version_id,
        tp.period_month,
        tp.bu,
        tp.territory_normalized,
        CAST(20 AS NUMERIC) AS days_standard,
        COALESCE(tm.days_out, 0) AS days_out,
        GREATEST(0, CAST(20 AS NUMERIC) - COALESCE(tm.days_out, 0)) AS days_adjusted,
        SAFE_DIVIDE(GREATEST(0, CAST(20 AS NUMERIC) - COALESCE(tm.days_out, 0)), 20) AS coverage_effective
      FROM territory_periods tp
      LEFT JOIN tft_month tm
        ON tm.reporting_version_id = tp.reporting_version_id
       AND tm.period_month = tp.period_month
       AND tm.territory_normalized = tp.territory_normalized
    `,
  });

  await client.query({
    query: `
      CREATE OR REPLACE TABLE ${SERVING_SCHEMA}.business_excellence_ff_hcp_month
      PARTITION BY period_month
      CLUSTER BY reporting_version_id, bu, territory_normalized, district
      AS
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
          COALESCE(ANY_VALUE(client_name), doctor_key) AS client_name,
          doctor_key,
          ANY_VALUE(onekey_key) AS onekey_key,
          ANY_VALUE(ims_key) AS ims_key,
          MAX(objective) AS objective,
          MAX(normalized_at) AS normalized_at
        FROM ${SERVING_SCHEMA}.vw_business_excellence_ff_t1_medical_universe
        WHERE doctor_key != ''
        GROUP BY 1,2,3,4,5,6,7,8,10
      ),
      interaction_counts AS (
        SELECT
          reporting_version_id,
          period_month,
          bu,
          territory_normalized,
          doctor_key,
          COUNT(DISTINCT interaction_id) AS interactions
        FROM ${SERVING_SCHEMA}.vw_business_excellence_ff_t2_interactions_matched
        GROUP BY 1,2,3,4,5
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
       AND ic.doctor_key = dm.doctor_key
      LEFT JOIN ${SERVING_SCHEMA}.vw_business_excellence_ff_t3_effective_days ed
        ON ed.reporting_version_id = dm.reporting_version_id
       AND ed.period_month = dm.period_month
       AND ed.bu = dm.bu
       AND ed.territory_normalized = dm.territory_normalized
    `,
  });

  await client.query({
    query: `
      CREATE OR REPLACE TABLE ${SERVING_SCHEMA}.business_excellence_ff_hcp_channel_month
      PARTITION BY period_month
      CLUSTER BY reporting_version_id, bu, channel, visit_type
      AS
      SELECT
        reporting_version_id,
        period_month,
        bu,
        district,
        territory_name,
        territory_normalized,
        potencial,
        specialty_consolidated,
        client_name,
        doctor_key,
        channel,
        visit_type,
        COUNT(DISTINCT interaction_id) AS interactions
      FROM ${SERVING_SCHEMA}.vw_business_excellence_ff_t2_interactions_matched
      GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12
    `,
  });
}
