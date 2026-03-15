import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import type {
  HumanResourcesAuditSource,
  HumanResourcesTrainingOverview,
  HumanResourcesTrainingUserRow,
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

async function getEmployeesPeopleMap() {
  try {
    const response = await fetch('https://www.chiesihub.com/_functions/empleados', {
      method: 'GET',
      cache: 'no-store',
    });
    if (!response.ok) return new Map<string, string>();
    const json = await response.json();
    const rows = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.items)
          ? json.items
          : [];
    const map = new Map<string, string>();

    for (const raw of rows as Array<Record<string, unknown>>) {
      const peopleIdRaw =
        raw.peopleId ?? raw.people_id ?? raw.personId ?? raw.person_id ?? raw.employeeId ?? raw.id;
      const userRaw = raw.user ?? raw.username ?? raw.userName;
      const emailRaw = raw.email ?? raw.mail;
      const fullNameRaw =
        raw.name ??
        raw.displayName ??
        [raw.firstName, raw.lastName].filter((value) => value != null && String(value).trim()).join(' ');

      if (peopleIdRaw == null) continue;
      const peopleId = String(peopleIdRaw).trim();
      if (!peopleId) continue;

      const candidateKeys = [
        ...buildUserLookupKeys(userRaw ? String(userRaw) : null),
        ...buildUserLookupKeys(emailRaw ? String(emailRaw) : null),
        ...buildUserLookupKeys(fullNameRaw ? String(fullNameRaw) : null),
      ];

      for (const key of candidateKeys) {
        map.set(key, peopleId);
      }
    }

    return map;
  } catch {
    return new Map<string, string>();
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
    reportPeriodMonth: row.report_period_month ? String(row.report_period_month) : null,
    sourceAsOfMonth: row.source_as_of_month ? String(row.source_as_of_month) : null,
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
      SELECT
        MAX(CAST(report_period_month AS STRING)) AS report_period_month,
        MAX(CAST(source_as_of_month AS STRING)) AS source_as_of_month,
        COUNT(1) AS ytd_exits,
        COUNTIF(LOWER(COALESCE(vol_non_vol, '')) LIKE '%vol%') AS ytd_voluntary_exits,
        COUNTIF(LOWER(COALESCE(vol_non_vol, '')) LIKE '%non%' OR LOWER(COALESCE(vol_non_vol, '')) LIKE '%invol%') AS ytd_involuntary_exits
      FROM \`${TURNOVER_VIEW}\`
      WHERE reporting_version_id = @reportingVersionId
        AND EXTRACT(YEAR FROM period_month) = EXTRACT(YEAR FROM DATE(source_as_of_month))
        AND EXTRACT(MONTH FROM period_month) <= EXTRACT(MONTH FROM DATE(source_as_of_month))
    `,
    params: { reportingVersionId: resolvedReportingVersionId },
  });
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;

  return {
    reportPeriodMonth: row.report_period_month ? String(row.report_period_month) : null,
    sourceAsOfMonth: row.source_as_of_month ? String(row.source_as_of_month) : null,
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
    reportPeriodMonth: row.report_period_month ? String(row.report_period_month) : null,
    sourceAsOfMonth: row.source_as_of_month ? String(row.source_as_of_month) : null,
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
  const [queryResult, peopleMap] = await Promise.all([
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
    const peopleId =
      userCandidates.map((key) => peopleMap.get(key)).find((value) => Boolean(value)) ?? null;
    return {
      userName,
      peopleId,
      totalHours: Number(row.total_hours ?? 0),
      completedRecords: completed,
      totalRecords,
      completionRate: totalRecords === 0 ? null : completed / totalRecords,
    };
  });
}
