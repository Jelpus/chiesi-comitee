import { AdminStatusBadge } from '@/components/ui/admin-status-badge';
import type { PeriodRow } from '@/lib/data/periods/get-periods-page-data';

type PeriodsTableProps = {
  rows: PeriodRow[];
};

function formatPeriod(periodMonth: string) {
  const date = new Date(`${periodMonth}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDate(value: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function PeriodsTable({ rows }: PeriodsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-8 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
        <p className="text-sm text-slate-600">No periods registered.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Period
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Version
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Status
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Editable
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Opened
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Closed
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={`${row.periodMonth}-${row.reportingVersionId}`} className="border-b border-slate-100">
                <td className="px-6 py-4 text-sm">{formatPeriod(row.periodMonth)}</td>

                <td className="px-6 py-4 text-sm font-medium">
                  {row.reportingVersionId}
                </td>

                <td className="px-6 py-4">
                  <AdminStatusBadge status={row.closureStatus} />
                </td>

                <td className="px-6 py-4 text-sm">
                  {row.isEditable ? 'Yes' : 'No'}
                </td>

                <td className="px-6 py-4 text-sm">
                  {formatDate(row.openedAt)}
                </td>

                <td className="px-6 py-4 text-sm">
                  {formatDate(row.closedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
