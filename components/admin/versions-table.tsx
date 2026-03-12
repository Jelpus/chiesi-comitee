import { AdminStatusBadge } from '@/components/ui/admin-status-badge';
import type { VersionRow } from '@/lib/data/versions/get-versions-page-data';

type VersionsTableProps = {
  rows: VersionRow[];
};

function formatPeriod(periodMonth: string) {
  const date = new Date(`${periodMonth}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function VersionsTable({ rows }: VersionsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-8 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
        <p className="text-sm text-slate-600">No versions registered yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Period
              </th>
              <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Version
              </th>
              <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Status
              </th>
              <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Created by
              </th>
              <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Created at
              </th>
              <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Notes
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.reportingVersionId} className="border-b border-slate-100 last:border-b-0">
                <td className="px-6 py-4 text-sm text-slate-800">{formatPeriod(row.periodMonth)}</td>
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{row.versionName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      ID: {row.reportingVersionId} · v{row.versionNumber}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <AdminStatusBadge status={row.status} />
                </td>
                <td className="px-6 py-4 text-sm text-slate-800">{row.createdBy}</td>
                <td className="px-6 py-4 text-sm text-slate-800">{formatCreatedAt(row.createdAt)}</td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {row.notes ?? <span className="text-slate-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
