import { InfoChip } from '@/components/ui/info-chip';
import { SectionHeader } from '@/components/ui/section-header';
import { SelectFilter } from '@/components/ui/select-filter';
import { AdminStatusBadge } from '@/components/ui/admin-status-badge';
import { AdminSyncActions } from '@/components/admin/admin-sync-actions';
import { getAdminHomeStatusData } from '@/lib/data/admin-home-status';
import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type AdminPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

function formatMonth(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const versions = await getReportingVersions();
  const selected =
    versions.find((item) => item.reportingVersionId === params.version) ??
    versions[0];

  if (!selected) {
    return (
      <section className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Admin</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Admin Panel</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">No reporting versions found.</p>
        </div>
      </section>
    );
  }

  const statusData = await getAdminHomeStatusData({
    reportingVersionId: selected.reportingVersionId,
    periodMonth: selected.periodMonth,
  });

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Admin"
        title="Admin Panel"
        description="Operational management of periods, versions, uploads, validations, and committee traceability."
        actions={
          <>
            <InfoChip label="Period" value={formatMonth(selected.periodMonth)} />
            <InfoChip label="Version" value={selected.versionName} />
            <SelectFilter
              paramName="version"
              label="Change version"
              value={selected.reportingVersionId}
              options={versions.map((version) => ({
                value: version.reportingVersionId,
                label: `${version.periodMonth} - ${version.versionName}`,
              }))}
            />
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Expected Files</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{statusData.totalExpected}</p>
        </article>
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Published</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-700">{statusData.publishedCount}</p>
        </article>
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Missing</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-rose-700">{statusData.missingCount}</p>
        </article>
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Readiness</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{statusData.readinessPct.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-slate-600">{statusData.isReady ? 'Files + forms complete' : 'Pending files/forms'}</p>
        </article>
      </div>

      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Form Completeness</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {statusData.forms.map((row) => (
            <div key={row.formCode} className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">{row.label}</p>
              <p className="mt-1 text-xs text-slate-600">
                {row.completed}/{row.expected} completed
              </p>
              <div className="mt-2">
                <AdminStatusBadge
                  status={
                    row.status === 'complete'
                      ? 'published'
                      : row.status === 'incomplete'
                        ? 'normalized'
                        : 'error'
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Closing Inputs Completeness</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {statusData.closingInputs.map((row) => (
            <div key={row.areaSlug} className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">{row.label}</p>
              <p className="mt-1 text-xs text-slate-600">
                {row.completed}/{row.expected} completed
              </p>
              <div className="mt-2">
                <AdminStatusBadge status={row.status === 'complete' ? 'published' : 'error'} />
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Home Load Status</p>
            <p className="mt-1 text-sm text-slate-700">
              Validate module uploads for this cut and store a control snapshot.
            </p>
          </div>
          <AdminSyncActions reportingVersionId={selected.reportingVersionId} periodMonth={selected.periodMonth} />
        </div>
        <div className="mt-3 flex justify-end">
          <Link
            href={`/admin/preread?reportversion=${encodeURIComponent(selected.reportingVersionId)}`}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 hover:border-slate-400"
          >
            Open Pre-Read Preview
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-[14px] border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Uploaded At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {statusData.rows.map((row) => (
                <tr key={row.moduleCode}>
                  <td className="px-4 py-3 text-slate-700">{row.area}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.moduleLabel}</td>
                  <td className="px-4 py-3">
                    {row.isMissing ? (
                      <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-rose-700">
                        missing
                      </span>
                    ) : (
                      <AdminStatusBadge status={row.status} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.sourceFileName ?? 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.uploadedAt ?? 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
