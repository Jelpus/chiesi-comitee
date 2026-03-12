'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { processUpload, publishUpload } from '@/app/admin/uploads/actions';
import { AdminStatusBadge } from '@/components/ui/admin-status-badge';
import type { UploadListRow } from '@/lib/data/uploads/get-uploads-page-data';

type UploadsTableProps = {
  rows: UploadListRow[];
};

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function isProcessableStatus(status: string) {
  return status === 'raw_loaded' || status === 'error';
}

function isPublishableStatus(status: string) {
  return status === 'normalized' || status === 'published';
}

export function UploadsTable({ rows }: UploadsTableProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-8 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
        <p className="text-sm text-slate-600">No uploads registered.</p>
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
                Upload
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Module
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                File
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Status
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Rows
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Uploaded
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.uploadId} className="border-b border-slate-100 last:border-b-0">
                <td className="px-6 py-4 text-xs text-slate-600">{row.uploadId}</td>
                <td className="px-6 py-4 text-sm text-slate-800">{row.moduleCode}</td>
                <td className="px-6 py-4 text-sm text-slate-800">{row.sourceFileName}</td>
                <td className="px-6 py-4">
                  <AdminStatusBadge status={row.status} />
                </td>
                <td className="px-6 py-4 text-sm text-slate-800">
                  {row.rowsValid}/{row.rowsTotal}
                  {row.rowsError > 0 ? (
                    <span className="ml-2 text-rose-600">({row.rowsError} error)</span>
                  ) : null}
                </td>
                <td className="px-6 py-4 text-sm text-slate-800">{formatDate(row.uploadedAt)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isPending || !isProcessableStatus(row.status)}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await processUpload(row.uploadId);
                            router.refresh();
                          } catch {
                            router.refresh();
                          }
                        });
                      }}
                      className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      {isPending ? 'Processing...' : 'Process'}
                    </button>

                    <button
                      type="button"
                      disabled={isPending || !isPublishableStatus(row.status)}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await publishUpload(row.uploadId);
                            router.refresh();
                          } catch {
                            router.refresh();
                          }
                        });
                      }}
                      className="rounded-full border border-emerald-300 px-4 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {isPending ? 'Publishing...' : 'Publish'}
                    </button>

                    <Link
                      href={`/admin/uploads/${row.uploadId}`}
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      View details
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
