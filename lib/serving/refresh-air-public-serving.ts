import 'server-only';
import type { BigQuery } from '@google-cloud/bigquery';
import { getGob360BigQueryClient, getGob360TableRefs } from '@/lib/bigquery/gob360-client';

const REPORTING_VERSIONS = '`chiesi-committee.chiesi_committee_admin.reporting_versions`';
const PRODUCT_MAPPING = '`chiesi-committee.chiesi_committee_admin.gob360_product_mapping`';
const SERVING_PROJECT = process.env.AIR_SERVING_PROJECT ?? 'chiesi-committee';
const SERVING_DATASET = process.env.AIR_SERVING_DATASET ?? 'chiesi_committee_serving';
const PUBLIC_SERVING = `\`${SERVING_PROJECT}.${SERVING_DATASET}.air_public_clue_mat\``;

type ReportingVersion = {
  reporting_version_id: string;
  period_month: string;
};

type ProductMapping = {
  source_clave_normalized: string;
  product_id: string | null;
  market_group: string;
};

type PublicClueRow = {
  clue: string;
  unit_name: string;
  territory: string;
  district: string;
  state: string;
  institution: string;
  reference: string;
  visited: boolean;
  market_group: string;
  public_demand_mat: number;
  chiesi_public_demand_mat: number;
};

/** Read each region separately: BigQuery cannot join the US GOB360 dataset to EU serving tables. */
export async function refreshAirPublicServingArtifacts(
  euClient: BigQuery,
  scope: { reportingVersionId?: string } = {},
) {
  const [versions] = await euClient.query({
    query: `
      SELECT reporting_version_id, CAST(period_month AS STRING) AS period_month
      FROM ${REPORTING_VERSIONS}
      WHERE status IN ('closed', 'ready_to_show')
        ${scope.reportingVersionId ? 'AND reporting_version_id = @reportingVersionId' : ''}
      ORDER BY period_month
    `,
    params: scope.reportingVersionId ? { reportingVersionId: scope.reportingVersionId } : undefined,
    location: 'EU',
  });

  const [mappings] = await euClient.query({
    query: `
      SELECT LOWER(source_clave_normalized) AS source_clave_normalized,
        NULLIF(TRIM(product_id), '') AS product_id,
        COALESCE(NULLIF(TRIM(market_group), ''), 'Unmapped market') AS market_group
      FROM (
        SELECT m.*,
          ROW_NUMBER() OVER (
            PARTITION BY m.source_clave_normalized
            ORDER BY m.updated_at DESC, m.created_at DESC
          ) AS rn
        FROM ${PRODUCT_MAPPING} m
        WHERE m.is_active = TRUE
          AND NULLIF(TRIM(m.source_clave_normalized), '') IS NOT NULL
      )
      WHERE rn = 1
    `,
    location: 'EU',
  });
  if (mappings.length === 0) {
    throw new Error('AIR public serving refresh requires active GOB360 product mappings.');
  }

  const gobClient = getGob360BigQueryClient(true);
  const { pcSalesTableId, pcStructureTableId } = getGob360TableRefs();
  const mappingsJson = JSON.stringify(mappings as ProductMapping[]);

  for (const version of versions as ReportingVersion[]) {
    const [rows] = await gobClient.query({
      query: `
        WITH mappings AS (
          SELECT
            JSON_VALUE(item, '$.source_clave_normalized') AS source_clave_normalized,
            JSON_VALUE(item, '$.product_id') AS product_id,
            JSON_VALUE(item, '$.market_group') AS market_group
          FROM UNNEST(JSON_QUERY_ARRAY(@mappingsJson)) AS item
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
          FROM \`${pcStructureTableId}\`
          WHERE NULLIF(TRIM(CAST(CLUE AS STRING)), '') IS NOT NULL
          GROUP BY clue
        ),
        sales AS (
          SELECT
            NULLIF(TRIM(CAST(CLUE AS STRING)), '') AS clue,
            LOWER(REGEXP_REPLACE(TRIM(CAST(CLAVE AS STRING)), r'[^a-zA-Z0-9]+', '')) AS source_clave_normalized,
            COALESCE(
              SAFE_CAST(FECHA AS DATE),
              SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA), '$.value') AS DATE),
              SAFE_CAST(FECHA_MOVIL AS DATE),
              SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA_MOVIL), '$.value') AS DATE)
            ) AS event_date,
            COALESCE(SAFE_CAST(PIEZAS AS FLOAT64), 0) AS pieces
          FROM \`${pcSalesTableId}\`
          WHERE NULLIF(TRIM(CAST(CLUE AS STRING)), '') IS NOT NULL
            AND NULLIF(TRIM(CAST(CLAVE AS STRING)), '') IS NOT NULL
        )
        SELECT
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
        FROM sales
        JOIN mappings ON mappings.source_clave_normalized = sales.source_clave_normalized
        LEFT JOIN structure ON structure.clue = sales.clue
        WHERE sales.event_date BETWEEN DATE_SUB(DATE(@periodMonth), INTERVAL 11 MONTH)
          AND DATE(@periodMonth)
        GROUP BY sales.clue, unit_name, territory, district, state, institution,
          reference, visited, mappings.market_group
        HAVING public_demand_mat > 0
      `,
      params: { mappingsJson, periodMonth: version.period_month },
      location: 'US',
    });

    const publicRows = rows as PublicClueRow[];
    if (publicRows.length === 0) {
      throw new Error(`AIR public serving found no GOB360 demand for ${version.reporting_version_id}.`);
    }
    const rowsJson = JSON.stringify(publicRows);
    // Fetch and validate the complete US result before replacing the EU version.
    await euClient.query({
      query: `
        BEGIN TRANSACTION;
        DELETE FROM ${PUBLIC_SERVING}
        WHERE reporting_version_id = @reportingVersionId;
        INSERT INTO ${PUBLIC_SERVING} (
          reporting_version_id, period_month, clue, unit_name, territory, district,
          state, institution, reference, visited, market_group,
          public_demand_mat, chiesi_public_demand_mat
        )
        SELECT @reportingVersionId, DATE(@periodMonth),
          JSON_VALUE(item, '$.clue'), JSON_VALUE(item, '$.unit_name'),
          JSON_VALUE(item, '$.territory'), JSON_VALUE(item, '$.district'),
          JSON_VALUE(item, '$.state'), JSON_VALUE(item, '$.institution'),
          JSON_VALUE(item, '$.reference'), SAFE_CAST(JSON_VALUE(item, '$.visited') AS BOOL),
          JSON_VALUE(item, '$.market_group'),
          SAFE_CAST(JSON_VALUE(item, '$.public_demand_mat') AS FLOAT64),
          SAFE_CAST(JSON_VALUE(item, '$.chiesi_public_demand_mat') AS FLOAT64)
        FROM UNNEST(JSON_QUERY_ARRAY(@rowsJson)) AS item;
        COMMIT TRANSACTION;
      `,
      params: {
        reportingVersionId: version.reporting_version_id,
        periodMonth: version.period_month,
        rowsJson,
      },
      location: 'EU',
    });
  }
}
