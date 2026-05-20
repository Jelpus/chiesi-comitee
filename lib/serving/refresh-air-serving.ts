import 'server-only';
import type { BigQuery } from '@google-cloud/bigquery';

const SERVING_PROJECT = process.env.AIR_SERVING_PROJECT ?? 'chiesi-committee';
const SERVING_DATASET = process.env.AIR_SERVING_DATASET ?? 'chiesi_committee_serving';
const SERVING_SCHEMA = `\`${SERVING_PROJECT}.${SERVING_DATASET}\``;

const REPORTING_VERSIONS = '`chiesi-committee.chiesi_committee_admin.reporting_versions`';
const RAW_UPLOADS = '`chiesi-committee.chiesi_committee_raw.uploads`';
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
