import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';

export type PeriodRow = {
  periodMonth: string;
  reportingVersionId: string;
  closureStatus: string;
  isEditable: boolean;
  openedAt: string;
  openedBy: string;
  closedAt: string | null;
  closedBy: string | null;
  notes: string | null;
};

export async function getPeriodsPageData(): Promise<PeriodRow[]> {
  const client = getBigQueryClient();

  const query = `
    SELECT
      CAST(period_month AS STRING) AS period_month,
      reporting_version_id,
      closure_status,
      is_editable,
      CAST(opened_at AS STRING) AS opened_at,
      opened_by,
      CAST(closed_at AS STRING) AS closed_at,
      closed_by,
      notes
    FROM \`chiesi-committee.chiesi_committee_admin.period_closures\`
    ORDER BY period_month DESC
  `;

  const [rows] = await client.query({ query });

  return rows.map((row: any) => ({
    periodMonth: row.period_month,
    reportingVersionId: row.reporting_version_id,
    closureStatus: row.closure_status ?? 'open',
    isEditable: Boolean(row.is_editable),
    openedAt: row.opened_at ?? '',
    openedBy: row.opened_by ?? '-',
    closedAt: row.closed_at ?? null,
    closedBy: row.closed_by ?? null,
    notes: row.notes ?? null,
  }));
}