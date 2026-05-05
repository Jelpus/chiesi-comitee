import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { getGob360BigQueryClient, getGob360TableRefs } from '@/lib/bigquery/gob360-client';
import {
  airPublicAffinitySegments,
  airPublicCoverageSegments,
  airPublicDemandSegments,
  airPublicRelevanceOrder,
} from '@/lib/air/public-segmentation-config';
import type {
  AirPublicClueSegment,
  AirPublicMatrixCell,
  AirPublicPageData,
  AirPublicRelevanceSummary,
} from '@/lib/air/types';

const GOB360_PRODUCT_MAPPING_TABLE = 'chiesi-committee.chiesi_committee_admin.gob360_product_mapping';

type Gob360ProductMapping = {
  sourceClaveNormalized: string;
  marketGroup: string;
  productId: string | null;
};

let publicDataCache:
  | {
      cacheKey: string;
      expiresAt: number;
      data: AirPublicPageData;
    }
  | null = null;
let publicDataPromise: Promise<AirPublicPageData> | null = null;

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function stringValue(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

async function getGob360ProductMappings(): Promise<Gob360ProductMapping[]> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        source_clave_normalized,
        NULLIF(TRIM(product_id), '') AS product_id,
        COALESCE(NULLIF(TRIM(market_group), ''), 'Unmapped market') AS market_group
      FROM (
        SELECT
          m.*,
          ROW_NUMBER() OVER (
            PARTITION BY m.source_clave_normalized
            ORDER BY m.updated_at DESC, m.created_at DESC
          ) AS rn
        FROM \`${GOB360_PRODUCT_MAPPING_TABLE}\` m
        WHERE m.is_active = TRUE
          AND m.source_clave_normalized IS NOT NULL
          AND TRIM(m.source_clave_normalized) != ''
      )
      WHERE rn = 1
    `,
  });

  return (rows as Array<Record<string, unknown>>)
    .map((row) => ({
      sourceClaveNormalized: stringValue(row.source_clave_normalized).toLowerCase(),
      marketGroup: stringValue(row.market_group, 'Unmapped market'),
      productId: row.product_id ? stringValue(row.product_id) : null,
    }))
    .filter((row) => row.sourceClaveNormalized);
}

function demandSegmentForIndex(index: number, total: number) {
  if (total <= 0) return airPublicDemandSegments[4];
  const percentile = index / total;
  if (percentile < 0.2) return airPublicDemandSegments[0];
  if (percentile < 0.4) return airPublicDemandSegments[1];
  if (percentile < 0.6) return airPublicDemandSegments[2];
  if (percentile < 0.8) return airPublicDemandSegments[3];
  return airPublicDemandSegments[4];
}

function visitCoverageSegment(clue: AirPublicClueSegment) {
  if (!clue.clue || !clue.unitName) return 'Review / unmapped';
  if (!clue.territory) return 'No route assigned';
  return clue.visited ? 'Visited' : 'Not visited';
}

function affinitySegment(share: number) {
  if (share >= 0.6) return airPublicAffinitySegments[0];
  if (share >= 0.35) return airPublicAffinitySegments[1];
  if (share >= 0.15) return airPublicAffinitySegments[2];
  if (share > 0.02) return airPublicAffinitySegments[3];
  return airPublicAffinitySegments[4];
}

function relevanceSegment(clue: AirPublicClueSegment) {
  if (clue.visitCoverageSegment === 'Review / unmapped' || clue.visitCoverageSegment === 'No route assigned') {
    return 'E. Review / Unmapped';
  }

  const highDemand =
    clue.demandSegment === 'Very High Public Demand' || clue.demandSegment === 'High Public Demand';
  const mediumDemand = clue.demandSegment === 'Medium Public Demand';

  if (highDemand && ['Chiesi Lover', 'Chiesi Friendly'].includes(clue.chiesiAffinitySegment)) {
    return 'A. Strategic Public Demand Centers';
  }
  if (highDemand && ['Low Chiesi Affinity', 'No / Minimal Chiesi Affinity'].includes(clue.chiesiAffinitySegment)) {
    return 'B. High Potential Unvisited CLUEs';
  }
  if (mediumDemand && ['Low Chiesi Affinity', 'No / Minimal Chiesi Affinity'].includes(clue.chiesiAffinitySegment)) {
    return 'B. High Potential Unvisited CLUEs';
  }
  if (
    (highDemand || mediumDemand) &&
    ['Chiesi Lover', 'Chiesi Friendly', 'Neutral'].includes(clue.chiesiAffinitySegment)
  ) {
    return 'C. Maintain / Defend';
  }
  return 'D. Low Priority';
}

function buildPublicMatrix(clues: AirPublicClueSegment[]): AirPublicMatrixCell[] {
  return airPublicDemandSegments.flatMap((demandSegment) =>
    airPublicAffinitySegments.map((chiesiAffinitySegment) => ({
      demandSegment,
      chiesiAffinitySegment,
      clueCount: clues.filter(
        (clue) => clue.demandSegment === demandSegment && clue.chiesiAffinitySegment === chiesiAffinitySegment,
      ).length,
    })),
  );
}

function buildPublicRelevanceSummary(clues: AirPublicClueSegment[]): AirPublicRelevanceSummary[] {
  return airPublicRelevanceOrder.map((segment) => {
    const segmentClues = clues.filter((clue) => clue.airRelevanceSegment === segment);
    return {
      segment,
      total: segmentClues.length,
      visited: segmentClues.filter((clue) => clue.visited).length,
      notVisited: segmentClues.filter((clue) => !clue.visited).length,
      publicDemandMat: segmentClues.reduce((sum, clue) => sum + clue.publicDemandMat, 0),
      chiesiPublicDemandMat: segmentClues.reduce((sum, clue) => sum + clue.chiesiPublicDemandMat, 0),
    };
  });
}

function sortPublicCluesForUi(clues: AirPublicClueSegment[]) {
  const relevanceOrder = new Map(airPublicRelevanceOrder.map((segment, index) => [segment, index]));
  return [...clues].sort((a, b) => {
    const relevanceDiff =
      (relevanceOrder.get(a.airRelevanceSegment) ?? 99) - (relevanceOrder.get(b.airRelevanceSegment) ?? 99);
    if (relevanceDiff !== 0) return relevanceDiff;
    return b.publicDemandMat - a.publicDemandMat;
  });
}

export function getAirPublicDemandSegments() {
  return airPublicDemandSegments;
}

export function getAirPublicCoverageSegments() {
  return airPublicCoverageSegments;
}

export async function getAirPublicPageData(options: {
  periodMonth?: string;
  marketGroup?: string;
  includeAllRows?: boolean;
} = {}): Promise<AirPublicPageData> {
  const selectedMarketGroup = options.marketGroup ?? 'all';
  const cacheKey = `${options.periodMonth ?? 'latest'}:${selectedMarketGroup}:${options.includeAllRows ? 'raw' : 'lean'}`;
  const now = Date.now();
  if (publicDataCache && publicDataCache.cacheKey === cacheKey && publicDataCache.expiresAt > now) {
    return publicDataCache.data;
  }
  if (publicDataPromise) return publicDataPromise;

  publicDataPromise = buildAirPublicPageData(options)
    .then((data) => {
      publicDataCache = {
        cacheKey,
        data,
        expiresAt: Date.now() + 10 * 60 * 1000,
      };
      return data;
    })
    .finally(() => {
      publicDataPromise = null;
    });

  return publicDataPromise;
}

async function buildAirPublicPageData(options: {
  periodMonth?: string;
  marketGroup?: string;
  includeAllRows?: boolean;
} = {}): Promise<AirPublicPageData> {
  const warnings: string[] = [];
  const selectedMarketGroup = options.marketGroup ?? 'all';
  if (!options.periodMonth) {
    return {
      selectedMarketGroup,
      marketGroups: [],
      clues: [],
      matrix: [],
      relevanceSummary: [],
      totalClues: 0,
      visitedClues: 0,
      notVisitedClues: 0,
      totalPublicDemandMat: 0,
      totalChiesiPublicDemandMat: 0,
      warnings: ['No reporting period was available for GOB360 public segmentation.'],
    };
  }

  try {
    const mappings = await getGob360ProductMappings();
    const marketGroups = [...new Set(mappings.map((mapping) => mapping.marketGroup).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
    let effectiveSelectedMarketGroup = selectedMarketGroup;
    let selectedMappings =
      selectedMarketGroup === 'all'
        ? mappings
        : mappings.filter((mapping) => mapping.marketGroup === selectedMarketGroup);

    if (selectedMarketGroup !== 'all' && selectedMappings.length === 0) {
      warnings.push(
        `Selected market group "${selectedMarketGroup}" was not found in GOB360 product mappings. Showing all public market groups instead.`,
      );
      effectiveSelectedMarketGroup = 'all';
      selectedMappings = mappings;
    }

    const mappedClaves = [...new Set(selectedMappings.map((mapping) => mapping.sourceClaveNormalized))];
    const marketGroupByClave = new Map(
      selectedMappings.map((mapping) => [mapping.sourceClaveNormalized, mapping.marketGroup]),
    );
    const chiesiClaveSet = new Set(
      selectedMappings
        .filter((mapping) => Boolean(mapping.productId && mapping.productId.trim() !== ''))
        .map((mapping) => mapping.sourceClaveNormalized),
    );

    if (mappedClaves.length === 0) {
      return {
        selectedMarketGroup: effectiveSelectedMarketGroup,
        marketGroups,
        clues: [],
        matrix: [],
        relevanceSummary: [],
        totalClues: 0,
        visitedClues: 0,
        notVisitedClues: 0,
        totalPublicDemandMat: 0,
        totalChiesiPublicDemandMat: 0,
        warnings: ['No active GOB360 product mappings were found for the selected market group.'],
      };
    }

    const client = getGob360BigQueryClient(true);
    const { pcSalesTableId, pcStructureTableId } = getGob360TableRefs();
    const params = {
      periodMonth: options.periodMonth,
      mappedClaves,
    };

    const [rows] = await client.query({
      query: `
        WITH structure AS (
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
              SAFE_CAST(FECHA_MOVIL AS DATE),
              SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA_MOVIL), '$.value') AS DATE),
              SAFE_CAST(FECHA AS DATE),
              SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA), '$.value') AS DATE)
            ) AS event_date,
            COALESCE(SAFE_CAST(PIEZAS AS FLOAT64), 0) AS pieces
          FROM \`${pcSalesTableId}\`
          WHERE NULLIF(TRIM(CAST(CLUE AS STRING)), '') IS NOT NULL
            AND NULLIF(TRIM(CAST(CLAVE AS STRING)), '') IS NOT NULL
        ),
        mapped_sales AS (
          SELECT
            sales.clue,
            sales.source_clave_normalized,
            SUM(sales.pieces) AS public_demand_mat
          FROM sales
          WHERE sales.event_date BETWEEN DATE_SUB(DATE(@periodMonth), INTERVAL 11 MONTH) AND DATE(@periodMonth)
            AND sales.source_clave_normalized IN UNNEST(@mappedClaves)
          GROUP BY sales.clue, sales.source_clave_normalized
        )
        SELECT
          mapped_sales.clue,
          mapped_sales.source_clave_normalized,
          COALESCE(structure.unit_name, mapped_sales.clue) AS unit_name,
          COALESCE(structure.territory, '') AS territory,
          COALESCE(structure.district, '') AS district,
          COALESCE(structure.state, '') AS state,
          COALESCE(structure.institution, '') AS institution,
          COALESCE(structure.reference, '') AS reference,
          COALESCE(structure.visited, FALSE) AS visited,
          mapped_sales.public_demand_mat
        FROM mapped_sales
        LEFT JOIN structure ON mapped_sales.clue = structure.clue
        WHERE mapped_sales.public_demand_mat > 0
        ORDER BY mapped_sales.public_demand_mat DESC
      `,
      params,
      location: 'US',
    });

    const clueMap = new Map<string, AirPublicClueSegment>();
    for (const row of rows as Array<Record<string, unknown>>) {
      const clue = stringValue(row.clue);
      const sourceClaveNormalized = stringValue(row.source_clave_normalized).toLowerCase();
      const marketGroup = marketGroupByClave.get(sourceClaveNormalized) ?? 'Unmapped market';
      const key = `${clue}:${marketGroup}`;
      const existing = clueMap.get(key);
      const publicDemandMat = numberValue(row.public_demand_mat);
      const chiesiPublicDemandMat = chiesiClaveSet.has(sourceClaveNormalized) ? publicDemandMat : 0;
      if (existing) {
        existing.publicDemandMat += publicDemandMat;
        existing.chiesiPublicDemandMat += chiesiPublicDemandMat;
        existing.chiesiShareMat =
          existing.publicDemandMat > 0 ? existing.chiesiPublicDemandMat / existing.publicDemandMat : 0;
      } else {
        clueMap.set(key, {
          clue,
          unitName: stringValue(row.unit_name, clue),
          territory: stringValue(row.territory),
          district: stringValue(row.district),
          state: stringValue(row.state),
          institution: stringValue(row.institution),
          reference: stringValue(row.reference),
          visited: Boolean(row.visited),
          marketGroup,
          publicDemandMat,
          chiesiPublicDemandMat,
          chiesiShareMat: publicDemandMat > 0 ? chiesiPublicDemandMat / publicDemandMat : 0,
          demandSegment: 'Very Low Public Demand',
          visitCoverageSegment: 'Review / unmapped',
          chiesiAffinitySegment: 'No / Minimal Chiesi Affinity',
          airRelevanceSegment: 'E. Review / Unmapped',
        });
      }
    }

    const rawClues = [...clueMap.values()].sort((a, b) => b.publicDemandMat - a.publicDemandMat);

    const segmentedClues = rawClues.map((clue, index) => {
      const demandSegment = demandSegmentForIndex(index, rawClues.length);
      const withDemand = { ...clue, demandSegment };
      const coverage = visitCoverageSegment(withDemand);
      const affinity = affinitySegment(withDemand.chiesiShareMat);
      const withCoverage = { ...withDemand, visitCoverageSegment: coverage, chiesiAffinitySegment: affinity };
      return {
        ...withCoverage,
        airRelevanceSegment: relevanceSegment(withCoverage),
      };
    });
    const sortedClues = sortPublicCluesForUi(segmentedClues);

    if (sortedClues.length === 0) {
      warnings.push('No GOB360 public CLUE demand was found for the current MAT period and market group.');
    }

    return {
      selectedMarketGroup: effectiveSelectedMarketGroup,
      marketGroups,
      clues: sortedClues,
      matrix: buildPublicMatrix(segmentedClues),
      relevanceSummary: buildPublicRelevanceSummary(segmentedClues),
      totalClues: segmentedClues.length,
      visitedClues: segmentedClues.filter((clue) => clue.visited).length,
      notVisitedClues: segmentedClues.filter((clue) => !clue.visited).length,
      totalPublicDemandMat: segmentedClues.reduce((sum, clue) => sum + clue.publicDemandMat, 0),
      totalChiesiPublicDemandMat: segmentedClues.reduce((sum, clue) => sum + clue.chiesiPublicDemandMat, 0),
      warnings,
    };
  } catch (error) {
    return {
      selectedMarketGroup,
      marketGroups: [],
      clues: [],
      matrix: [],
      relevanceSummary: [],
      totalClues: 0,
      visitedClues: 0,
      notVisitedClues: 0,
      totalPublicDemandMat: 0,
      totalChiesiPublicDemandMat: 0,
      warnings: [
        `GOB360 public segmentation could not be loaded: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      ],
    };
  }
}
