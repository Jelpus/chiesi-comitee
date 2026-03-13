'use client';

import Link from 'next/link';
import { AdminStatusBadge } from '@/components/ui/admin-status-badge';
import type { UploadListRow } from '@/lib/data/uploads/get-uploads-page-data';

type CurrentUploadCardProps = {
  row: UploadListRow | null;
};

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatMonth(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function CurrentUploadCard({ row }: CurrentUploadCardProps) {
  if (!row) {
    return (
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-8 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Current Upload</p>
            <p className="mt-2 text-sm text-slate-700">No uploads registered yet.</p>
          </div>
          <Link
            href="/admin/uploads/logs"
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            View logs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Current Upload</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">{row.sourceFileName}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {row.moduleCode} | Report: {formatMonth(row.periodMonth)} | As Of: {formatMonth(row.sourceAsOfMonth)} | {formatDate(row.uploadedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminStatusBadge status={row.status} />
          <Link
            href={`/admin/uploads/${row.uploadId}`}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            View details
          </Link>
          <Link
            href="/admin/uploads/logs"
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            View logs
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Rows total</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{row.rowsTotal.toLocaleString('en-US')}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Rows valid</p>
          <p className="mt-1 text-base font-semibold text-emerald-700">{row.rowsValid.toLocaleString('en-US')}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Rows error</p>
          <p className="mt-1 text-base font-semibold text-rose-700">{row.rowsError.toLocaleString('en-US')}</p>
        </div>
      </div>
    </div>
  );
}
