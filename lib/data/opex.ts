import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { resolveOpexCecoNameGroup } from '@/lib/data/opex-ceco-group';
import { getOpexCecoGroupMappings } from '@/lib/data/opex-group-mapping';

const OPEX_ENRICHED_VIEW = 'chiesi-committee.chiesi_committee_stg.vw_opex_enriched';

export type OpexRow = {
  reportingVersionId: string;
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  latestPeriodMonth: string | null;
  cecoName: string | null;
  cecoNameGroup: string;
  area: string | null;
  businessUnit: string | null;
  element: string | null;
  metricName: string;
  periodMonth: string;
  amountValue: number;
  isYtd: boolean;
  isYtdPy: boolean;
  isMth: boolean;
  isMthPy: boolean;
};

export async function getOpexRows(reportingVersionId?: string): Promise<OpexRow[]> {
  const client = getBigQueryClient();
  const [queryResult, adminMappings] = await Promise.all([
    client.query({
      query: `
        SELECT
          upload_id,
          reporting_version_id,
          CAST(report_period_month AS STRING) AS report_period_month,
          CAST(source_as_of_month AS STRING) AS source_as_of_month,
          CAST(source_uploaded_at AS STRING) AS source_uploaded_at,
          CAST(latest_period_month AS STRING) AS latest_period_month,
          ceco_name,
          area,
          business_unit,
          element,
          metric_name,
          CAST(period_month AS STRING) AS period_month,
          CAST(amount_value AS FLOAT64) AS amount_value,
          is_ytd,
          is_ytd_py,
          is_mth,
          is_mth_py
        FROM \`${OPEX_ENRICHED_VIEW}\`
        WHERE (@reportingVersionId = '' OR reporting_version_id = @reportingVersionId)
        ORDER BY period_month
      `,
      params: {
        reportingVersionId: reportingVersionId ?? '',
      },
    }),
    getOpexCecoGroupMappings(),
  ]);

  const mappingByCeco = new Map(
    adminMappings.map((item) => [normalizeKey(item.cecoName), item.cecoNameGroup]),
  );

  const [rows] = queryResult;
  const rawRows = (rows as Array<Record<string, unknown>>).map((row) => {
    const cecoName = row.ceco_name == null ? null : String(row.ceco_name);
    const mappedGroup = mappingByCeco.get(normalizeKey(cecoName));
    return {
      uploadId: String(row.upload_id ?? ''),
      reportingVersionId: String(row.reporting_version_id ?? ''),
      reportPeriodMonth: row.report_period_month == null ? null : String(row.report_period_month),
      sourceAsOfMonth: row.source_as_of_month == null ? null : String(row.source_as_of_month),
      sourceUploadedAt: row.source_uploaded_at == null ? null : String(row.source_uploaded_at),
      latestPeriodMonth: row.latest_period_month == null ? null : String(row.latest_period_month),
      cecoName,
      cecoNameGroup: mappedGroup ?? resolveOpexCecoNameGroup(cecoName),
      area: row.area == null ? null : String(row.area),
      businessUnit: row.business_unit == null ? null : String(row.business_unit),
      element: row.element == null ? null : String(row.element),
      metricName: String(row.metric_name ?? ''),
      periodMonth: String(row.period_month ?? ''),
      amountValue: Number(row.amount_value ?? 0),
      isYtd: Boolean(row.is_ytd),
      isYtdPy: Boolean(row.is_ytd_py),
      isMth: Boolean(row.is_mth),
      isMthPy: Boolean(row.is_mth_py),
    };
  });

  const latestUploadByVersion = new Map<string, { uploadId: string; uploadedAtMs: number }>();
  for (const row of rawRows) {
    const uploadedAtMs = row.sourceUploadedAt ? Date.parse(row.sourceUploadedAt) : Number.NaN;
    const current = latestUploadByVersion.get(row.reportingVersionId);
    if (
      !current ||
      (Number.isFinite(uploadedAtMs) && uploadedAtMs > current.uploadedAtMs) ||
      (!Number.isFinite(current.uploadedAtMs) && row.uploadId > current.uploadId)
    ) {
      latestUploadByVersion.set(row.reportingVersionId, {
        uploadId: row.uploadId,
        uploadedAtMs: Number.isFinite(uploadedAtMs) ? uploadedAtMs : Number.NEGATIVE_INFINITY,
      });
    }
  }

  const filteredRows = rawRows.filter((row) => {
    const latest = latestUploadByVersion.get(row.reportingVersionId);
    return latest?.uploadId === row.uploadId;
  });

  const cutoffByVersion = new Map<string, Date>();
  for (const row of filteredRows) {
    const versionId = row.reportingVersionId;
    const current = cutoffByVersion.get(versionId);
    const sourceAsOf = toMonthDate(row.sourceAsOfMonth);
    const reportPeriod = toMonthDate(row.reportPeriodMonth);
    const latestPeriod = toMonthDate(row.latestPeriodMonth);
    const period = toMonthDate(row.periodMonth);
    const candidate =
      sourceAsOf ?? reportPeriod ?? latestPeriod ?? period ?? current ?? null;
    if (!candidate) continue;
    if (!current || candidate.getTime() > current.getTime()) {
      cutoffByVersion.set(versionId, candidate);
    }
  }

  return filteredRows.map((row) => {
    const cutoff = cutoffByVersion.get(row.reportingVersionId) ?? toMonthDate(row.latestPeriodMonth);
    if (!cutoff) return row;
    const period = toMonthDate(row.periodMonth);
    if (!period) return row;
    const cutoffYear = cutoff.getUTCFullYear();
    const cutoffMonth = cutoff.getUTCMonth();
    const periodYear = period.getUTCFullYear();
    const periodMonth = period.getUTCMonth();
    const cutoffPyYear = cutoffYear - 1;
    const latestPeriodMonth = toMonthString(cutoff);

    return {
      ...row,
      latestPeriodMonth,
      isYtd: periodYear === cutoffYear && periodMonth <= cutoffMonth,
      isYtdPy: periodYear === cutoffPyYear && periodMonth <= cutoffMonth,
      isMth: periodYear === cutoffYear && periodMonth === cutoffMonth,
      isMthPy: periodYear === cutoffPyYear && periodMonth === cutoffMonth,
    };
  });
}

function normalizeKey(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function toMonthDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
}

function toMonthString(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}
