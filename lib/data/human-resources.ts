import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import type {
  HumanResourcesAuditSource,
  HumanResourcesTrainingContentRow,
  HumanResourcesTrainingInsights,
  HumanResourcesTrainingMetricMode,
  HumanResourcesTrainingOverview,
  HumanResourcesTrainingRankingDimension,
  HumanResourcesTrainingRankingRow,
  HumanResourcesTrainingScope,
  HumanResourcesTrainingThemeData,
  HumanResourcesTrainingUserRow,
  HumanResourcesTurnoverInsightItem,
  HumanResourcesTurnoverScope,
  HumanResourcesTurnoverThemeData,
  HumanResourcesTurnoverThemeItem,
  HumanResourcesTurnoverMonthlyTrendRow,
  HumanResourcesTurnoverQuarterRow,
  HumanResourcesTurnoverReasonRow,
  HumanResourcesTurnoverSeniorityRow,
  HumanResourcesTurnoverDepartmentRow,
  HumanResourcesTurnoverOverview,
} from '@/types/human-resources';

const RAW_UPLOADS = 'chiesi-committee.chiesi_committee_raw.uploads';
const TURNOVER_VIEW = 'chiesi-committee.chiesi_committee_stg.vw_human_resources_turnover_enriched';
const TRAINING_VIEW = 'chiesi-committee.chiesi_committee_stg.vw_human_resources_training_enriched';

async function resolveReportingVersionId(reportingVersionId?: string) {
  const client = getBigQueryClient();
  if (reportingVersionId) return reportingVersionId;
  const [rows] = await client.query({
    query: `
      SELECT reporting_version_id
      FROM \`chiesi-committee.chiesi_committee_admin.reporting_versions\`
      ORDER BY period_month DESC, version_number DESC, created_at DESC
      LIMIT 1
    `,
  });
  const row = (rows as Array<Record<string, unknown>>)[0];
  return row?.reporting_version_id ? String(row.reporting_version_id) : null;
}

function normalizeUserKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizePeopleIdKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .trim()
    .toUpperCase();
}

function buildUserLookupKeys(value: string | null | undefined) {
  if (!value) return [];
  const raw = String(value).trim();
  if (!raw) return [];

  const keys = new Set<string>();
  keys.add(normalizeUserKey(raw));

  const atIndex = raw.indexOf('@');
  if (atIndex > 0) {
    keys.add(normalizeUserKey(raw.slice(0, atIndex)));
  }

  return Array.from(keys);
}

function toIsoDateString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    const candidate = value as { value?: unknown };
    if (typeof candidate.value === 'string' && candidate.value.trim()) {
      return candidate.value.trim();
    }
  }
  return null;
}

async function getEmployeesPeopleMap() {
  try {
    const response = await fetch('https://www.chiesihub.com/_functions/empleados', {
      method: 'GET',
      cache: 'no-store',
    });
    if (!response.ok) {
      return {
        keyToPeopleId: new Map<string, string>(),
        peopleIdProfile: new Map<string, { peopleId: string; employeeName: string | null; area: string | null }>(),
      };
    }
    const json = await response.json();
    const rows = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.items)
          ? json.items
          : [];
    const keyToPeopleId = new Map<string, string>();
    const peopleIdProfile = new Map<string, { peopleId: string; employeeName: string | null; area: string | null }>();

    for (const raw of rows as Array<Record<string, unknown>>) {
      const peopleIdRaw =
        raw.peopleId ?? raw.people_id ?? raw.personId ?? raw.person_id ?? raw.employeeId ?? raw.id;
      const userRaw = raw.user ?? raw.username ?? raw.userName;
      const emailRaw = raw.email ?? raw.mail;
      const areaRaw = raw.area ?? raw.department ?? raw.businessUnit ?? raw.business_unit;
      const employeeNameRaw = raw.nombre ?? raw.name ?? raw.displayName;
      const fullNameRaw =
        employeeNameRaw ??
        [raw.firstName, raw.lastName].filter((value) => value != null && String(value).trim()).join(' ');

      if (peopleIdRaw == null) continue;
      const peopleId = String(peopleIdRaw).trim();
      if (!peopleId) continue;

      const candidateKeys = [
        ...buildUserLookupKeys(userRaw ? String(userRaw) : null),
        ...buildUserLookupKeys(emailRaw ? String(emailRaw) : null),
        ...buildUserLookupKeys(fullNameRaw ? String(fullNameRaw) : null),
      ];

      for (const key of candidateKeys) keyToPeopleId.set(key, peopleId);

      const normalizedPeopleId = normalizePeopleIdKey(peopleId);
      if (normalizedPeopleId) {
        peopleIdProfile.set(normalizedPeopleId, {
          peopleId,
          employeeName: employeeNameRaw ? String(employeeNameRaw).trim() || null : null,
          area: areaRaw ? String(areaRaw).trim() || null : null,
        });
      }
    }

    return { keyToPeopleId, peopleIdProfile };
  } catch {
    return { keyToPeopleId: new Map<string, string>(), peopleIdProfile: new Map<string, { peopleId: string; employeeName: string | null; area: string | null }>() };
  }
}

export async function getHumanResourcesAuditSources(
  reportingVersionId?: string,
): Promise<HumanResourcesAuditSource[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH latest_turnover AS (
        SELECT reporting_version_id, period_month AS report_period_month, source_as_of_month
        FROM \`${RAW_UPLOADS}\`
        WHERE reporting_version_id = @reportingVersionId
          AND LOWER(TRIM(module_code)) = 'human_resources_turnover'
          AND status IN ('normalized', 'published')
        ORDER BY uploaded_at DESC
        LIMIT 1
      ),
      latest_training AS (
        SELECT reporting_version_id, period_month AS report_period_month, source_as_of_month
        FROM \`${RAW_UPLOADS}\`
        WHERE reporting_version_id = @reportingVersionId
          AND LOWER(TRIM(module_code)) IN ('human_resources_training', 'human_resources_entrenamiento')
          AND status IN ('normalized', 'published')
        ORDER BY uploaded_at DESC
        LIMIT 1
      )
      SELECT 'turnover' AS source_key, 'Turnover' AS source_label, * FROM latest_turnover
      UNION ALL
      SELECT 'training' AS source_key, 'Training' AS source_label, * FROM latest_training
    `,
    params: { reportingVersionId: resolvedReportingVersionId },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    sourceKey: String(row.source_key) as 'turnover' | 'training',
    sourceLabel: String(row.source_label ?? ''),
    reportingVersionId: String(row.reporting_version_id ?? resolvedReportingVersionId),
    reportPeriodMonth: toIsoDateString(row.report_period_month),
    sourceAsOfMonth: toIsoDateString(row.source_as_of_month),
  }));
}

export async function getHumanResourcesTurnoverOverview(
  reportingVersionId?: string,
): Promise<HumanResourcesTurnoverOverview | null> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH context AS (
        SELECT
          MAX(DATE(report_period_month)) AS max_report_period_month,
          EXTRACT(YEAR FROM MAX(DATE(report_period_month))) AS current_year,
          EXTRACT(MONTH FROM MAX(DATE(report_period_month))) AS current_month
        FROM \`${TURNOVER_VIEW}\`
        WHERE reporting_version_id = @reportingVersionId
      )
      SELECT
        MAX(CAST(report_period_month AS STRING)) AS report_period_month,
        MAX(CAST(source_as_of_month AS STRING)) AS source_as_of_month,
        COUNTIF(
          EXTRACT(YEAR FROM DATE(last_working_day_month)) = context.current_year
          AND EXTRACT(MONTH FROM DATE(last_working_day_month)) <= context.current_month
        ) AS ytd_exits,
        COUNTIF(
          EXTRACT(YEAR FROM DATE(last_working_day_month)) = context.current_year
          AND EXTRACT(MONTH FROM DATE(last_working_day_month)) <= context.current_month
          AND LOWER(COALESCE(vol_non_vol, '')) LIKE '%vol%'
          AND LOWER(COALESCE(vol_non_vol, '')) NOT LIKE '%non%'
          AND LOWER(COALESCE(vol_non_vol, '')) NOT LIKE '%invol%'
        ) AS ytd_voluntary_exits,
        COUNTIF(
          EXTRACT(YEAR FROM DATE(last_working_day_month)) = context.current_year
          AND EXTRACT(MONTH FROM DATE(last_working_day_month)) <= context.current_month
          AND (
            LOWER(COALESCE(vol_non_vol, '')) LIKE '%non%'
            OR LOWER(COALESCE(vol_non_vol, '')) LIKE '%invol%'
          )
        ) AS ytd_involuntary_exits
      FROM \`${TURNOVER_VIEW}\`, context
      WHERE reporting_version_id = @reportingVersionId
        AND last_working_day_month IS NOT NULL
    `,
    params: { reportingVersionId: resolvedReportingVersionId },
  });
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;

  return {
    reportPeriodMonth: toIsoDateString(row.report_period_month),
    sourceAsOfMonth: toIsoDateString(row.source_as_of_month),
    ytdExits: Number(row.ytd_exits ?? 0),
    ytdVoluntaryExits: Number(row.ytd_voluntary_exits ?? 0),
    ytdInvoluntaryExits: Number(row.ytd_involuntary_exits ?? 0),
  };
}

export async function getHumanResourcesTrainingOverview(
  reportingVersionId?: string,
): Promise<HumanResourcesTrainingOverview | null> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        MAX(CAST(report_period_month AS STRING)) AS report_period_month,
        MAX(CAST(source_as_of_month AS STRING)) AS source_as_of_month,
        COALESCE(SUM(total_hours), 0) AS ytd_total_hours,
        COUNTIF(LOWER(COALESCE(completion_status, '')) LIKE '%complete%') AS ytd_completed,
        COUNT(1) AS ytd_total_records,
        COUNT(DISTINCT NULLIF(TRIM(user_name), '')) AS ytd_active_users
      FROM \`${TRAINING_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
        AND EXTRACT(YEAR FROM period_month) = EXTRACT(YEAR FROM DATE(source_as_of_month))
        AND EXTRACT(MONTH FROM period_month) <= EXTRACT(MONTH FROM DATE(source_as_of_month))
    `,
    params: { reportingVersionId: resolvedReportingVersionId },
  });
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;

  const total = Number(row.ytd_total_records ?? 0);
  const completed = Number(row.ytd_completed ?? 0);

  return {
    reportPeriodMonth: toIsoDateString(row.report_period_month),
    sourceAsOfMonth: toIsoDateString(row.source_as_of_month),
    ytdTotalHours: Number(row.ytd_total_hours ?? 0),
    ytdCompleted: completed,
    ytdTotalRecords: total,
    ytdCompletionRate: total === 0 ? null : completed / total,
    ytdActiveUsers: Number(row.ytd_active_users ?? 0),
  };
}

export async function getHumanResourcesTurnoverDepartments(
  reportingVersionId?: string,
  limit = 12,
): Promise<HumanResourcesTurnoverDepartmentRow[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        COALESCE(NULLIF(TRIM(department), ''), 'Unassigned') AS department,
        COUNT(1) AS exits,
        COUNTIF(LOWER(COALESCE(vol_non_vol, '')) LIKE '%vol%') AS voluntary_exits,
        COUNTIF(LOWER(COALESCE(vol_non_vol, '')) LIKE '%non%' OR LOWER(COALESCE(vol_non_vol, '')) LIKE '%invol%') AS involuntary_exits
      FROM \`${TURNOVER_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
        AND EXTRACT(YEAR FROM period_month) = EXTRACT(YEAR FROM DATE(source_as_of_month))
        AND EXTRACT(MONTH FROM period_month) <= EXTRACT(MONTH FROM DATE(source_as_of_month))
      GROUP BY 1
      ORDER BY exits DESC
      LIMIT @limit
    `,
    params: { reportingVersionId: resolvedReportingVersionId, limit },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    department: String(row.department ?? 'Unassigned'),
    exits: Number(row.exits ?? 0),
    voluntaryExits: Number(row.voluntary_exits ?? 0),
    involuntaryExits: Number(row.involuntary_exits ?? 0),
  }));
}

export async function getHumanResourcesTrainingUsers(
  reportingVersionId?: string,
  limit = 15,
): Promise<HumanResourcesTrainingUserRow[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];
  const client = getBigQueryClient();
  const [queryResult, peopleLookup] = await Promise.all([
    client.query({
      query: `
        SELECT
          COALESCE(NULLIF(TRIM(user_name), ''), CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS user_name,
          COALESCE(SUM(total_hours), 0) AS total_hours,
          COUNTIF(LOWER(COALESCE(completion_status, '')) LIKE '%complete%') AS completed_records,
          COUNT(1) AS total_records
        FROM \`${TRAINING_VIEW}\`
        WHERE reporting_version_id = @reportingVersionId
          AND EXTRACT(YEAR FROM period_month) = EXTRACT(YEAR FROM DATE(source_as_of_month))
          AND EXTRACT(MONTH FROM period_month) <= EXTRACT(MONTH FROM DATE(source_as_of_month))
        GROUP BY 1
        ORDER BY total_hours DESC
        LIMIT @limit
      `,
      params: { reportingVersionId: resolvedReportingVersionId, limit },
    }),
    getEmployeesPeopleMap(),
  ]);

  const typedRows = queryResult[0] as Array<Record<string, unknown>>;
  return typedRows.map((row) => {
    const userName = String(row.user_name ?? 'Unknown User').trim() || 'Unknown User';
    const totalRecords = Number(row.total_records ?? 0);
    const completed = Number(row.completed_records ?? 0);
    const userCandidates = buildUserLookupKeys(userName);
    const matchedPeopleIdFromKey =
      userCandidates.map((key) => peopleLookup.keyToPeopleId.get(key)).find((value) => Boolean(value)) ?? null;
    const matchedPeopleId =
      matchedPeopleIdFromKey ?? peopleLookup.peopleIdProfile.get(normalizePeopleIdKey(userName))?.peopleId ?? null;
    const profile =
      (matchedPeopleId ? peopleLookup.peopleIdProfile.get(normalizePeopleIdKey(matchedPeopleId)) : null) ??
      peopleLookup.peopleIdProfile.get(normalizePeopleIdKey(userName)) ??
      null;
    return {
      userName,
      peopleId: matchedPeopleId,
      employeeName: profile?.employeeName ?? null,
      area: profile?.area ?? null,
      totalHours: Number(row.total_hours ?? 0),
      completedRecords: completed,
      totalRecords,
      completionRate: totalRecords === 0 ? null : completed / totalRecords,
    };
  });
}

export async function getHumanResourcesTrainingThemeData(
  reportingVersionId?: string,
  scope: HumanResourcesTrainingScope = 'total',
): Promise<HumanResourcesTrainingThemeData | null> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;
  const scopeFilter = toTrainingScopeFilter(scope);
  const client = getBigQueryClient();

  const baseCte = `
    WITH context AS (
      SELECT
        MAX(DATE(report_period_month)) AS max_report_period_month,
        EXTRACT(YEAR FROM MAX(DATE(report_period_month))) AS current_year,
        EXTRACT(MONTH FROM MAX(DATE(report_period_month))) AS current_month
      FROM \`${TRAINING_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
    ),
    base AS (
      SELECT
        user_name,
        active_user,
        item_type,
        entity_type,
        completion_status,
        entity_title,
        completion_date_month,
        item_revision_date_month,
        total_hours,
        credit_hours_professional_associations,
        contact_hours,
        cpe,
        tuition,
        CASE
          WHEN LOWER(COALESCE(completion_status, '')) LIKE '%complete%' THEN TRUE
          ELSE FALSE
        END AS recommended_valid_completion_flag,
        DATE_DIFF(DATE(completion_date_month), DATE(item_revision_date_month), MONTH) AS content_age_at_completion_months
      FROM \`${TRAINING_VIEW}\`, context
      WHERE reporting_version_id = @reportingVersionId
        AND ${scopeFilter}
        AND completion_date_month IS NOT NULL
        AND EXTRACT(MONTH FROM DATE(completion_date_month)) <= context.current_month
        AND EXTRACT(YEAR FROM DATE(completion_date_month)) IN (context.current_year, context.current_year - 1)
    ),
    tagged AS (
      SELECT
        *,
        EXTRACT(YEAR FROM DATE(completion_date_month)) AS completion_year
      FROM base
    )
  `;

  const [summaryRows, itemTypeMixRows, completionStatusMixRows, topContentRows, monthlyTrendRows, concentrationRows, freshnessRows, creditsRows, tuitionRows] =
    await Promise.all([
      client.query({
        query: `
          ${baseCte}
          SELECT
            COUNT(DISTINCT IF(completion_year = context.current_year AND recommended_valid_completion_flag, user_name, NULL)) AS trained_employees_ytd,
            COUNT(DISTINCT IF(completion_year = context.current_year AND LOWER(COALESCE(active_user, '')) = 'yes', user_name, NULL)) AS active_employees_ytd,
            COUNTIF(completion_year = context.current_year AND recommended_valid_completion_flag) AS completed_events_ytd,
            COALESCE(SUM(IF(completion_year = context.current_year AND recommended_valid_completion_flag, total_hours, 0)), 0) AS learning_hours_ytd,
            COUNT(DISTINCT IF(completion_year = context.current_year - 1 AND recommended_valid_completion_flag, user_name, NULL)) AS trained_employees_py,
            COUNTIF(completion_year = context.current_year - 1 AND recommended_valid_completion_flag) AS completed_events_py,
            COALESCE(SUM(IF(completion_year = context.current_year - 1 AND recommended_valid_completion_flag, total_hours, 0)), 0) AS learning_hours_py
          FROM tagged, context
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte},
          totals AS (
            SELECT
              COUNTIF(completion_year = context.current_year AND recommended_valid_completion_flag) AS total_events,
              COALESCE(SUM(IF(completion_year = context.current_year AND recommended_valid_completion_flag, total_hours, 0)), 0) AS total_hours
            FROM tagged, context
          )
          SELECT
            COALESCE(NULLIF(TRIM(item_type), ''), 'Unspecified') AS label,
            COUNTIF(completion_year = context.current_year AND recommended_valid_completion_flag) AS ytd_events,
            COALESCE(SUM(IF(completion_year = context.current_year AND recommended_valid_completion_flag, total_hours, 0)), 0) AS ytd_hours,
            COUNT(DISTINCT IF(completion_year = context.current_year AND recommended_valid_completion_flag, user_name, NULL)) AS ytd_employees,
            SAFE_DIVIDE(COUNTIF(completion_year = context.current_year AND recommended_valid_completion_flag), NULLIF((SELECT total_events FROM totals), 0)) AS events_share_pct,
            SAFE_DIVIDE(COALESCE(SUM(IF(completion_year = context.current_year AND recommended_valid_completion_flag, total_hours, 0)), 0), NULLIF((SELECT total_hours FROM totals), 0)) AS hours_share_pct
          FROM tagged, context
          GROUP BY 1
          ORDER BY ytd_events DESC
          LIMIT 8
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte},
          totals AS (
            SELECT
              COUNTIF(completion_year = context.current_year) AS total_events,
              COALESCE(SUM(IF(completion_year = context.current_year, total_hours, 0)), 0) AS total_hours
            FROM tagged, context
          )
          SELECT
            COALESCE(NULLIF(TRIM(completion_status), ''), 'Unspecified') AS label,
            COUNTIF(completion_year = context.current_year) AS ytd_events,
            COALESCE(SUM(IF(completion_year = context.current_year, total_hours, 0)), 0) AS ytd_hours,
            COUNT(DISTINCT IF(completion_year = context.current_year, user_name, NULL)) AS ytd_employees,
            SAFE_DIVIDE(COUNTIF(completion_year = context.current_year), NULLIF((SELECT total_events FROM totals), 0)) AS events_share_pct,
            SAFE_DIVIDE(COALESCE(SUM(IF(completion_year = context.current_year, total_hours, 0)), 0), NULLIF((SELECT total_hours FROM totals), 0)) AS hours_share_pct
          FROM tagged, context
          GROUP BY 1
          ORDER BY ytd_events DESC
          LIMIT 8
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte}
          SELECT
            COALESCE(NULLIF(TRIM(entity_title), ''), 'Untitled') AS entity_title,
            COUNTIF(completion_year = context.current_year AND recommended_valid_completion_flag) AS ytd_events,
            COALESCE(SUM(IF(completion_year = context.current_year AND recommended_valid_completion_flag, total_hours, 0)), 0) AS ytd_hours,
            COUNT(DISTINCT IF(completion_year = context.current_year AND recommended_valid_completion_flag, user_name, NULL)) AS ytd_employees,
            MAX(CAST(item_revision_date_month AS STRING)) AS latest_revision_month,
            MAX(CAST(completion_date_month AS STRING)) AS latest_completion_month
          FROM tagged, context
          GROUP BY 1
          ORDER BY ytd_events DESC
          LIMIT 10
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte}
          SELECT
            FORMAT_DATE('%b', DATE(completion_date_month)) AS month_label,
            EXTRACT(MONTH FROM DATE(completion_date_month)) AS month_order,
            COUNTIF(completion_year = context.current_year AND recommended_valid_completion_flag) AS current_year_events,
            COUNTIF(completion_year = context.current_year - 1 AND recommended_valid_completion_flag) AS previous_year_events,
            COALESCE(SUM(IF(completion_year = context.current_year AND recommended_valid_completion_flag, total_hours, 0)), 0) AS current_year_hours,
            COALESCE(SUM(IF(completion_year = context.current_year - 1 AND recommended_valid_completion_flag, total_hours, 0)), 0) AS previous_year_hours,
            COUNT(DISTINCT IF(completion_year = context.current_year AND recommended_valid_completion_flag, user_name, NULL)) AS current_year_employees,
            COUNT(DISTINCT IF(completion_year = context.current_year - 1 AND recommended_valid_completion_flag, user_name, NULL)) AS previous_year_employees
          FROM tagged, context
          GROUP BY 1,2
          ORDER BY 2
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte},
          current_valid AS (
            SELECT
              user_name,
              COUNT(1) AS events_count,
              COALESCE(SUM(total_hours), 0) AS hours_count
            FROM tagged, context
            WHERE completion_year = context.current_year
              AND recommended_valid_completion_flag
            GROUP BY user_name
          ),
          ranked AS (
            SELECT
              user_name,
              events_count,
              hours_count,
              ROW_NUMBER() OVER (ORDER BY hours_count DESC) AS rn_hours,
              ROW_NUMBER() OVER (ORDER BY events_count DESC) AS rn_events,
              COUNT(*) OVER () AS users_total,
              SUM(hours_count) OVER () AS total_hours,
              SUM(events_count) OVER () AS total_events
            FROM current_valid
          )
          SELECT
            SAFE_DIVIDE(
              SUM(IF(rn_hours <= CAST(CEIL(users_total * 0.10) AS INT64), hours_count, 0)),
              NULLIF(MAX(total_hours), 0)
            ) AS top10_users_hours_share_pct,
            SAFE_DIVIDE(
              SUM(IF(rn_events <= CAST(CEIL(users_total * 0.20) AS INT64), events_count, 0)),
              NULLIF(MAX(total_events), 0)
            ) AS top20_users_events_share_pct
          FROM ranked
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte}
          SELECT
            SAFE_DIVIDE(COUNTIF(completion_year = context.current_year AND content_age_at_completion_months <= 6), NULLIF(COUNTIF(completion_year = context.current_year), 0)) AS recent_revision_share_pct,
            SAFE_DIVIDE(COUNTIF(completion_year = context.current_year AND content_age_at_completion_months > 12), NULLIF(COUNTIF(completion_year = context.current_year), 0)) AS content_older_than_12_months_share_pct
          FROM tagged, context
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte}
          SELECT
            COALESCE(SUM(IF(completion_year = context.current_year, credit_hours_professional_associations, 0)), 0) AS total_professional_credits_ytd,
            COALESCE(SUM(IF(completion_year = context.current_year, contact_hours, 0)), 0) AS total_contact_hours_ytd,
            COALESCE(SUM(IF(completion_year = context.current_year, cpe, 0)), 0) AS total_cpe_ytd,
            SAFE_DIVIDE(
              COUNTIF(completion_year = context.current_year AND (COALESCE(credit_hours_professional_associations, 0) > 0 OR COALESCE(contact_hours, 0) > 0 OR COALESCE(cpe, 0) > 0)),
              NULLIF(COUNTIF(completion_year = context.current_year), 0)
            ) AS credits_event_share_pct
          FROM tagged, context
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte}
          SELECT
            COALESCE(SUM(IF(completion_year = context.current_year, tuition, 0)), 0) AS tuition_ytd,
            SAFE_DIVIDE(COUNTIF(completion_year = context.current_year AND COALESCE(tuition, 0) > 0), NULLIF(COUNTIF(completion_year = context.current_year), 0)) AS paid_training_share_pct,
            SAFE_DIVIDE(COUNTIF(completion_year = context.current_year AND COALESCE(tuition, 0) = 0), NULLIF(COUNTIF(completion_year = context.current_year), 0)) AS zero_cost_training_share_pct
          FROM tagged, context
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
    ]);

  const summaryRow = (summaryRows[0] as Array<Record<string, unknown>>)[0] ?? {};
  const trainedEmployeesYtd = Number(summaryRow.trained_employees_ytd ?? 0);
  const activeEmployeesYtd = Number(summaryRow.active_employees_ytd ?? 0);
  const completedEventsYtd = Number(summaryRow.completed_events_ytd ?? 0);
  const learningHoursYtd = Number(summaryRow.learning_hours_ytd ?? 0);
  const trainedEmployeesPy = Number(summaryRow.trained_employees_py ?? 0);
  const completedEventsPy = Number(summaryRow.completed_events_py ?? 0);
  const learningHoursPy = Number(summaryRow.learning_hours_py ?? 0);

  const summary: HumanResourcesTrainingThemeData['summary'] = {
    trainedEmployeesYtd,
    activeEmployeesYtd,
    coverageRateYtd: activeEmployeesYtd === 0 ? null : trainedEmployeesYtd / activeEmployeesYtd,
    completedEventsYtd,
    learningHoursYtd,
    avgHoursPerTrainedEmployeeYtd:
      trainedEmployeesYtd === 0 ? null : learningHoursYtd / trainedEmployeesYtd,
    avgTrainingsPerTrainedEmployeeYtd:
      trainedEmployeesYtd === 0 ? null : completedEventsYtd / trainedEmployeesYtd,
    avgHoursPerEventYtd: completedEventsYtd === 0 ? null : learningHoursYtd / completedEventsYtd,
    trainedEmployeesPy,
    completedEventsPy,
    learningHoursPy,
    growthVsPyTrainedEmployeesPct:
      trainedEmployeesPy === 0 ? null : (trainedEmployeesYtd - trainedEmployeesPy) / trainedEmployeesPy,
    growthVsPyCompletedEventsPct:
      completedEventsPy === 0 ? null : (completedEventsYtd - completedEventsPy) / completedEventsPy,
    growthVsPyLearningHoursPct:
      learningHoursPy === 0 ? null : (learningHoursYtd - learningHoursPy) / learningHoursPy,
  };

  const itemTypeMix = (itemTypeMixRows[0] as Array<Record<string, unknown>>).map((row) => ({
    label: String(row.label ?? 'Unspecified'),
    ytdEvents: Number(row.ytd_events ?? 0),
    ytdHours: Number(row.ytd_hours ?? 0),
    ytdEmployees: Number(row.ytd_employees ?? 0),
    eventsSharePct: row.events_share_pct == null ? null : Number(row.events_share_pct),
    hoursSharePct: row.hours_share_pct == null ? null : Number(row.hours_share_pct),
  }));

  const completionStatusMix = (completionStatusMixRows[0] as Array<Record<string, unknown>>).map((row) => ({
    label: String(row.label ?? 'Unspecified'),
    ytdEvents: Number(row.ytd_events ?? 0),
    ytdHours: Number(row.ytd_hours ?? 0),
    ytdEmployees: Number(row.ytd_employees ?? 0),
    eventsSharePct: row.events_share_pct == null ? null : Number(row.events_share_pct),
    hoursSharePct: row.hours_share_pct == null ? null : Number(row.hours_share_pct),
  }));

  const topContent = mapTrainingContentRows(topContentRows[0] as Array<Record<string, unknown>>);
  const monthlyTrend = (monthlyTrendRows[0] as Array<Record<string, unknown>>).map((row) => ({
    monthLabel: String(row.month_label ?? ''),
    monthOrder: Number(row.month_order ?? 0),
    currentYearEvents: Number(row.current_year_events ?? 0),
    previousYearEvents: Number(row.previous_year_events ?? 0),
    currentYearHours: Number(row.current_year_hours ?? 0),
    previousYearHours: Number(row.previous_year_hours ?? 0),
    currentYearEmployees: Number(row.current_year_employees ?? 0),
    previousYearEmployees: Number(row.previous_year_employees ?? 0),
  }));

  const concentrationRow = (concentrationRows[0] as Array<Record<string, unknown>>)[0] ?? {};
  const freshnessRow = (freshnessRows[0] as Array<Record<string, unknown>>)[0] ?? {};
  const creditsRow = (creditsRows[0] as Array<Record<string, unknown>>)[0] ?? {};
  const tuitionRow = (tuitionRows[0] as Array<Record<string, unknown>>)[0] ?? {};

  const top10UsersHoursSharePct =
    concentrationRow.top10_users_hours_share_pct == null
      ? null
      : Number(concentrationRow.top10_users_hours_share_pct);
  const top20UsersEventsSharePct =
    concentrationRow.top20_users_events_share_pct == null
      ? null
      : Number(concentrationRow.top20_users_events_share_pct);

  const recentRevisionSharePct =
    freshnessRow.recent_revision_share_pct == null ? null : Number(freshnessRow.recent_revision_share_pct);
  const contentOlderThan12MonthsSharePct =
    freshnessRow.content_older_than_12_months_share_pct == null
      ? null
      : Number(freshnessRow.content_older_than_12_months_share_pct);

  const totalProfessionalCreditsYtd = Number(creditsRow.total_professional_credits_ytd ?? 0);
  const totalContactHoursYtd = Number(creditsRow.total_contact_hours_ytd ?? 0);
  const totalCpeYtd = Number(creditsRow.total_cpe_ytd ?? 0);
  const creditsEventSharePct =
    creditsRow.credits_event_share_pct == null ? null : Number(creditsRow.credits_event_share_pct);

  const tuitionYtd = Number(tuitionRow.tuition_ytd ?? 0);
  const paidTrainingSharePct =
    tuitionRow.paid_training_share_pct == null ? null : Number(tuitionRow.paid_training_share_pct);
  const zeroCostTrainingSharePct =
    tuitionRow.zero_cost_training_share_pct == null ? null : Number(tuitionRow.zero_cost_training_share_pct);

  const insights = buildTrainingInsights({
    summary,
    top10UsersHoursSharePct,
    top20UsersEventsSharePct,
    dominantItemType: itemTypeMix[0],
    recentRevisionSharePct,
    contentOlderThan12MonthsSharePct,
    zeroCostTrainingSharePct,
  });

  return {
    scope,
    summary,
    itemTypeMix,
    completionStatusMix,
    topContent,
    monthlyTrend,
    top10UsersHoursSharePct,
    top20UsersEventsSharePct,
    totalProfessionalCreditsYtd,
    totalContactHoursYtd,
    totalCpeYtd,
    creditsEventSharePct,
    tuitionYtd,
    paidTrainingSharePct,
    zeroCostTrainingSharePct,
    recentRevisionSharePct,
    contentOlderThan12MonthsSharePct,
    insights,
  };
}

export async function getHumanResourcesTrainingRanking(
  reportingVersionId?: string,
  scope: HumanResourcesTrainingScope = 'total',
  dimension: HumanResourcesTrainingRankingDimension = 'area',
  limit = 20,
): Promise<HumanResourcesTrainingRankingRow[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];
  const scopeFilter = toTrainingScopeFilter(scope);
  const client = getBigQueryClient();

  const baseCte = `
    WITH context AS (
      SELECT
        MAX(DATE(report_period_month)) AS max_report_period_month,
        EXTRACT(YEAR FROM MAX(DATE(report_period_month))) AS current_year,
        EXTRACT(MONTH FROM MAX(DATE(report_period_month))) AS current_month
      FROM \`${TRAINING_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
    ),
    base AS (
      SELECT
        user_name,
        item_type,
        entity_title,
        instructor,
        completion_status,
        completion_date_month,
        total_hours,
        CASE
          WHEN LOWER(COALESCE(completion_status, '')) LIKE '%complete%' THEN TRUE
          ELSE FALSE
        END AS recommended_valid_completion_flag
      FROM \`${TRAINING_VIEW}\`, context
      WHERE reporting_version_id = @reportingVersionId
        AND ${scopeFilter}
        AND completion_date_month IS NOT NULL
        AND EXTRACT(MONTH FROM DATE(completion_date_month)) <= context.current_month
        AND EXTRACT(YEAR FROM DATE(completion_date_month)) = context.current_year
    )
  `;

  if (dimension === 'area') {
    const [queryResult, peopleLookup] = await Promise.all([
      client.query({
        query: `
          ${baseCte}
          SELECT
            COALESCE(NULLIF(TRIM(user_name), ''), 'Unknown User') AS user_name,
            COUNTIF(recommended_valid_completion_flag) AS events,
            COALESCE(SUM(IF(recommended_valid_completion_flag, total_hours, 0)), 0) AS hours
          FROM base
          GROUP BY 1
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      getEmployeesPeopleMap(),
    ]);

    const rows = queryResult[0] as Array<Record<string, unknown>>;
    const aggregate = new Map<string, { events: number; hours: number; users: Set<string> }>();

    for (const row of rows) {
      const userName = String(row.user_name ?? 'Unknown User');
      const userCandidates = buildUserLookupKeys(userName);
      const matchedPeopleIdFromKey =
        userCandidates.map((key) => peopleLookup.keyToPeopleId.get(key)).find((value) => Boolean(value)) ?? null;
      const matchedPeopleId =
        matchedPeopleIdFromKey ?? peopleLookup.peopleIdProfile.get(normalizePeopleIdKey(userName))?.peopleId ?? null;
      const profile =
        (matchedPeopleId ? peopleLookup.peopleIdProfile.get(normalizePeopleIdKey(matchedPeopleId)) : null) ??
        peopleLookup.peopleIdProfile.get(normalizePeopleIdKey(userName)) ??
        null;
      const area = profile?.area?.trim() ? profile.area.trim() : 'Ungrouped';
      if (!aggregate.has(area)) aggregate.set(area, { events: 0, hours: 0, users: new Set<string>() });
      const bucket = aggregate.get(area)!;
      bucket.events += Number(row.events ?? 0);
      bucket.hours += Number(row.hours ?? 0);
      bucket.users.add(userName);
    }

    return Array.from(aggregate.entries())
      .map(([label, values]) => ({
        label,
        events: values.events,
        hours: values.hours,
        employees: values.users.size,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, limit);
  }

  const dimensionExprByType: Record<Exclude<HumanResourcesTrainingRankingDimension, 'area'>, string> = {
    entity_title: "COALESCE(NULLIF(TRIM(entity_title), ''), 'Untitled')",
    item_type: "COALESCE(NULLIF(TRIM(item_type), ''), 'Unspecified')",
    instructor: "COALESCE(NULLIF(TRIM(instructor), ''), 'Unassigned')",
  };
  const labelExpr = dimensionExprByType[dimension];
  const [rows] = await client.query({
    query: `
      ${baseCte}
      SELECT
        ${labelExpr} AS label,
        COUNTIF(recommended_valid_completion_flag) AS events,
        COALESCE(SUM(IF(recommended_valid_completion_flag, total_hours, 0)), 0) AS hours,
        COUNT(DISTINCT IF(recommended_valid_completion_flag, user_name, NULL)) AS employees
      FROM base
      GROUP BY 1
      ORDER BY hours DESC
      LIMIT @limit
    `,
    params: { reportingVersionId: resolvedReportingVersionId, limit },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    label: String(row.label ?? 'Unspecified'),
    events: Number(row.events ?? 0),
    hours: Number(row.hours ?? 0),
    employees: Number(row.employees ?? 0),
  }));
}

export async function getHumanResourcesTurnoverQuarterly(
  reportingVersionId?: string,
): Promise<HumanResourcesTurnoverQuarterRow[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH context AS (
        SELECT
          EXTRACT(YEAR FROM MAX(DATE(source_as_of_month))) AS current_year
        FROM \`${TURNOVER_VIEW}\`
        WHERE reporting_version_id = @reportingVersionId
      ),
      scoped AS (
        SELECT
          CONCAT('Q', CAST(COALESCE(SAFE_CAST(REGEXP_EXTRACT(COALESCE(quarter, ''), r'([1-4])') AS INT64), EXTRACT(QUARTER FROM period_month)) AS STRING)) AS quarter_label,
          EXTRACT(YEAR FROM period_month) AS year_value,
          COUNT(1) AS exits
        FROM \`${TURNOVER_VIEW}\`, context
        WHERE reporting_version_id = @reportingVersionId
          AND EXTRACT(YEAR FROM period_month) IN (context.current_year, context.current_year - 1)
        GROUP BY 1, 2
      ),
      pivoted AS (
        SELECT
          quarter_label,
          SUM(IF(year_value = context.current_year, exits, 0)) AS exits_current_year,
          SUM(IF(year_value = context.current_year - 1, exits, 0)) AS exits_previous_year
        FROM scoped, context
        GROUP BY quarter_label
      ),
      ordered AS (
        SELECT
          quarter_label,
          exits_current_year,
          exits_previous_year,
          SAFE_CAST(REGEXP_EXTRACT(quarter_label, r'([1-4])') AS INT64) AS quarter_order
        FROM pivoted
      ),
      totals AS (
        SELECT
          SUM(exits_current_year) AS total_current_year,
          SUM(exits_previous_year) AS total_previous_year
        FROM ordered
      )
      SELECT
        quarter_label,
        exits_current_year,
        exits_previous_year,
        SAFE_DIVIDE(
          SUM(exits_current_year) OVER (ORDER BY quarter_order),
          NULLIF((SELECT total_current_year FROM totals), 0)
        ) AS cumulative_current_year_pct,
        SAFE_DIVIDE(
          SUM(exits_previous_year) OVER (ORDER BY quarter_order),
          NULLIF((SELECT total_previous_year FROM totals), 0)
        ) AS cumulative_previous_year_pct
      FROM ordered
      ORDER BY quarter_order
    `,
    params: { reportingVersionId: resolvedReportingVersionId },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    quarter: String(row.quarter_label ?? 'Q?'),
    exitsCurrentYear: Number(row.exits_current_year ?? 0),
    exitsPreviousYear: Number(row.exits_previous_year ?? 0),
    cumulativeCurrentYearPct:
      row.cumulative_current_year_pct == null ? null : Number(row.cumulative_current_year_pct),
    cumulativePreviousYearPct:
      row.cumulative_previous_year_pct == null ? null : Number(row.cumulative_previous_year_pct),
  }));
}

export async function getHumanResourcesTurnoverReasonBreakdown(
  reportingVersionId?: string,
  limit = 10,
): Promise<HumanResourcesTurnoverReasonRow[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH context AS (
        SELECT EXTRACT(YEAR FROM MAX(DATE(source_as_of_month))) AS current_year
        FROM \`${TURNOVER_VIEW}\`
        WHERE reporting_version_id = @reportingVersionId
      )
      SELECT
        COALESCE(NULLIF(TRIM(termination_ad_rationale), ''), 'Unspecified') AS reason,
        COUNTIF(LOWER(COALESCE(vol_non_vol, '')) LIKE '%vol%' AND LOWER(COALESCE(vol_non_vol, '')) NOT LIKE '%non%') AS voluntary_exits,
        COUNTIF(LOWER(COALESCE(vol_non_vol, '')) LIKE '%non%' OR LOWER(COALESCE(vol_non_vol, '')) LIKE '%invol%') AS involuntary_exits,
        COUNT(1) AS total_exits
      FROM \`${TURNOVER_VIEW}\`, context
      WHERE reporting_version_id = @reportingVersionId
        AND EXTRACT(YEAR FROM period_month) = context.current_year
      GROUP BY 1
      ORDER BY total_exits DESC
      LIMIT @limit
    `,
    params: { reportingVersionId: resolvedReportingVersionId, limit },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    reason: String(row.reason ?? 'Unspecified'),
    voluntaryExits: Number(row.voluntary_exits ?? 0),
    involuntaryExits: Number(row.involuntary_exits ?? 0),
    totalExits: Number(row.total_exits ?? 0),
  }));
}

export async function getHumanResourcesTurnoverSeniorityBreakdown(
  reportingVersionId?: string,
): Promise<HumanResourcesTurnoverSeniorityRow[]> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return [];
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH context AS (
        SELECT EXTRACT(YEAR FROM MAX(DATE(source_as_of_month))) AS current_year
        FROM \`${TURNOVER_VIEW}\`
        WHERE reporting_version_id = @reportingVersionId
      ),
      scoped AS (
        SELECT
          CASE
            WHEN years IS NOT NULL AND years < 1 THEN '< 1 Year'
            WHEN years IS NOT NULL AND years < 4 THEN '1 - 3 Years'
            WHEN years IS NOT NULL AND years <= 10 THEN '4 - 10 Years'
            WHEN years IS NOT NULL AND years > 10 THEN '> 10 Years'
            ELSE COALESCE(NULLIF(TRIM(seniority_cluster), ''), 'Unspecified')
          END AS seniority_band,
          vol_non_vol
        FROM \`${TURNOVER_VIEW}\`, context
        WHERE reporting_version_id = @reportingVersionId
          AND EXTRACT(YEAR FROM period_month) = context.current_year
      )
      SELECT
        seniority_band,
        COUNTIF(LOWER(COALESCE(vol_non_vol, '')) LIKE '%vol%' AND LOWER(COALESCE(vol_non_vol, '')) NOT LIKE '%non%') AS voluntary_exits,
        COUNTIF(LOWER(COALESCE(vol_non_vol, '')) LIKE '%non%' OR LOWER(COALESCE(vol_non_vol, '')) LIKE '%invol%') AS involuntary_exits,
        COUNT(1) AS total_exits
      FROM scoped
      GROUP BY 1
      ORDER BY
        CASE seniority_band
          WHEN '< 1 Year' THEN 1
          WHEN '1 - 3 Years' THEN 2
          WHEN '4 - 10 Years' THEN 3
          WHEN '> 10 Years' THEN 4
          ELSE 5
        END,
        total_exits DESC
    `,
    params: { reportingVersionId: resolvedReportingVersionId },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    seniorityBand: String(row.seniority_band ?? 'Unspecified'),
    voluntaryExits: Number(row.voluntary_exits ?? 0),
    involuntaryExits: Number(row.involuntary_exits ?? 0),
    totalExits: Number(row.total_exits ?? 0),
  }));
}

function toScopeFilter(scope: HumanResourcesTurnoverScope) {
  if (scope === 'voluntary') {
    return `
      LOWER(COALESCE(vol_non_vol, '')) LIKE '%vol%'
      AND LOWER(COALESCE(vol_non_vol, '')) NOT LIKE '%non%'
      AND LOWER(COALESCE(vol_non_vol, '')) NOT LIKE '%invol%'
    `;
  }
  if (scope === 'involuntary') {
    return `
      LOWER(COALESCE(vol_non_vol, '')) LIKE '%non%'
      OR LOWER(COALESCE(vol_non_vol, '')) LIKE '%invol%'
    `;
  }
  return 'TRUE';
}

function mapThemeItems(rows: Array<Record<string, unknown>>): HumanResourcesTurnoverThemeItem[] {
  return rows.map((row) => ({
    label: String(row.label ?? 'Unspecified'),
    currentYtdExits: Number(row.current_ytd_exits ?? 0),
    previousYtdExits: Number(row.previous_ytd_exits ?? 0),
    growthVsPyPct: row.growth_vs_py_pct == null ? null : Number(row.growth_vs_py_pct),
    contributionPct: row.contribution_pct == null ? null : Number(row.contribution_pct),
  }));
}

function mapMonthlyTrendRows(rows: Array<Record<string, unknown>>): HumanResourcesTurnoverMonthlyTrendRow[] {
  return rows.map((row) => ({
    monthLabel: String(row.month_label ?? ''),
    monthOrder: Number(row.month_order ?? 0),
    currentYearExits: Number(row.current_year_exits ?? 0),
    previousYearExits: Number(row.previous_year_exits ?? 0),
    currentYearCumulativeExits: Number(row.current_year_cumulative_exits ?? 0),
    previousYearCumulativeExits: Number(row.previous_year_cumulative_exits ?? 0),
  }));
}

function toTrainingScopeFilter(scope: HumanResourcesTrainingScope) {
  if (scope === 'online') {
    return "LOWER(COALESCE(item_type, '')) LIKE '%online%'";
  }
  if (scope === 'face_to_face') {
    return "LOWER(COALESCE(item_type, '')) LIKE '%face%'";
  }
  return 'TRUE';
}

function mapTrainingContentRows(rows: Array<Record<string, unknown>>): HumanResourcesTrainingContentRow[] {
  return rows.map((row) => ({
    entityTitle: String(row.entity_title ?? 'Untitled'),
    ytdEvents: Number(row.ytd_events ?? 0),
    ytdHours: Number(row.ytd_hours ?? 0),
    ytdEmployees: Number(row.ytd_employees ?? 0),
    latestRevisionMonth: row.latest_revision_month ? String(row.latest_revision_month) : null,
    latestCompletionMonth: row.latest_completion_month ? String(row.latest_completion_month) : null,
  }));
}

function buildTrainingInsights(input: {
  summary: HumanResourcesTrainingThemeData['summary'];
  top10UsersHoursSharePct: number | null;
  top20UsersEventsSharePct: number | null;
  dominantItemType?: HumanResourcesTrainingThemeData['itemTypeMix'][number];
  recentRevisionSharePct: number | null;
  contentOlderThan12MonthsSharePct: number | null;
  zeroCostTrainingSharePct: number | null;
}): HumanResourcesTrainingInsights[] {
  const rows: HumanResourcesTrainingInsights[] = [];
  const hasPyBase =
    input.summary.learningHoursPy > 0 ||
    input.summary.completedEventsPy > 0 ||
    input.summary.trainedEmployeesPy > 0;

  if (hasPyBase && input.summary.growthVsPyLearningHoursPct !== null) {
    if ((input.summary.growthVsPyLearningHoursPct ?? 0) > 0) {
      rows.push({
        type: 'performance',
        title: 'Learning Hours Above PY',
        message: `Learning hours are +${((input.summary.growthVsPyLearningHoursPct ?? 0) * 100).toFixed(1)}% vs PY YTD.`,
        severity: 'positive',
      });
    } else {
      rows.push({
        type: 'performance',
        title: 'Learning Hours Under PY',
        message: `Learning hours are ${((input.summary.growthVsPyLearningHoursPct ?? 0) * 100).toFixed(1)}% vs PY YTD.`,
        severity: 'warning',
      });
    }
  }

  if ((input.summary.coverageRateYtd ?? 0) < 0.7) {
    rows.push({
      type: 'coverage',
      title: 'Coverage Gap',
      message: `Coverage is ${((input.summary.coverageRateYtd ?? 0) * 100).toFixed(1)}% of active employees.`,
      severity: 'warning',
    });
  }

  if ((input.top10UsersHoursSharePct ?? 0) >= 0.45 || (input.top20UsersEventsSharePct ?? 0) >= 0.55) {
    rows.push({
      type: 'concentration',
      title: 'Learning Concentration',
      message: `Top 10% users explain ${((input.top10UsersHoursSharePct ?? 0) * 100).toFixed(1)}% of hours.`,
      severity: 'warning',
    });
  }

  if (input.dominantItemType) {
    rows.push({
      type: 'mix',
      title: 'Dominant Learning Mix',
      message: `${input.dominantItemType.label} leads with ${((input.dominantItemType.eventsSharePct ?? 0) * 100).toFixed(1)}% of events.`,
      severity: 'neutral',
    });
  }

  if ((input.contentOlderThan12MonthsSharePct ?? 0) >= 0.3) {
    rows.push({
      type: 'freshness',
      title: 'Content Freshness Risk',
      message: `${((input.contentOlderThan12MonthsSharePct ?? 0) * 100).toFixed(1)}% of events use content older than 12 months.`,
      severity: 'warning',
    });
  } else if (input.recentRevisionSharePct != null) {
    rows.push({
      type: 'freshness',
      title: 'Content Freshness',
      message: `${(input.recentRevisionSharePct * 100).toFixed(1)}% of events are based on recently revised content (<= 6 months).`,
      severity: 'positive',
    });
  }

  if ((input.zeroCostTrainingSharePct ?? 0) >= 0.8) {
    rows.push({
      type: 'economic',
      title: 'Zero-Cost Driven Learning',
      message: `${((input.zeroCostTrainingSharePct ?? 0) * 100).toFixed(1)}% of events are recorded with zero tuition.`,
      severity: 'neutral',
    });
  }

  return rows.slice(0, 6);
}

function buildInsightItems(input: {
  currentYtdExits: number;
  previousYtdExits: number;
  targetYtdExits: number;
  earlyAttritionShare: number;
  topDepartment?: HumanResourcesTurnoverThemeItem;
  topReason?: HumanResourcesTurnoverThemeItem;
  keyPositionShare: number;
}): HumanResourcesTurnoverInsightItem[] {
  const items: HumanResourcesTurnoverInsightItem[] = [];
  const varianceVsTarget = input.currentYtdExits - input.targetYtdExits;

  if (varianceVsTarget > 0) {
    items.push({
      type: 'performance',
      title: 'Turnover Above Target',
      message: `Turnover is above target by ${Math.round(varianceVsTarget)} exits in the current YTD cut.`,
      severity: 'negative',
    });
  } else {
    items.push({
      type: 'performance',
      title: 'Turnover On Track',
      message: `Turnover is ${Math.round(Math.abs(varianceVsTarget))} exits below the target trajectory.`,
      severity: 'positive',
    });
  }

  if (input.earlyAttritionShare >= 0.5) {
    items.push({
      type: 'risk',
      title: 'Early Attrition Risk',
      message: `${(input.earlyAttritionShare * 100).toFixed(1)}% of exits are within the first year.`,
      severity: 'warning',
    });
  }

  if (input.topReason && (input.topReason.contributionPct ?? 0) >= 0.3) {
    items.push({
      type: 'compensation',
      title: 'Primary Exit Driver',
      message: `${input.topReason.label} explains ${((input.topReason.contributionPct ?? 0) * 100).toFixed(1)}% of YTD exits.`,
      severity: 'warning',
    });
  }

  if (input.topDepartment) {
    items.push({
      type: 'structural',
      title: 'Department Concentration',
      message: `${input.topDepartment.label} represents ${((input.topDepartment.contributionPct ?? 0) * 100).toFixed(1)}% of YTD exits.`,
      severity: 'neutral',
    });
  }

  if (input.keyPositionShare >= 0.1) {
    items.push({
      type: 'risk',
      title: 'Key Position Exposure',
      message: `${(input.keyPositionShare * 100).toFixed(1)}% of exits came from key positions.`,
      severity: 'warning',
    });
  }

  return items.slice(0, 5);
}

export async function getHumanResourcesTurnoverThemeData(
  reportingVersionId?: string,
  scope: HumanResourcesTurnoverScope = 'total',
): Promise<HumanResourcesTurnoverThemeData | null> {
  const resolvedReportingVersionId = await resolveReportingVersionId(reportingVersionId);
  if (!resolvedReportingVersionId) return null;
  const scopeFilter = toScopeFilter(scope);
  const client = getBigQueryClient();

  const baseCte = `
    WITH context AS (
      SELECT
        MAX(DATE(report_period_month)) AS max_report_period_month,
        EXTRACT(YEAR FROM MAX(DATE(report_period_month))) AS current_year,
        EXTRACT(MONTH FROM MAX(DATE(report_period_month))) AS current_month
      FROM \`${TURNOVER_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
    ),
    scoped AS (
      SELECT
        last_working_day_month,
        department,
        territory,
        manager,
        termination_ad_rationale,
        gender,
        age_as_of_date,
        key_people,
        key_position,
        salary_bands_pct,
        DATE_DIFF(DATE(last_working_day_month), DATE(hiring_date_month), MONTH) AS tenure_months,
        CASE
          WHEN years IS NOT NULL AND years < 1 THEN '< 1 Year'
          WHEN years IS NOT NULL AND years < 4 THEN '1 - 3 Years'
          WHEN years IS NOT NULL AND years <= 10 THEN '4 - 10 Years'
          WHEN years IS NOT NULL AND years > 10 THEN '> 10 Years'
          ELSE COALESCE(NULLIF(TRIM(seniority_cluster), ''), 'Unspecified')
        END AS seniority_band
      FROM \`${TURNOVER_VIEW}\`, context
      WHERE reporting_version_id = @reportingVersionId
        AND (${scopeFilter})
        AND last_working_day_month IS NOT NULL
        AND EXTRACT(MONTH FROM DATE(last_working_day_month)) <= context.current_month
        AND EXTRACT(YEAR FROM DATE(last_working_day_month)) IN (context.current_year, context.current_year - 1)
    ),
    tagged AS (
      SELECT
        *,
        EXTRACT(YEAR FROM DATE(last_working_day_month)) AS year_value
      FROM scoped
    )
  `;

  const [summaryRows, reasonRows, departmentRows, territoryRows, managerRows, seniorityRows, ageRows, genderRows, compensationRows, earlyAttritionRows, keyRoleRows, monthlyTrendRows] =
    await Promise.all([
      client.query({
        query: `
          ${baseCte}
          SELECT
            SUM(IF(year_value = context.current_year, 1, 0)) AS current_ytd_exits,
            SUM(IF(year_value = context.current_year - 1, 1, 0)) AS previous_ytd_exits
          FROM tagged, context
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte},
          totals AS (
            SELECT SUM(IF(year_value = context.current_year, 1, 0)) AS current_total
            FROM tagged, context
          )
          SELECT
            COALESCE(NULLIF(TRIM(termination_ad_rationale), ''), 'Unspecified') AS label,
            SUM(IF(year_value = context.current_year, 1, 0)) AS current_ytd_exits,
            SUM(IF(year_value = context.current_year - 1, 1, 0)) AS previous_ytd_exits,
            SAFE_DIVIDE(
              SUM(IF(year_value = context.current_year, 1, 0)) - SUM(IF(year_value = context.current_year - 1, 1, 0)),
              NULLIF(SUM(IF(year_value = context.current_year - 1, 1, 0)), 0)
            ) AS growth_vs_py_pct,
            SAFE_DIVIDE(SUM(IF(year_value = context.current_year, 1, 0)), NULLIF((SELECT current_total FROM totals), 0)) AS contribution_pct
          FROM tagged, context
          GROUP BY 1
          ORDER BY current_ytd_exits DESC
          LIMIT 6
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte},
          totals AS (
            SELECT SUM(IF(year_value = context.current_year, 1, 0)) AS current_total
            FROM tagged, context
          )
          SELECT
            COALESCE(NULLIF(TRIM(department), ''), 'Unassigned') AS label,
            SUM(IF(year_value = context.current_year, 1, 0)) AS current_ytd_exits,
            SUM(IF(year_value = context.current_year - 1, 1, 0)) AS previous_ytd_exits,
            SAFE_DIVIDE(
              SUM(IF(year_value = context.current_year, 1, 0)) - SUM(IF(year_value = context.current_year - 1, 1, 0)),
              NULLIF(SUM(IF(year_value = context.current_year - 1, 1, 0)), 0)
            ) AS growth_vs_py_pct,
            SAFE_DIVIDE(SUM(IF(year_value = context.current_year, 1, 0)), NULLIF((SELECT current_total FROM totals), 0)) AS contribution_pct
          FROM tagged, context
          GROUP BY 1
          ORDER BY current_ytd_exits DESC
          LIMIT 6
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte},
          totals AS (
            SELECT SUM(IF(year_value = context.current_year, 1, 0)) AS current_total
            FROM tagged, context
          )
          SELECT
            COALESCE(NULLIF(TRIM(territory), ''), 'Unassigned') AS label,
            SUM(IF(year_value = context.current_year, 1, 0)) AS current_ytd_exits,
            SUM(IF(year_value = context.current_year - 1, 1, 0)) AS previous_ytd_exits,
            SAFE_DIVIDE(
              SUM(IF(year_value = context.current_year, 1, 0)) - SUM(IF(year_value = context.current_year - 1, 1, 0)),
              NULLIF(SUM(IF(year_value = context.current_year - 1, 1, 0)), 0)
            ) AS growth_vs_py_pct,
            SAFE_DIVIDE(SUM(IF(year_value = context.current_year, 1, 0)), NULLIF((SELECT current_total FROM totals), 0)) AS contribution_pct
          FROM tagged, context
          GROUP BY 1
          ORDER BY current_ytd_exits DESC
          LIMIT 6
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte},
          totals AS (
            SELECT SUM(IF(year_value = context.current_year, 1, 0)) AS current_total
            FROM tagged, context
          )
          SELECT
            COALESCE(NULLIF(TRIM(manager), ''), 'Unassigned') AS label,
            SUM(IF(year_value = context.current_year, 1, 0)) AS current_ytd_exits,
            SUM(IF(year_value = context.current_year - 1, 1, 0)) AS previous_ytd_exits,
            SAFE_DIVIDE(
              SUM(IF(year_value = context.current_year, 1, 0)) - SUM(IF(year_value = context.current_year - 1, 1, 0)),
              NULLIF(SUM(IF(year_value = context.current_year - 1, 1, 0)), 0)
            ) AS growth_vs_py_pct,
            SAFE_DIVIDE(SUM(IF(year_value = context.current_year, 1, 0)), NULLIF((SELECT current_total FROM totals), 0)) AS contribution_pct
          FROM tagged, context
          GROUP BY 1
          ORDER BY current_ytd_exits DESC
          LIMIT 6
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte},
          totals AS (
            SELECT SUM(IF(year_value = context.current_year, 1, 0)) AS current_total
            FROM tagged, context
          )
          SELECT
            COALESCE(NULLIF(TRIM(seniority_band), ''), 'Unspecified') AS label,
            SUM(IF(year_value = context.current_year, 1, 0)) AS current_ytd_exits,
            SUM(IF(year_value = context.current_year - 1, 1, 0)) AS previous_ytd_exits,
            SAFE_DIVIDE(
              SUM(IF(year_value = context.current_year, 1, 0)) - SUM(IF(year_value = context.current_year - 1, 1, 0)),
              NULLIF(SUM(IF(year_value = context.current_year - 1, 1, 0)), 0)
            ) AS growth_vs_py_pct,
            SAFE_DIVIDE(SUM(IF(year_value = context.current_year, 1, 0)), NULLIF((SELECT current_total FROM totals), 0)) AS contribution_pct
          FROM tagged, context
          GROUP BY 1
          ORDER BY
            CASE label
              WHEN '< 1 Year' THEN 1
              WHEN '1 - 3 Years' THEN 2
              WHEN '4 - 10 Years' THEN 3
              WHEN '> 10 Years' THEN 4
              ELSE 5
            END,
            current_ytd_exits DESC
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte},
          totals AS (
            SELECT SUM(IF(year_value = context.current_year, 1, 0)) AS current_total
            FROM tagged, context
          )
          SELECT
            CASE
              WHEN age_as_of_date IS NULL THEN 'Unspecified'
              WHEN age_as_of_date < 30 THEN '< 30'
              WHEN age_as_of_date < 40 THEN '30 - 39'
              WHEN age_as_of_date < 50 THEN '40 - 49'
              ELSE '50+'
            END AS label,
            SUM(IF(year_value = context.current_year, 1, 0)) AS current_ytd_exits,
            SUM(IF(year_value = context.current_year - 1, 1, 0)) AS previous_ytd_exits,
            SAFE_DIVIDE(
              SUM(IF(year_value = context.current_year, 1, 0)) - SUM(IF(year_value = context.current_year - 1, 1, 0)),
              NULLIF(SUM(IF(year_value = context.current_year - 1, 1, 0)), 0)
            ) AS growth_vs_py_pct,
            SAFE_DIVIDE(SUM(IF(year_value = context.current_year, 1, 0)), NULLIF((SELECT current_total FROM totals), 0)) AS contribution_pct
          FROM tagged, context
          GROUP BY 1
          ORDER BY
            CASE label
              WHEN '< 30' THEN 1
              WHEN '30 - 39' THEN 2
              WHEN '40 - 49' THEN 3
              WHEN '50+' THEN 4
              ELSE 5
            END
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte},
          totals AS (
            SELECT SUM(IF(year_value = context.current_year, 1, 0)) AS current_total
            FROM tagged, context
          )
          SELECT
            COALESCE(NULLIF(TRIM(gender), ''), 'Unspecified') AS label,
            SUM(IF(year_value = context.current_year, 1, 0)) AS current_ytd_exits,
            SUM(IF(year_value = context.current_year - 1, 1, 0)) AS previous_ytd_exits,
            SAFE_DIVIDE(
              SUM(IF(year_value = context.current_year, 1, 0)) - SUM(IF(year_value = context.current_year - 1, 1, 0)),
              NULLIF(SUM(IF(year_value = context.current_year - 1, 1, 0)), 0)
            ) AS growth_vs_py_pct,
            SAFE_DIVIDE(SUM(IF(year_value = context.current_year, 1, 0)), NULLIF((SELECT current_total FROM totals), 0)) AS contribution_pct
          FROM tagged, context
          GROUP BY 1
          ORDER BY current_ytd_exits DESC
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte},
          totals AS (
            SELECT SUM(IF(year_value = context.current_year, 1, 0)) AS current_total
            FROM tagged, context
          )
          SELECT
            CASE
              WHEN salary_bands_pct IS NULL THEN 'Unspecified'
              WHEN salary_bands_pct < 0.95 THEN 'Below Band'
              WHEN salary_bands_pct <= 1.05 THEN 'Within Band'
              ELSE 'Above Band'
            END AS label,
            SUM(IF(year_value = context.current_year, 1, 0)) AS current_ytd_exits,
            SUM(IF(year_value = context.current_year - 1, 1, 0)) AS previous_ytd_exits,
            SAFE_DIVIDE(
              SUM(IF(year_value = context.current_year, 1, 0)) - SUM(IF(year_value = context.current_year - 1, 1, 0)),
              NULLIF(SUM(IF(year_value = context.current_year - 1, 1, 0)), 0)
            ) AS growth_vs_py_pct,
            SAFE_DIVIDE(SUM(IF(year_value = context.current_year, 1, 0)), NULLIF((SELECT current_total FROM totals), 0)) AS contribution_pct
          FROM tagged, context
          GROUP BY 1
          ORDER BY
            CASE label
              WHEN 'Below Band' THEN 1
              WHEN 'Within Band' THEN 2
              WHEN 'Above Band' THEN 3
              ELSE 4
            END
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte},
          totals AS (
            SELECT SUM(IF(year_value = context.current_year, 1, 0)) AS current_total
            FROM tagged, context
          )
          SELECT
            CASE
              WHEN tenure_months IS NULL THEN 'Unspecified'
              WHEN tenure_months < 6 THEN '0 - 6 Months'
              WHEN tenure_months < 12 THEN '6 - 12 Months'
              WHEN tenure_months < 24 THEN '1 - 2 Years'
              ELSE '2+ Years'
            END AS label,
            SUM(IF(year_value = context.current_year, 1, 0)) AS current_ytd_exits,
            SUM(IF(year_value = context.current_year - 1, 1, 0)) AS previous_ytd_exits,
            SAFE_DIVIDE(
              SUM(IF(year_value = context.current_year, 1, 0)) - SUM(IF(year_value = context.current_year - 1, 1, 0)),
              NULLIF(SUM(IF(year_value = context.current_year - 1, 1, 0)), 0)
            ) AS growth_vs_py_pct,
            SAFE_DIVIDE(SUM(IF(year_value = context.current_year, 1, 0)), NULLIF((SELECT current_total FROM totals), 0)) AS contribution_pct
          FROM tagged, context
          GROUP BY 1
          ORDER BY
            CASE label
              WHEN '0 - 6 Months' THEN 1
              WHEN '6 - 12 Months' THEN 2
              WHEN '1 - 2 Years' THEN 3
              WHEN '2+ Years' THEN 4
              ELSE 5
            END
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte}
          SELECT
            SUM(
              IF(
                year_value = context.current_year
                AND LOWER(TRIM(CAST(COALESCE(key_people, 'false') AS STRING))) IN ('true', '1', 'yes', 'y', 'si'),
                1,
                0
              )
            ) AS key_people_exits,
            SAFE_DIVIDE(
              SUM(
                IF(
                  year_value = context.current_year
                  AND LOWER(TRIM(CAST(COALESCE(key_people, 'false') AS STRING))) IN ('true', '1', 'yes', 'y', 'si'),
                  1,
                  0
                )
              ),
              NULLIF(SUM(IF(year_value = context.current_year, 1, 0)), 0)
            ) AS key_people_share_pct,
            SUM(
              IF(
                year_value = context.current_year
                AND LOWER(TRIM(CAST(COALESCE(key_position, 'false') AS STRING))) IN ('true', '1', 'yes', 'y', 'si'),
                1,
                0
              )
            ) AS key_position_exits,
            SAFE_DIVIDE(
              SUM(
                IF(
                  year_value = context.current_year
                  AND LOWER(TRIM(CAST(COALESCE(key_position, 'false') AS STRING))) IN ('true', '1', 'yes', 'y', 'si'),
                  1,
                  0
                )
              ),
              NULLIF(SUM(IF(year_value = context.current_year, 1, 0)), 0)
            ) AS key_position_share_pct
          FROM tagged, context
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
      client.query({
        query: `
          ${baseCte},
          monthly_base AS (
            SELECT
              FORMAT_DATE('%b', DATE(last_working_day_month)) AS month_label,
              EXTRACT(MONTH FROM DATE(last_working_day_month)) AS month_order,
              SUM(IF(year_value = context.current_year, 1, 0)) AS current_year_exits,
              SUM(IF(year_value = context.current_year - 1, 1, 0)) AS previous_year_exits
            FROM tagged, context
            GROUP BY 1, 2
          )
          SELECT
            month_label,
            month_order,
            current_year_exits,
            previous_year_exits,
            SUM(current_year_exits) OVER (ORDER BY month_order) AS current_year_cumulative_exits,
            SUM(previous_year_exits) OVER (ORDER BY month_order) AS previous_year_cumulative_exits
          FROM monthly_base
          ORDER BY month_order
        `,
        params: { reportingVersionId: resolvedReportingVersionId },
      }),
    ]);

  const summaryRow = (summaryRows[0] as Array<Record<string, unknown>>)[0] ?? {};
  const currentYtdExits = Number(summaryRow.current_ytd_exits ?? 0);
  const previousYtdExits = Number(summaryRow.previous_ytd_exits ?? 0);
  const targetYtdExits = previousYtdExits * 0.85;
  const varianceVsTarget = currentYtdExits - targetYtdExits;
  const varianceVsPy = currentYtdExits - previousYtdExits;
  const growthVsPyPct =
    previousYtdExits === 0 ? null : (currentYtdExits - previousYtdExits) / previousYtdExits;

  const topReasons = mapThemeItems(reasonRows[0] as Array<Record<string, unknown>>);
  const topDepartments = mapThemeItems(departmentRows[0] as Array<Record<string, unknown>>);
  const topTerritories = mapThemeItems(territoryRows[0] as Array<Record<string, unknown>>);
  const topManagers = mapThemeItems(managerRows[0] as Array<Record<string, unknown>>);
  const seniorityMix = mapThemeItems(seniorityRows[0] as Array<Record<string, unknown>>);
  const ageMix = mapThemeItems(ageRows[0] as Array<Record<string, unknown>>);
  const genderMix = mapThemeItems(genderRows[0] as Array<Record<string, unknown>>);
  const compensationMix = mapThemeItems(compensationRows[0] as Array<Record<string, unknown>>);
  const earlyAttritionMix = mapThemeItems(earlyAttritionRows[0] as Array<Record<string, unknown>>);
  const monthlyTrend = mapMonthlyTrendRows(monthlyTrendRows[0] as Array<Record<string, unknown>>);

  const keyRoleRow = (keyRoleRows[0] as Array<Record<string, unknown>>)[0] ?? {};
  const keyPeopleExits = Number(keyRoleRow.key_people_exits ?? 0);
  const keyPeopleSharePct =
    keyRoleRow.key_people_share_pct == null ? null : Number(keyRoleRow.key_people_share_pct);
  const keyPositionExits = Number(keyRoleRow.key_position_exits ?? 0);
  const keyPositionSharePct =
    keyRoleRow.key_position_share_pct == null ? null : Number(keyRoleRow.key_position_share_pct);

  const earlyExitShare =
    earlyAttritionMix
      .filter((item) => item.label === '0 - 6 Months' || item.label === '6 - 12 Months')
      .reduce((sum, item) => sum + (item.contributionPct ?? 0), 0);
  const salaryReasonShare =
    topReasons.find((item) => item.label.toLowerCase().includes('salary'))?.contributionPct ?? 0;
  const keyPosShare = keyPositionSharePct ?? 0;

  const riskIndices = {
    attritionRiskIndex: Math.round((earlyExitShare + salaryReasonShare + keyPosShare) * 100),
    compensationRiskIndex: Math.round(
      ((compensationMix.find((item) => item.label === 'Below Band')?.contributionPct ?? 0) +
        salaryReasonShare) *
        100,
    ),
    hiringQualityRiskIndex: Math.round(earlyExitShare * 100),
  };

  const insights = buildInsightItems({
    currentYtdExits,
    previousYtdExits,
    targetYtdExits,
    earlyAttritionShare: earlyExitShare,
    topDepartment: topDepartments[0],
    topReason: topReasons[0],
    keyPositionShare: keyPosShare,
  });

  return {
    scope,
    summary: {
      currentYtdExits,
      previousYtdExits,
      targetYtdExits,
      varianceVsTarget,
      varianceVsPy,
      growthVsPyPct,
      onTrackToTarget: currentYtdExits <= targetYtdExits,
    },
    topReasons,
    topDepartments,
    topTerritories,
    topManagers,
    seniorityMix,
    ageMix,
    genderMix,
    compensationMix,
    earlyAttritionMix,
    keyRoleMetrics: {
      keyPeopleExits,
      keyPeopleSharePct,
      keyPositionExits,
      keyPositionSharePct,
    },
    riskIndices,
    monthlyTrend,
    insights,
  };
}
