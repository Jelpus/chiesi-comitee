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
          reporting_version_id,
          CAST(report_period_month AS STRING) AS report_period_month,
          CAST(source_as_of_month AS STRING) AS source_as_of_month,
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
  return (rows as Array<Record<string, unknown>>).map((row) => {
    const cecoName = row.ceco_name == null ? null : String(row.ceco_name);
    const mappedGroup = mappingByCeco.get(normalizeKey(cecoName));
    return {
      reportingVersionId: String(row.reporting_version_id ?? ''),
      reportPeriodMonth: row.report_period_month == null ? null : String(row.report_period_month),
      sourceAsOfMonth: row.source_as_of_month == null ? null : String(row.source_as_of_month),
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
}

function normalizeKey(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}
