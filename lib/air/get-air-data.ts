import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { calculateAirCallPlanMetrics } from '@/lib/air/air-metrics';
import { fuzzyMatchDoctors } from '@/lib/air/fuzzy-match-doctors';
import { getAirPublicPageData } from '@/lib/air/get-air-public-data';
import { segmentDoctors } from '@/lib/air/segment-doctors';
import { refreshAirServingArtifacts } from '@/lib/serving/refresh-air-serving';
import type {
  AirCloseupDoctor,
  AirDoctorMatch,
  AirDoctorProfile,
  AirMedicalFileRow,
  AirPageData,
  AirRelevanceSummary,
  AirReportingVersion,
  AirSegmentedDoctor,
} from '@/lib/air/types';

const REPORTING_VERSIONS_TABLE = 'chiesi-committee.chiesi_committee_admin.reporting_versions';
const AIR_MATCHES_TABLE = 'chiesi-committee.chiesi_committee_admin.air_doctor_name_matches';
const AIR_MEDICAL_SERVING_TABLE = 'chiesi-committee.chiesi_committee_serving.air_medical_file_rows';
const AIR_CLOSEUP_SERVING_TABLE = 'chiesi-committee.chiesi_committee_serving.air_closeup_doctor_mat';
const AIR_MEDICAL_FILE_TABLE =
  'chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file';
const CLOSEUP_VIEW =
  'chiesi-committee.chiesi_committee_stg.vw_business_excellence_closeup_enriched';

let airPageDataCache:
  | {
      cacheKey: string;
      expiresAt: number;
      data: AirPageData;
    }
  | null = null;
let airPageDataPromise: Promise<AirPageData> | null = null;
let ensureAirDoctorMatchesTablePromise: Promise<void> | null = null;
const airServingRefreshPromiseByVersion = new Map<string, Promise<void>>();

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isMissingServingArtifact(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return code === 404 || /not found/i.test(message);
}

async function ensureAirDoctorMatchesTable() {
  if (ensureAirDoctorMatchesTablePromise) return ensureAirDoctorMatchesTablePromise;

  const client = getBigQueryClient();
  ensureAirDoctorMatchesTablePromise = client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`${AIR_MATCHES_TABLE}\` (
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
  }).then(() => undefined);

  return ensureAirDoctorMatchesTablePromise;
}

export async function getLatestAirReportingVersion(): Promise<AirReportingVersion | null> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        reporting_version_id,
        CAST(period_month AS STRING) AS period_month,
        version_name,
        status
      FROM \`${REPORTING_VERSIONS_TABLE}\`
      WHERE status IN ('closed', 'ready_to_show')
      ORDER BY period_month DESC, version_number DESC, created_at DESC
      LIMIT 1
    `,
  });

  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;

  return {
    reportingVersionId: String(row.reporting_version_id ?? ''),
    periodMonth: String(row.period_month ?? ''),
    versionName: String(row.version_name ?? ''),
    status: String(row.status ?? ''),
  };
}

async function getPersistedDoctorMatches(reportingVersion: AirReportingVersion): Promise<AirDoctorMatch[]> {
  await ensureAirDoctorMatchesTable();
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        medical_file_ims_id,
        medical_file_full_name,
        closeup_hcp_name,
        match_score,
        match_method,
        match_confidence,
        matched_tokens,
        unmatched_tokens
      FROM \`${AIR_MATCHES_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
    `,
    params: { reportingVersionId: reportingVersion.reportingVersionId },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    medicalFileImsId: String(row.medical_file_ims_id ?? ''),
    medicalFileFullName: String(row.medical_file_full_name ?? ''),
    closeupHcpName: row.closeup_hcp_name == null ? null : String(row.closeup_hcp_name),
    matchScore: numberValue(row.match_score),
    matchMethod: String(row.match_method ?? 'persisted'),
    matchConfidence:
      row.match_confidence === 'high' ||
      row.match_confidence === 'medium' ||
      row.match_confidence === 'low' ||
      row.match_confidence === 'unmatched'
        ? row.match_confidence
        : 'unmatched',
    matchedTokens: Array.isArray(row.matched_tokens)
      ? row.matched_tokens.map(String).filter((token) => token !== '__EMPTY__')
      : [],
    unmatchedTokens: Array.isArray(row.unmatched_tokens)
      ? row.unmatched_tokens.map(String).filter((token) => token !== '__EMPTY__')
      : [],
  }));
}

async function persistDoctorMatches(reportingVersion: AirReportingVersion, matches: AirDoctorMatch[]) {
  if (matches.length === 0) return;
  await ensureAirDoctorMatchesTable();
  const client = getBigQueryClient();
  await client.query({
    query: `
      MERGE \`${AIR_MATCHES_TABLE}\` AS target
      USING UNNEST(@rows) AS source
      ON target.reporting_version_id = @reportingVersionId
        AND target.medical_file_ims_id = source.medical_file_ims_id
      WHEN MATCHED THEN UPDATE SET
        period_month = DATE(@periodMonth),
        medical_file_full_name = source.medical_file_full_name,
        closeup_hcp_name = NULLIF(source.closeup_hcp_name, ''),
        match_score = source.match_score,
        match_method = source.match_method,
        match_confidence = source.match_confidence,
        matched_tokens = source.matched_tokens,
        unmatched_tokens = source.unmatched_tokens,
        generated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (
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
      VALUES (
        @reportingVersionId,
        DATE(@periodMonth),
        source.medical_file_ims_id,
        source.medical_file_full_name,
        NULLIF(source.closeup_hcp_name, ''),
        source.match_score,
        source.match_method,
        source.match_confidence,
        source.matched_tokens,
        source.unmatched_tokens,
        CURRENT_TIMESTAMP()
      )
    `,
    params: {
      reportingVersionId: reportingVersion.reportingVersionId,
      periodMonth: reportingVersion.periodMonth,
      rows: matches.map((match) => ({
        medical_file_ims_id: match.medicalFileImsId,
        medical_file_full_name: match.medicalFileFullName,
        closeup_hcp_name: match.closeupHcpName ?? '',
        match_score: match.matchScore,
        match_method: match.matchMethod,
        match_confidence: match.matchConfidence,
        matched_tokens: match.matchedTokens.length > 0 ? match.matchedTokens : ['__EMPTY__'],
        unmatched_tokens: match.unmatchedTokens.length > 0 ? match.unmatchedTokens : ['__EMPTY__'],
      })),
    },
  });
}

async function getOrCreateDoctorMatches(
  reportingVersion: AirReportingVersion,
  doctors: AirDoctorProfile[],
  closeupDoctors: AirCloseupDoctor[],
  existingPersistedMatches?: AirDoctorMatch[],
  options: { allowGenerate?: boolean } = {},
) {
  const persistedMatches = existingPersistedMatches ?? (await getPersistedDoctorMatches(reportingVersion));
  const persistedByIms = new Map(persistedMatches.map((match) => [match.medicalFileImsId, match]));

  if (!options.allowGenerate) {
    return doctors.map((doctor) => {
      const persisted = persistedByIms.get(doctor.imsId);
      if (persisted) {
        return {
          ...persisted,
          medicalFileFullName: doctor.fullName,
        };
      }
      return {
        medicalFileImsId: doctor.imsId,
        medicalFileFullName: doctor.fullName,
        closeupHcpName: null,
        matchScore: 0,
        matchMethod: 'not_evaluated',
        matchConfidence: 'unmatched',
        matchedTokens: [],
        unmatchedTokens: [],
      } satisfies AirDoctorMatch;
    });
  }

  if (closeupDoctors.length === 0) {
    return doctors.map((doctor) => {
      const persisted = persistedByIms.get(doctor.imsId);
      if (persisted) return { ...persisted, medicalFileFullName: doctor.fullName };
      return fuzzyMatchDoctors([doctor], closeupDoctors)[0];
    });
  }

  // Normal page loads should trust persisted matches, including unmatched rows, so the route stays fast.
  // To refresh unmatched candidates after a new CloseUp load, clear those rows or add a dedicated review action.
  const doctorsWithoutPersistedMatch = doctors.filter((doctor) => !persistedByIms.has(doctor.imsId));
  const generatedMatches = fuzzyMatchDoctors(doctorsWithoutPersistedMatch, closeupDoctors);
  const generatedByIms = new Map(generatedMatches.map((match) => [match.medicalFileImsId, match]));

  await persistDoctorMatches(reportingVersion, generatedMatches);

  return doctors.map((doctor) => {
    const generated = generatedByIms.get(doctor.imsId);
    if (generated) return generated;

    const persisted = persistedByIms.get(doctor.imsId);
    if (persisted) {
      return {
        ...persisted,
        medicalFileFullName: doctor.fullName,
      };
    }
    const fallback: AirDoctorMatch = {
      medicalFileImsId: doctor.imsId,
      medicalFileFullName: doctor.fullName,
      closeupHcpName: null,
      matchScore: 0,
      matchMethod: 'not_evaluated',
      matchConfidence: 'unmatched',
      matchedTokens: [],
      unmatchedTokens: [],
    };
    return generatedMatches.find((match) => match.medicalFileImsId === doctor.imsId) ?? fallback;
  });
}

function mapAirMedicalFileRows(rows: Array<Record<string, unknown>>): AirMedicalFileRow[] {
  return rows.map((row) => ({
    imsId: row.ims_id == null ? null : String(row.ims_id),
    fullName: row.full_name == null ? null : String(row.full_name),
    territory: row.territory == null ? null : String(row.territory),
    district: row.district == null ? null : String(row.district),
    objetivo: numberValue(row.objetivo),
    bu: row.bu == null ? null : String(row.bu),
    accountType: row.account_type == null ? null : String(row.account_type),
  }));
}

export async function getAirMedicalFileRows(
  periodMonth: string,
  reportingVersionId?: string,
  options: { allowStagingFallback?: boolean } = {},
): Promise<AirMedicalFileRow[]> {
  const client = getBigQueryClient();
  if (reportingVersionId) {
    try {
      const [rows] = await client.query({
        query: `
          SELECT
            ims_id,
            full_name,
            territory,
            district,
            objetivo,
            bu,
            account_type
          FROM \`${AIR_MEDICAL_SERVING_TABLE}\`
          WHERE reporting_version_id = @reportingVersionId
        `,
        params: { reportingVersionId },
      });
      return mapAirMedicalFileRows(rows as Array<Record<string, unknown>>);
    } catch (error) {
      if (!isMissingServingArtifact(error)) throw error;
      if (!options.allowStagingFallback) return [];
    }
  }

  const [rows] = await client.query({
    query: `
      SELECT
        NULLIF(TRIM(ims_id), '') AS ims_id,
        NULLIF(TRIM(full_name), '') AS full_name,
        NULLIF(TRIM(territory), '') AS territory,
        NULLIF(TRIM(district), '') AS district,
        COALESCE(SAFE_CAST(objetivo AS FLOAT64), 0) AS objetivo,
        NULLIF(TRIM(bu), '') AS bu,
        NULLIF(TRIM(JSON_VALUE(source_payload_json, '$."Account Type"')), '') AS account_type
      FROM \`${AIR_MEDICAL_FILE_TABLE}\`
      WHERE period_month = DATE(@periodMonth)
        AND UPPER(TRIM(bu)) = 'AIR'
        AND (
          JSON_VALUE(source_payload_json, '$."Account Type"') IN (
            'MP (Medical Professional)',
            'MP (Medical Professional) MX'
          )
          OR STARTS_WITH(JSON_VALUE(source_payload_json, '$."Account Type"'), 'MP (Medical Professional)')
        )
    `,
    params: { periodMonth },
  });

  return mapAirMedicalFileRows(rows as Array<Record<string, unknown>>);
}

export async function getCloseupMarketGroups(
  periodMonth: string,
  reportingVersionId?: string,
  options: { allowStagingFallback?: boolean } = {},
) {
  const client = getBigQueryClient();
  if (reportingVersionId) {
    try {
      const [rows] = await client.query({
        query: `
          SELECT DISTINCT market_group
          FROM \`${AIR_CLOSEUP_SERVING_TABLE}\`
          WHERE reporting_version_id = @reportingVersionId
          ORDER BY market_group
        `,
        params: { reportingVersionId },
      });
      return (rows as Array<Record<string, unknown>>).map((row) => String(row.market_group ?? '')).filter(Boolean);
    } catch (error) {
      if (!isMissingServingArtifact(error)) throw error;
      if (!options.allowStagingFallback) return [];
    }
  }

  const [rows] = await client.query({
    query: `
      SELECT DISTINCT COALESCE(NULLIF(TRIM(market_group), ''), 'Unmapped market') AS market_group
      FROM \`${CLOSEUP_VIEW}\`
      WHERE period_month BETWEEN DATE_SUB(DATE(@periodMonth), INTERVAL 11 MONTH) AND DATE(@periodMonth)
        AND NULLIF(TRIM(hcp_name), '') IS NOT NULL
      ORDER BY market_group
    `,
    params: { periodMonth },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => String(row.market_group ?? '')).filter(Boolean);
}

export async function getCloseupMatDoctors(
  periodMonth: string,
  hcpNames?: string[],
  marketGroup?: string,
  reportingVersionId?: string,
  options: { allowStagingFallback?: boolean } = {},
): Promise<AirCloseupDoctor[]> {
  if (hcpNames && hcpNames.length === 0) return [];

  const client = getBigQueryClient();
  const filterByNames = hcpNames && hcpNames.length > 0;
  const filterByMarketGroup = marketGroup && marketGroup !== 'all';
  const params = {
    periodMonth,
    ...(filterByNames ? { hcpNames } : {}),
    ...(filterByMarketGroup ? { marketGroup } : {}),
  };

  if (reportingVersionId) {
    const servingFilters = [
      'reporting_version_id = @reportingVersionId',
      ...(filterByNames ? ['hcp_name IN UNNEST(@hcpNames)'] : []),
      ...(filterByMarketGroup ? ['market_group = @marketGroup'] : []),
    ].join('\n        AND ');
    try {
      const [rows] = await client.query({
        query: `
          SELECT
            hcp_name,
            market_group,
            visited,
            market_rx_mat,
            chiesi_rx_mat
          FROM \`${AIR_CLOSEUP_SERVING_TABLE}\`
          WHERE ${servingFilters}
        `,
        params: {
          reportingVersionId,
          ...(filterByNames ? { hcpNames } : {}),
          ...(filterByMarketGroup ? { marketGroup } : {}),
        },
      });

      return (rows as Array<Record<string, unknown>>)
        .map((row) => {
          const marketRxMat = numberValue(row.market_rx_mat);
          const chiesiRxMat = numberValue(row.chiesi_rx_mat);
          return {
            hcpName: String(row.hcp_name ?? ''),
            marketGroup: String(row.market_group ?? 'Unmapped market'),
            visited: row.visited == null ? null : Boolean(row.visited),
            marketRxMat,
            chiesiRxMat,
            chiesiShareMat: marketRxMat > 0 ? chiesiRxMat / marketRxMat : 0,
          };
        })
        .filter((row) => row.hcpName);
    } catch (error) {
      if (!isMissingServingArtifact(error)) throw error;
      if (!options.allowStagingFallback) return [];
    }
  }

  const hcpNameFilter = filterByNames ? 'AND hcp_name IN UNNEST(@hcpNames)' : '';
  const marketGroupFilter = filterByMarketGroup
    ? "AND COALESCE(NULLIF(TRIM(market_group), ''), 'Unmapped market') = @marketGroup"
    : '';
  const [availabilityRows] = await client.query({
    query: `
      SELECT COUNT(1) AS hcp_rows
      FROM \`${CLOSEUP_VIEW}\`
      WHERE period_month BETWEEN DATE_SUB(DATE(@periodMonth), INTERVAL 11 MONTH) AND DATE(@periodMonth)
        AND NULLIF(TRIM(hcp_name), '') IS NOT NULL
        ${hcpNameFilter}
        ${marketGroupFilter}
    `,
    params,
  });
  const hcpRows = numberValue((availabilityRows as Array<Record<string, unknown>>)[0]?.hcp_rows);
  if (hcpRows === 0) return [];

  const [rows] = await client.query({
    query: `
      SELECT
        hcp_name,
        COALESCE(NULLIF(TRIM(market_group), ''), 'Unmapped market') AS market_group,
        LOGICAL_OR(COALESCE(visited, FALSE)) AS visited,
        SUM(COALESCE(SAFE_CAST(recetas_value AS FLOAT64), 0)) AS market_rx_mat,
        SUM(
          CASE
            WHEN COALESCE(UPPER(business_unit_code), UPPER(business_unit_name), '') = 'AIR'
              OR resolved_product_id IS NOT NULL
            THEN COALESCE(SAFE_CAST(recetas_value AS FLOAT64), 0)
            ELSE 0
          END
        ) AS chiesi_rx_mat
      FROM \`${CLOSEUP_VIEW}\`
      WHERE period_month BETWEEN DATE_SUB(DATE(@periodMonth), INTERVAL 11 MONTH) AND DATE(@periodMonth)
        AND NULLIF(TRIM(hcp_name), '') IS NOT NULL
        ${hcpNameFilter}
        ${marketGroupFilter}
      GROUP BY hcp_name, market_group
    `,
    params,
  });

  return (rows as Array<Record<string, unknown>>)
    .map((row) => {
      const marketRxMat = numberValue(row.market_rx_mat);
      const chiesiRxMat = numberValue(row.chiesi_rx_mat);
      return {
        hcpName: String(row.hcp_name ?? ''),
        marketGroup: String(row.market_group ?? 'Unmapped market'),
        visited: row.visited == null ? null : Boolean(row.visited),
        marketRxMat,
        chiesiRxMat,
        chiesiShareMat: marketRxMat > 0 ? chiesiRxMat / marketRxMat : 0,
      };
    })
    .filter((row) => row.hcpName);
}

const relevanceOrder = [
  'A. Strategic Chiesi Lovers',
  'B. High Potential Market Prescribers',
  'C. Maintain / Defend',
  'D. Low Priority',
  'E. Review / Unmatched',
];

function buildRelevanceSummary(doctors: AirSegmentedDoctor[]): AirRelevanceSummary[] {
  return relevanceOrder.map((segment) => {
    const segmentDoctors = doctors.filter((doctor) => doctor.airRelevanceSegment === segment);
    return {
      segment,
      total: segmentDoctors.length,
      visited: segmentDoctors.filter((doctor) => doctor.closeupVisited === true).length,
      notVisited: segmentDoctors.filter((doctor) => doctor.closeupVisited === false).length,
      objective: segmentDoctors.reduce((sum, doctor) => sum + doctor.totalVisitObjective, 0),
      marketRx: segmentDoctors.reduce((sum, doctor) => sum + doctor.marketRxMat, 0),
    };
  });
}

function sortSegmentedDoctorsForUi(doctors: AirSegmentedDoctor[]) {
  const order = new Map(relevanceOrder.map((segment, index) => [segment, index]));
  return [...doctors].sort((a, b) => {
    const relevanceDiff = (order.get(a.airRelevanceSegment) ?? 99) - (order.get(b.airRelevanceSegment) ?? 99);
    if (relevanceDiff !== 0) return relevanceDiff;
    return b.marketRxMat - a.marketRxMat;
  });
}

export async function getAirPageData(
  options: {
    marketGroup?: string;
    includeRawRows?: boolean;
    includePublicData?: boolean;
    allowStagingFallback?: boolean;
    allowMatchGeneration?: boolean;
  } = {},
): Promise<AirPageData> {
  const now = Date.now();
  const cacheKey = [
    options.marketGroup ?? 'all',
    options.includeRawRows ? 'raw' : 'lean',
    options.includePublicData ? 'public' : 'no-public',
    options.allowStagingFallback ? 'fallback' : 'serving-only',
    options.allowMatchGeneration ? 'generate-matches' : 'persisted-matches',
  ].join(':');
  if (airPageDataCache && airPageDataCache.cacheKey === cacheKey && airPageDataCache.expiresAt > now) return airPageDataCache.data;
  if (airPageDataPromise) return airPageDataPromise;

  airPageDataPromise = buildAirPageData(options)
    .then((data) => {
      airPageDataCache = {
        cacheKey,
        data,
        expiresAt: Date.now() + 10 * 60 * 1000,
      };
      return data;
    })
    .finally(() => {
      airPageDataPromise = null;
    });

  return airPageDataPromise;
}

async function buildAirPageData(
  options: {
    marketGroup?: string;
    includeRawRows?: boolean;
    includePublicData?: boolean;
    allowStagingFallback?: boolean;
    allowMatchGeneration?: boolean;
  } = {},
): Promise<AirPageData> {
  const reportingVersion = await getLatestAirReportingVersion();
  const warnings: string[] = [];
  const selectedMarketGroup = options.marketGroup ?? 'all';

  if (!reportingVersion) {
    const emptyCallPlan = calculateAirCallPlanMetrics([]);
    return {
      reportingVersion: null,
      selectedMarketGroup,
      marketGroups: [],
      medicalRows: [],
      closeupDoctors: [],
      callPlan: emptyCallPlan,
      matches: [],
      segmentedDoctors: [],
      matrix: [],
      relevanceSummary: [],
      warnings: ['No reporting version with status closed or ready_to_show was found.'],
      publicData: undefined,
    };
  }

  let [medicalRows, marketGroups] = await Promise.all([
    getAirMedicalFileRows(reportingVersion.periodMonth, reportingVersion.reportingVersionId, {
      allowStagingFallback: options.allowStagingFallback ?? false,
    }),
    getCloseupMarketGroups(reportingVersion.periodMonth, reportingVersion.reportingVersionId, {
      allowStagingFallback: options.allowStagingFallback ?? false,
    }),
  ]);

  if (!options.allowStagingFallback && (medicalRows.length === 0 || marketGroups.length === 0)) {
    let refreshPromise = airServingRefreshPromiseByVersion.get(reportingVersion.reportingVersionId);
    if (!refreshPromise) {
      refreshPromise = refreshAirServingArtifacts(getBigQueryClient(), {
        reportingVersionId: reportingVersion.reportingVersionId,
      }).finally(() => {
        airServingRefreshPromiseByVersion.delete(reportingVersion.reportingVersionId);
      });
      airServingRefreshPromiseByVersion.set(reportingVersion.reportingVersionId, refreshPromise);
    }
    await refreshPromise;
    [medicalRows, marketGroups] = await Promise.all([
      getAirMedicalFileRows(reportingVersion.periodMonth, reportingVersion.reportingVersionId),
      getCloseupMarketGroups(reportingVersion.periodMonth, reportingVersion.reportingVersionId),
    ]);
  }

  const closeupMarketGroup =
    selectedMarketGroup !== 'all' && marketGroups.includes(selectedMarketGroup) ? selectedMarketGroup : 'all';
  const publicDataPromise = options.includePublicData
    ? getAirPublicPageData({
        periodMonth: reportingVersion.periodMonth,
        marketGroup: selectedMarketGroup,
      })
    : Promise.resolve(undefined);
  const callPlan = calculateAirCallPlanMetrics(medicalRows);
  let persistedMatches = await getPersistedDoctorMatches(reportingVersion);
  const persistedByIms = new Map(persistedMatches.map((match) => [match.medicalFileImsId, match]));
  const doctorsWithoutPersistedMatch = callPlan.doctors.filter((doctor) => !persistedByIms.has(doctor.imsId));
  const persistedCloseupNames = [
    ...new Set(
      persistedMatches
        .map((match) => match.closeupHcpName)
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  let closeupDoctors =
    doctorsWithoutPersistedMatch.length > 0
      ? await getCloseupMatDoctors(
          reportingVersion.periodMonth,
          undefined,
          closeupMarketGroup,
          reportingVersion.reportingVersionId,
          { allowStagingFallback: options.allowStagingFallback ?? false },
        )
      : await getCloseupMatDoctors(
          reportingVersion.periodMonth,
          persistedCloseupNames,
          closeupMarketGroup,
          reportingVersion.reportingVersionId,
          { allowStagingFallback: options.allowStagingFallback ?? false },
        );
  if (
    closeupDoctors.length === 0 &&
    doctorsWithoutPersistedMatch.length === 0 &&
    persistedCloseupNames.length > 0
  ) {
    closeupDoctors = await getCloseupMatDoctors(
      reportingVersion.periodMonth,
      undefined,
      closeupMarketGroup,
      reportingVersion.reportingVersionId,
      { allowStagingFallback: options.allowStagingFallback ?? false },
    );
  }
  const publicData = await publicDataPromise;

  if (persistedMatches.length === 0 && callPlan.doctors.length > 0 && closeupDoctors.length > 0) {
    let refreshPromise = airServingRefreshPromiseByVersion.get(reportingVersion.reportingVersionId);
    if (!refreshPromise) {
      refreshPromise = refreshAirServingArtifacts(getBigQueryClient(), {
        reportingVersionId: reportingVersion.reportingVersionId,
      }).finally(() => {
        airServingRefreshPromiseByVersion.delete(reportingVersion.reportingVersionId);
      });
      airServingRefreshPromiseByVersion.set(reportingVersion.reportingVersionId, refreshPromise);
    }
    await refreshPromise;
    persistedMatches = await getPersistedDoctorMatches(reportingVersion);
  }

  if (medicalRows.length === 0) warnings.push('No AIR medical file rows were found for the current reporting period.');
  if (marketGroups.length === 0) {
    warnings.push('No CloseUp physicians with hcp_name were found in the MAT window. Matching and productivity will show as unmatched.');
  }
  if (callPlan.issues.length > 0) warnings.push(...callPlan.issues);

  const matches = await getOrCreateDoctorMatches(reportingVersion, callPlan.doctors, closeupDoctors, persistedMatches, {
    allowGenerate: options.allowMatchGeneration ?? false,
  });
  const matchedCloseupNames = new Set(
    matches
      .map((match) => match.closeupHcpName)
      .filter((name): name is string => Boolean(name)),
  );
  const closeupDoctorsForUi = closeupDoctors.filter((doctor) => matchedCloseupNames.has(doctor.hcpName));
  const { segmentedDoctors, matrix } = segmentDoctors(callPlan.doctors, matches, closeupDoctorsForUi);
  const sortedSegmentedDoctors = sortSegmentedDoctorsForUi(segmentedDoctors);

  return {
    reportingVersion,
    selectedMarketGroup,
    marketGroups,
    medicalRows: options.includeRawRows ? medicalRows : [],
    closeupDoctors: closeupDoctorsForUi,
    callPlan: { ...callPlan, doctors: [] },
    matches: options.includeRawRows ? [] : matches.slice(0, 500),
    segmentedDoctors: sortedSegmentedDoctors,
    matrix,
    relevanceSummary: buildRelevanceSummary(segmentedDoctors),
    warnings: [...new Set(warnings)],
    publicData,
  };
}
