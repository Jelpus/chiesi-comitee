import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { getAdminTargets } from '@/lib/data/targets';
import { getMedicalMonthlyInputs } from '@/lib/data/medical-forms';

export type MedicalKpiStatus = 'on_track' | 'watch' | 'off_track';

export type MedicalKpiScore = {
  kpiName: string;
  kpiLabel: string;
  qtyUnit: string;
  targetText: string;
  targetValue: number | null;
  resultNumeric: number | null;
  resultText: string;
  comment: string;
  status: MedicalKpiStatus;
  statusLabel: string;
  coveragePct: number | null;
};

export type MedicalData = {
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  scores: MedicalKpiScore[];
  summary: {
    totalKpis: number;
    onTrack: number;
    watch: number;
    offTrack: number;
    healthScorePct: number | null;
  };
};

export type MedicalMslDashboardRow = {
  periodScope: 'YTD' | 'MTH';
  mlsCode: string;
  mlsName: string | null;
  clients: number;
  interactions: number;
  target: number;
  coveragePct: number | null;
  uniqueClientsReached: number;
  reachPct: number | null;
};

export type MedicalMslDashboardData = {
  reportingVersionId: string;
  reportPeriodMonth: string;
  sourceAsOfMonth: string | null;
  rows: MedicalMslDashboardRow[];
  summary: {
    ytd: {
      totalMls: number;
      clients: number;
      interactions: number;
      target: number;
      uniqueClientsReached: number;
      coveragePct: number | null;
      reachPct: number | null;
    };
    mth: {
      totalMls: number;
      clients: number;
      interactions: number;
      target: number;
      uniqueClientsReached: number;
      coveragePct: number | null;
      reachPct: number | null;
    };
  };
};

function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function parseLooseNumber(value: string | null | undefined) {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  const parsed = Number(normalized.replace(/[$,%\s]/g, '').replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveStatus(coveragePct: number | null): MedicalKpiStatus {
  if (coveragePct == null || !Number.isFinite(coveragePct)) return 'watch';
  if (coveragePct >= 100) return 'on_track';
  if (coveragePct >= 85) return 'watch';
  return 'off_track';
}

export async function getMedicalData(
  reportingVersionId: string,
  periodMonth: string,
): Promise<MedicalData> {
  const [targets, inputs] = await Promise.all([
    getAdminTargets('medical', reportingVersionId, periodMonth),
    getMedicalMonthlyInputs(periodMonth),
  ]);

  const activeTargets = targets
    .filter((item) => item.isActive)
    .sort((a, b) => (a.kpiLabel?.trim() || a.kpiName).localeCompare(b.kpiLabel?.trim() || b.kpiName));

  const inputByKpi = new Map(inputs.map((item) => [normalize(item.kpiName), item]));

  const scores: MedicalKpiScore[] = activeTargets.map((target) => {
    const kpiKey = normalize(target.kpiName);
    const input = inputByKpi.get(kpiKey);

    const targetValue = target.targetValueNumeric ?? parseLooseNumber(target.targetValueText);
    const resultNumeric =
      input?.resultValueNumeric ??
      parseLooseNumber(input?.resultValueText) ??
      0;
    const resultText = input?.resultValueText?.trim() || '';
    const comment = input?.comment?.trim() || '';

    const coveragePct =
      targetValue == null
        ? null
        : targetValue === 0
          ? resultNumeric <= 0
            ? 100
            : 0
          : (resultNumeric / targetValue) * 100;
    const status = deriveStatus(coveragePct);
    const statusLabel = status === 'on_track' ? 'On Track' : status === 'watch' ? 'Watch' : 'Off Track';

    return {
      kpiName: target.kpiName,
      kpiLabel: target.kpiLabel?.trim() || target.kpiName,
      qtyUnit: target.qtyUnit,
      targetText: target.targetValueText?.trim() || 'N/A',
      targetValue,
      resultNumeric,
      resultText,
      comment,
      status,
      statusLabel,
      coveragePct,
    };
  });

  const onTrack = scores.filter((item) => item.status === 'on_track').length;
  const watch = scores.filter((item) => item.status === 'watch').length;
  const offTrack = scores.filter((item) => item.status === 'off_track').length;
  const healthScorePct =
    scores.length > 0
      ? ((onTrack * 1 + watch * 0.5) / scores.length) * 100
      : null;

  return {
    reportPeriodMonth: inputs[0]?.periodMonth ?? periodMonth,
    sourceAsOfMonth: inputs[0]?.sourceAsOfMonth ?? periodMonth,
    scores,
    summary: {
      totalKpis: scores.length,
      onTrack,
      watch,
      offTrack,
      healthScorePct,
    },
  };
}

export async function getMedicalMslDashboardData(
  reportingVersionId: string,
  reportPeriodMonth: string,
): Promise<MedicalMslDashboardData | null> {
  const client = getBigQueryClient();
  const query = `
    WITH reporting_context AS (
      SELECT DATE(@reportPeriodMonth) AS report_period_month
    ),
    period_scopes AS (
      SELECT
        'MTH' AS period_scope,
        report_period_month AS period_start_month,
        report_period_month AS period_end_month,
        1 AS months_in_scope
      FROM reporting_context
      UNION ALL
      SELECT
        'YTD' AS period_scope,
        DATE_TRUNC(report_period_month, YEAR) AS period_start_month,
        report_period_month AS period_end_month,
        DATE_DIFF(report_period_month, DATE_TRUNC(report_period_month, YEAR), MONTH) + 1 AS months_in_scope
      FROM reporting_context
    ),
    uploads_filtered AS (
      SELECT
        u.upload_id,
        u.period_month,
        u.source_as_of_month,
        u.uploaded_at,
        LOWER(TRIM(u.module_code)) AS module_code
      FROM \`chiesi-committee.chiesi_committee_raw.uploads\` u
      WHERE u.reporting_version_id = @reportingVersionId
        AND u.status IN ('normalized', 'published')
    ),
    latest_fichero_upload AS (
      SELECT upload_id
      FROM uploads_filtered
      WHERE module_code IN (
        'business_excellence_salesforce_fichero_medico',
        'business_excellence_fichero_medico',
        'fichero_medico'
      )
        AND COALESCE(source_as_of_month, period_month) <= (SELECT report_period_month FROM reporting_context)
      QUALIFY ROW_NUMBER() OVER (
        ORDER BY COALESCE(source_as_of_month, period_month) DESC, uploaded_at DESC
      ) = 1
    ),
    latest_interactions_upload AS (
      SELECT upload_id, source_as_of_month
      FROM uploads_filtered
      WHERE module_code IN (
        'business_excellence_salesforce_interacciones',
        'business_excellence_interacciones',
        'interacciones'
      )
        AND COALESCE(source_as_of_month, period_month) <= (SELECT report_period_month FROM reporting_context)
      QUALIFY ROW_NUMBER() OVER (
        ORDER BY COALESCE(source_as_of_month, period_month) DESC, uploaded_at DESC
      ) = 1
    ),
    base_fichero AS (
      SELECT
        UPPER(COALESCE(NULLIF(TRIM(f.territory_normalized), ''), REGEXP_REPLACE(TRIM(COALESCE(f.territory, '')), r'[^a-zA-Z0-9]+', ''))) AS mls_code,
        UPPER(REGEXP_REPLACE(TRIM(COALESCE(NULLIF(f.ims_id, ''), NULLIF(f.onekey_id, ''))), r'[^a-zA-Z0-9]+', '')) AS doctor_id
      FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_medical_file\` f
      JOIN latest_fichero_upload fu
        ON fu.upload_id = f.upload_id
      WHERE UPPER(REGEXP_REPLACE(TRIM(COALESCE(NULLIF(f.ims_id, ''), NULLIF(f.onekey_id, ''))), r'[^a-zA-Z0-9]+', '')) != ''
        AND LOWER(TRIM(COALESCE(f.bu, ''))) LIKE '%medical%'
      GROUP BY 1, 2
    ),
    mls_clients AS (
      SELECT
        mls_code,
        COUNT(DISTINCT doctor_id) AS clients
      FROM base_fichero
      GROUP BY 1
    ),
    interactions_base AS (
      SELECT
        UPPER(COALESCE(NULLIF(TRIM(i.territory_normalized), ''), REGEXP_REPLACE(TRIM(COALESCE(i.territory, '')), r'[^a-zA-Z0-9]+', ''))) AS mls_code,
        UPPER(REGEXP_REPLACE(TRIM(COALESCE(i.onekey_id, '')), r'[^a-zA-Z0-9]+', '')) AS doctor_id,
        i.submit_period_month AS event_month,
        NULLIF(TRIM(i.owner_name), '') AS mls_name,
        i.interaction_id
      FROM \`chiesi-committee.chiesi_committee_stg.stg_business_excellence_salesforce_interactions\` i
      JOIN latest_interactions_upload iu
        ON iu.upload_id = i.upload_id
      WHERE i.submit_period_month IS NOT NULL
        AND UPPER(REGEXP_REPLACE(TRIM(COALESCE(i.onekey_id, '')), r'[^a-zA-Z0-9]+', '')) != ''
        AND LOWER(TRIM(COALESCE(
          JSON_VALUE(i.source_payload_json, '$.Estado'),
          JSON_VALUE(i.source_payload_json, '$.estado'),
          JSON_VALUE(i.source_payload_json, '$.Status'),
          JSON_VALUE(i.source_payload_json, '$.status'),
          ''
        ))) IN ('enviado', 'sent')
    ),
    interactions_scoped AS (
      SELECT
        ps.period_scope,
        ps.months_in_scope,
        ib.mls_code,
        ib.mls_name,
        ib.doctor_id,
        ib.interaction_id
      FROM period_scopes ps
      JOIN interactions_base ib
        ON ib.event_month BETWEEN ps.period_start_month AND ps.period_end_month
    ),
    mls_owner AS (
      SELECT
        period_scope,
        mls_code,
        ARRAY_AGG(mls_name IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS mls_name
      FROM interactions_scoped
      GROUP BY 1, 2
    ),
    interactions_agg AS (
      SELECT
        period_scope,
        mls_code,
        COUNT(DISTINCT interaction_id) AS interactions,
        COUNT(DISTINCT doctor_id) AS unique_clients_reached
      FROM interactions_scoped
      GROUP BY 1, 2
    ),
    mls_scope AS (
      SELECT
        ps.period_scope,
        ps.months_in_scope,
        mc.mls_code,
        COALESCE(mo.mls_name, NULL) AS mls_name,
        mc.clients,
        COALESCE(ia.interactions, 0) AS interactions,
        COALESCE(ia.unique_clients_reached, 0) AS unique_clients_reached
      FROM period_scopes ps
      JOIN mls_clients mc
        ON TRUE
      LEFT JOIN mls_owner mo
        ON mo.period_scope = ps.period_scope
       AND mo.mls_code = mc.mls_code
      LEFT JOIN interactions_agg ia
        ON ia.period_scope = ps.period_scope
       AND ia.mls_code = mc.mls_code
    ),
    final_rows AS (
      SELECT
        period_scope,
        mls_code,
        mls_name,
        clients,
        interactions,
        40 * months_in_scope AS target,
        SAFE_DIVIDE(interactions, NULLIF(40 * months_in_scope, 0)) AS coverage_ratio,
        unique_clients_reached,
        SAFE_DIVIDE(unique_clients_reached, NULLIF(clients, 0)) AS reach_ratio
      FROM mls_scope
    )
    SELECT
      fr.period_scope,
      fr.mls_code,
      fr.mls_name,
      fr.clients,
      fr.interactions,
      fr.target,
      fr.coverage_ratio,
      fr.unique_clients_reached,
      fr.reach_ratio,
      CAST((SELECT MAX(source_as_of_month) FROM latest_interactions_upload) AS STRING) AS source_as_of_month
    FROM final_rows fr
    ORDER BY fr.period_scope, fr.mls_code
  `;

  const [rows] = await client.query({
    query,
    params: {
      reportingVersionId,
      reportPeriodMonth,
    },
  });

  const typed = rows as Array<Record<string, unknown>>;
  if (typed.length === 0) return null;

  const parsedRows: MedicalMslDashboardRow[] = typed.map((row) => ({
    periodScope: String(row.period_scope ?? 'YTD').toUpperCase() === 'MTH' ? 'MTH' : 'YTD',
    mlsCode: String(row.mls_code ?? 'N/A'),
    mlsName: row.mls_name ? String(row.mls_name) : null,
    clients: Number(row.clients ?? 0),
    interactions: Number(row.interactions ?? 0),
    target: Number(row.target ?? 0),
    coveragePct: row.coverage_ratio == null ? null : Number(row.coverage_ratio) * 100,
    uniqueClientsReached: Number(row.unique_clients_reached ?? 0),
    reachPct: row.reach_ratio == null ? null : Number(row.reach_ratio) * 100,
  }));

  const summarize = (scope: 'YTD' | 'MTH') => {
    const rowsScope = parsedRows.filter((row) => row.periodScope === scope);
    const clients = rowsScope.reduce((sum, row) => sum + row.clients, 0);
    const interactions = rowsScope.reduce((sum, row) => sum + row.interactions, 0);
    const target = rowsScope.reduce((sum, row) => sum + row.target, 0);
    const uniqueClientsReached = rowsScope.reduce((sum, row) => sum + row.uniqueClientsReached, 0);
    return {
      totalMls: rowsScope.length,
      clients,
      interactions,
      target,
      uniqueClientsReached,
      coveragePct: target > 0 ? (interactions / target) * 100 : null,
      reachPct: clients > 0 ? (uniqueClientsReached / clients) * 100 : null,
    };
  };

  return {
    reportingVersionId,
    reportPeriodMonth,
    sourceAsOfMonth: typed[0]?.source_as_of_month ? String(typed[0].source_as_of_month) : null,
    rows: parsedRows,
    summary: {
      ytd: summarize('YTD'),
      mth: summarize('MTH'),
    },
  };
}
