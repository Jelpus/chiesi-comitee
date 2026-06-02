import 'server-only';
import type { BigQuery } from '@google-cloud/bigquery';

const SERVING_PROJECT = process.env.AIR_SERVING_PROJECT ?? 'chiesi-committee';
const SERVING_DATASET = process.env.AIR_SERVING_DATASET ?? 'chiesi_committee_serving';
const SERVING_SCHEMA = `\`${SERVING_PROJECT}.${SERVING_DATASET}\``;

const REPORTING_VERSIONS = '`chiesi-committee.chiesi_committee_admin.reporting_versions`';
const RAW_UPLOADS = '`chiesi-committee.chiesi_committee_raw.uploads`';
const AIR_DOCTOR_NAME_MATCHES = '`chiesi-committee.chiesi_committee_admin.air_doctor_name_matches`';
const MEDICAL_FILE = '`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file`';
const CLOSEUP_VIEW = '`chiesi-committee.chiesi_committee_stg.vw_business_excellence_closeup_enriched`';
const GOB360_PRODUCT_MAPPING = '`chiesi-committee.chiesi_committee_admin.gob360_product_mapping`';

const GOB360_PROJECT = process.env.GOB360_PROJECT_ID || process.env.GCP_PROJECT_ID || 'chiesi-committee';
const GOB360_DATASET = process.env.GOB360_DATASET_ID || 'CHIESI_EXTERNAL';
const GOB360_PC_SALES_TABLE = process.env.GOB360_PC_TABLE || 'CHIESI_PC_VENTAS_EXTERNAL';
const GOB360_PC_STRUCTURE_TABLE = process.env.GOB360_SALESFORCE_PC_TABLE || 'CHIESI_ESTRUCTURA_PC';
const GOB360_PC_SALES = `\`${GOB360_PROJECT}.${GOB360_DATASET}.${GOB360_PC_SALES_TABLE}\``;
const GOB360_PC_STRUCTURE = `\`${GOB360_PROJECT}.${GOB360_DATASET}.${GOB360_PC_STRUCTURE_TABLE}\``;

type AirRefreshScope = {
  reportingVersionId?: string;
};

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
          'fichero_medico'
        )
    ),
    latest_medical_upload AS (
      SELECT upload_id, reporting_version_id
      FROM upload_scope
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY reporting_version_id
        ORDER BY COALESCE(source_as_of_month, period_month) DESC, uploaded_at DESC
      ) = 1
    )
  `;
}

async function ensureAirServingTables(client: BigQuery) {
  await client.query({
    query: `
      CREATE SCHEMA IF NOT EXISTS ${SERVING_SCHEMA}
      OPTIONS(location = 'EU')
    `,
  });

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS ${SERVING_SCHEMA}.air_medical_file_rows (
        reporting_version_id STRING,
        upload_id STRING,
        period_month DATE,
        ims_id STRING,
        full_name STRING,
        territory STRING,
        district STRING,
        objetivo FLOAT64,
        bu STRING,
        account_type STRING,
        normalized_at TIMESTAMP
      )
      PARTITION BY period_month
      CLUSTER BY reporting_version_id, territory, district
    `,
  });

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS ${SERVING_SCHEMA}.air_closeup_doctor_mat (
        reporting_version_id STRING,
        period_month DATE,
        hcp_name STRING,
        market_group STRING,
        visited BOOL,
        market_rx_mat FLOAT64,
        chiesi_rx_mat FLOAT64
      )
      PARTITION BY period_month
      CLUSTER BY reporting_version_id, market_group
    `,
  });

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS ${SERVING_SCHEMA}.air_public_clue_mat (
        reporting_version_id STRING,
        period_month DATE,
        clue STRING,
        unit_name STRING,
        territory STRING,
        district STRING,
        state STRING,
        institution STRING,
        reference STRING,
        visited BOOL,
        market_group STRING,
        public_demand_mat FLOAT64,
        chiesi_public_demand_mat FLOAT64
      )
      PARTITION BY period_month
      CLUSTER BY reporting_version_id, market_group, territory
    `,
  });

  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS ${AIR_DOCTOR_NAME_MATCHES} (
        reporting_version_id STRING,
        period_month DATE,
        medical_file_ims_id STRING,
        medical_file_full_name STRING,
        closeup_hcp_name STRING,
        match_score FLOAT64,
        match_method STRING,
        match_confidence STRING,
        matched_tokens ARRAY<STRING>,
        unmatched_tokens ARRAY<STRING>,
        generated_at TIMESTAMP
      )
    `,
  });
}

async function clearTable(client: BigQuery, tableName: string, scope: AirRefreshScope) {
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

  await client.query({
    query: `TRUNCATE TABLE ${SERVING_SCHEMA}.${tableName}`,
  });
}

export async function refreshAirServingArtifacts(client: BigQuery, scope: AirRefreshScope = {}) {
  await ensureAirServingTables(client);

  await clearTable(client, 'air_medical_file_rows', scope);
  await client.query({
    query: `
      INSERT INTO ${SERVING_SCHEMA}.air_medical_file_rows (
        reporting_version_id,
        upload_id,
        period_month,
        ims_id,
        full_name,
        territory,
        district,
        objetivo,
        bu,
        account_type,
        normalized_at
      )
      WITH ${latestUploadCtes()}
      SELECT
        lu.reporting_version_id,
        m.upload_id,
        m.period_month,
        NULLIF(TRIM(m.ims_id), '') AS ims_id,
        NULLIF(TRIM(m.full_name), '') AS full_name,
        NULLIF(TRIM(m.territory), '') AS territory,
        NULLIF(TRIM(m.district), '') AS district,
        COALESCE(SAFE_CAST(m.objetivo AS FLOAT64), 0) AS objetivo,
        NULLIF(TRIM(m.bu), '') AS bu,
        NULLIF(TRIM(JSON_VALUE(m.source_payload_json, '$."Account Type"')), '') AS account_type,
        m.normalized_at
      FROM ${MEDICAL_FILE} m
      JOIN latest_medical_upload lu
        ON lu.upload_id = m.upload_id
      WHERE UPPER(TRIM(m.bu)) = 'AIR'
        ${scope.reportingVersionId ? 'AND lu.reporting_version_id = @reportingVersionId' : ''}
        AND (
          JSON_VALUE(m.source_payload_json, '$."Account Type"') IN (
            'MP (Medical Professional)',
            'MP (Medical Professional) MX'
          )
          OR STARTS_WITH(JSON_VALUE(m.source_payload_json, '$."Account Type"'), 'MP (Medical Professional)')
        )
    `,
    params: scope.reportingVersionId ? { reportingVersionId: scope.reportingVersionId } : undefined,
  });

  await clearTable(client, 'air_closeup_doctor_mat', scope);
  await client.query({
    query: `
      INSERT INTO ${SERVING_SCHEMA}.air_closeup_doctor_mat (
        reporting_version_id,
        period_month,
        hcp_name,
        market_group,
        visited,
        market_rx_mat,
        chiesi_rx_mat
      )
      WITH reporting_versions AS (
        SELECT
          reporting_version_id,
          period_month
        FROM ${REPORTING_VERSIONS}
        WHERE status IN ('closed', 'ready_to_show')
          ${scope.reportingVersionId ? 'AND reporting_version_id = @reportingVersionId' : ''}
      )
      SELECT
        rv.reporting_version_id,
        rv.period_month,
        c.hcp_name,
        COALESCE(NULLIF(TRIM(c.market_group), ''), 'Unmapped market') AS market_group,
        LOGICAL_OR(COALESCE(c.visited, FALSE)) AS visited,
        SUM(COALESCE(SAFE_CAST(c.recetas_value AS FLOAT64), 0)) AS market_rx_mat,
        SUM(
          CASE
            WHEN COALESCE(UPPER(c.business_unit_code), UPPER(c.business_unit_name), '') = 'AIR'
              OR c.resolved_product_id IS NOT NULL
            THEN COALESCE(SAFE_CAST(c.recetas_value AS FLOAT64), 0)
            ELSE 0
          END
        ) AS chiesi_rx_mat
      FROM reporting_versions rv
      JOIN ${CLOSEUP_VIEW} c
        ON c.period_month BETWEEN DATE_SUB(rv.period_month, INTERVAL 11 MONTH) AND rv.period_month
       AND NULLIF(TRIM(c.hcp_name), '') IS NOT NULL
      GROUP BY rv.reporting_version_id, rv.period_month, c.hcp_name, market_group
    `,
    params: scope.reportingVersionId ? { reportingVersionId: scope.reportingVersionId } : undefined,
  });

  await client.query({
    query: `
      DELETE FROM ${AIR_DOCTOR_NAME_MATCHES}
      ${scope.reportingVersionId ? 'WHERE reporting_version_id = @reportingVersionId' : 'WHERE TRUE'}
    `,
    params: scope.reportingVersionId ? { reportingVersionId: scope.reportingVersionId } : undefined,
  });
  await client.query({
    query: `
      INSERT INTO ${AIR_DOCTOR_NAME_MATCHES} (
        reporting_version_id,
        period_month,
        medical_file_ims_id,
        medical_file_full_name,
        closeup_hcp_name,
        match_score,
        match_method,
        match_confidence,
        matched_tokens,
        unmatched_tokens,
        generated_at
      )
      WITH medical_rows AS (
        SELECT
          reporting_version_id,
          period_month,
          COALESCE(
            NULLIF(TRIM(ims_id), ''),
            CONCAT(
              'name:',
              TRIM(REGEXP_REPLACE(
                REGEXP_REPLACE(NORMALIZE_AND_CASEFOLD(full_name, NFD), r'\\pM', ''),
                r'[^a-z0-9]+',
                ' '
              ))
            )
          ) AS medical_file_ims_id,
          NULLIF(TRIM(full_name), '') AS medical_file_full_name
        FROM ${SERVING_SCHEMA}.air_medical_file_rows
        WHERE NULLIF(TRIM(full_name), '') IS NOT NULL
          ${scope.reportingVersionId ? 'AND reporting_version_id = @reportingVersionId' : ''}
      ),
      medical_base AS (
        SELECT
          reporting_version_id,
          ANY_VALUE(period_month) AS period_month,
          medical_file_ims_id,
          ANY_VALUE(medical_file_full_name) AS medical_file_full_name
        FROM medical_rows
        GROUP BY reporting_version_id, medical_file_ims_id
      ),
      medical_tokens AS (
        SELECT
          *,
          ARRAY(
            SELECT DISTINCT token
            FROM UNNEST(SPLIT(TRIM(REGEXP_REPLACE(
              REGEXP_REPLACE(NORMALIZE_AND_CASEFOLD(medical_file_full_name, NFD), r'\\pM', ''),
              r'[^a-z0-9]+',
              ' '
            )), ' ')) AS token
            WHERE LENGTH(token) > 1
              AND token NOT IN ('de', 'del', 'la', 'las', 'los', 'y')
          ) AS tokens
        FROM medical_base
      ),
      closeup_tokens AS (
        SELECT
          reporting_version_id,
          period_month,
          hcp_name,
          ARRAY(
            SELECT DISTINCT token
            FROM UNNEST(SPLIT(TRIM(REGEXP_REPLACE(
              REGEXP_REPLACE(NORMALIZE_AND_CASEFOLD(hcp_name, NFD), r'\\pM', ''),
              r'[^a-z0-9]+',
              ' '
            )), ' ')) AS token
            WHERE LENGTH(token) > 1
              AND token NOT IN ('de', 'del', 'la', 'las', 'los', 'y')
          ) AS tokens
        FROM ${SERVING_SCHEMA}.air_closeup_doctor_mat
        WHERE NULLIF(TRIM(hcp_name), '') IS NOT NULL
          ${scope.reportingVersionId ? 'AND reporting_version_id = @reportingVersionId' : ''}
      ),
      medical_token_rows AS (
        SELECT
          reporting_version_id,
          period_month,
          medical_file_ims_id,
          medical_file_full_name,
          tokens,
          token
        FROM medical_tokens, UNNEST(tokens) AS token
      ),
      closeup_token_rows AS (
        SELECT
          reporting_version_id,
          period_month,
          hcp_name,
          tokens,
          token
        FROM closeup_tokens, UNNEST(tokens) AS token
      ),
      scored AS (
        SELECT
          m.reporting_version_id,
          ANY_VALUE(m.period_month) AS period_month,
          m.medical_file_ims_id,
          ANY_VALUE(m.medical_file_full_name) AS medical_file_full_name,
          c.hcp_name AS closeup_hcp_name,
          ARRAY_AGG(DISTINCT m.token ORDER BY m.token) AS matched_tokens,
          ARRAY_LENGTH(ANY_VALUE(m.tokens)) AS medical_token_count,
          ARRAY_LENGTH(ANY_VALUE(c.tokens)) AS closeup_token_count,
          COUNT(DISTINCT m.token) AS common_token_count,
          SAFE_DIVIDE(
            2 * COUNT(DISTINCT m.token),
            ARRAY_LENGTH(ANY_VALUE(m.tokens)) + ARRAY_LENGTH(ANY_VALUE(c.tokens))
          ) AS match_score
        FROM medical_token_rows m
        JOIN closeup_token_rows c
          ON c.reporting_version_id = m.reporting_version_id
         AND c.token = m.token
        GROUP BY
          m.reporting_version_id,
          m.medical_file_ims_id,
          c.hcp_name
        HAVING common_token_count >= 2
      ),
      best_match AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY reporting_version_id, medical_file_ims_id
            ORDER BY match_score DESC, common_token_count DESC, closeup_token_count ASC, closeup_hcp_name
          ) AS rn
        FROM scored
        WHERE match_score >= 0.8
      )
      SELECT
        m.reporting_version_id,
        m.period_month,
        m.medical_file_ims_id,
        m.medical_file_full_name,
        b.closeup_hcp_name,
        COALESCE(ROUND(b.match_score, 3), 0) AS match_score,
        'bigquery_token_overlap' AS match_method,
        CASE
          WHEN b.match_score >= 0.92 THEN 'high'
          WHEN b.match_score >= 0.82 THEN 'medium'
          WHEN b.match_score >= 0.8 THEN 'low'
          ELSE 'unmatched'
        END AS match_confidence,
        COALESCE(b.matched_tokens, []) AS matched_tokens,
        ARRAY(
          SELECT token
          FROM UNNEST(m.tokens) AS token
          WHERE b.matched_tokens IS NULL OR token NOT IN UNNEST(b.matched_tokens)
          ORDER BY token
        ) AS unmatched_tokens,
        CURRENT_TIMESTAMP() AS generated_at
      FROM medical_tokens m
      LEFT JOIN best_match b
        ON b.reporting_version_id = m.reporting_version_id
       AND b.medical_file_ims_id = m.medical_file_ims_id
       AND b.rn = 1
    `,
    params: scope.reportingVersionId ? { reportingVersionId: scope.reportingVersionId } : undefined,
  });

  try {
    await clearTable(client, 'air_public_clue_mat', scope);
    await client.query({
      query: `
      INSERT INTO ${SERVING_SCHEMA}.air_public_clue_mat (
        reporting_version_id,
        period_month,
        clue,
        unit_name,
        territory,
        district,
        state,
        institution,
        reference,
        visited,
        market_group,
        public_demand_mat,
        chiesi_public_demand_mat
      )
      WITH reporting_versions AS (
        SELECT
          reporting_version_id,
          period_month
        FROM ${REPORTING_VERSIONS}
        WHERE status IN ('closed', 'ready_to_show')
          ${scope.reportingVersionId ? 'AND reporting_version_id = @reportingVersionId' : ''}
      ),
      mappings AS (
        SELECT
          LOWER(source_clave_normalized) AS source_clave_normalized,
          NULLIF(TRIM(product_id), '') AS product_id,
          COALESCE(NULLIF(TRIM(market_group), ''), 'Unmapped market') AS market_group
        FROM (
          SELECT
            m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.source_clave_normalized
              ORDER BY m.updated_at DESC, m.created_at DESC
            ) AS rn
          FROM ${GOB360_PRODUCT_MAPPING} m
          WHERE m.is_active = TRUE
            AND m.source_clave_normalized IS NOT NULL
            AND TRIM(m.source_clave_normalized) != ''
        )
        WHERE rn = 1
      ),
      structure AS (
        SELECT
          NULLIF(TRIM(CAST(CLUE AS STRING)), '') AS clue,
          ANY_VALUE(NULLIF(TRIM(CAST(UNIDAD_O_ALMACEN AS STRING)), '')) AS unit_name,
          ANY_VALUE(NULLIF(TRIM(CAST(RUTA AS STRING)), '')) AS territory,
          ANY_VALUE(NULLIF(TRIM(CAST(DISTRITO AS STRING)), '')) AS district,
          ANY_VALUE(NULLIF(TRIM(CAST(ENTIDAD AS STRING)), '')) AS state,
          ANY_VALUE(NULLIF(TRIM(CAST(INSTITUCION AS STRING)), '')) AS institution,
          ANY_VALUE(NULLIF(TRIM(CAST(REFERENCIA AS STRING)), '')) AS reference,
          LOGICAL_OR(UPPER(TRIM(CAST(REFERENCIA AS STRING))) = 'VISITADO') AS visited
        FROM ${GOB360_PC_STRUCTURE}
        WHERE NULLIF(TRIM(CAST(CLUE AS STRING)), '') IS NOT NULL
        GROUP BY clue
      ),
      sales AS (
        SELECT
          NULLIF(TRIM(CAST(CLUE AS STRING)), '') AS clue,
          LOWER(REGEXP_REPLACE(TRIM(CAST(CLAVE AS STRING)), r'[^a-zA-Z0-9]+', '')) AS source_clave_normalized,
          COALESCE(
            SAFE_CAST(FECHA_MOVIL AS DATE),
            SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA_MOVIL), '$.value') AS DATE),
            SAFE_CAST(FECHA AS DATE),
            SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA), '$.value') AS DATE)
          ) AS event_date,
          COALESCE(SAFE_CAST(PIEZAS AS FLOAT64), 0) AS pieces
        FROM ${GOB360_PC_SALES}
        WHERE NULLIF(TRIM(CAST(CLUE AS STRING)), '') IS NOT NULL
          AND NULLIF(TRIM(CAST(CLAVE AS STRING)), '') IS NOT NULL
      )
      SELECT
        rv.reporting_version_id,
        rv.period_month,
        sales.clue,
        COALESCE(structure.unit_name, sales.clue) AS unit_name,
        COALESCE(structure.territory, '') AS territory,
        COALESCE(structure.district, '') AS district,
        COALESCE(structure.state, '') AS state,
        COALESCE(structure.institution, '') AS institution,
        COALESCE(structure.reference, '') AS reference,
        COALESCE(structure.visited, FALSE) AS visited,
        mappings.market_group,
        SUM(sales.pieces) AS public_demand_mat,
        SUM(IF(mappings.product_id IS NOT NULL, sales.pieces, 0)) AS chiesi_public_demand_mat
      FROM reporting_versions rv
      JOIN sales
        ON sales.event_date BETWEEN DATE_SUB(rv.period_month, INTERVAL 11 MONTH) AND rv.period_month
      JOIN mappings
        ON mappings.source_clave_normalized = sales.source_clave_normalized
      LEFT JOIN structure
        ON structure.clue = sales.clue
      GROUP BY
        rv.reporting_version_id,
        rv.period_month,
        sales.clue,
        unit_name,
        territory,
        district,
        state,
        institution,
        reference,
        visited,
        mappings.market_group
      HAVING public_demand_mat > 0
      `,
      params: scope.reportingVersionId ? { reportingVersionId: scope.reportingVersionId } : undefined,
      location: 'US',
    });
  } catch (error) {
    console.warn(
      'AIR public serving refresh skipped. Check GOB360 credentials, permissions, and BigQuery dataset locations.',
      error,
    );
  }
}
