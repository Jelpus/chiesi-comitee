type AdminStatus =
  | 'draft'
  | 'approved'
  | 'final'
  | 'open'
  | 'closed'
  | 'processing'
  | 'raw_loaded'
  | 'normalizing'
  | 'normalized'
  | 'publishing'
  | 'published'
  | 'error'
  | 'unknown';

const statusClasses: Record<AdminStatus, string> = {
  draft: 'border border-amber-200/80 bg-amber-50 text-amber-700',
  approved: 'border border-sky-200/80 bg-sky-50 text-sky-700',
  final: 'border border-emerald-200/80 bg-emerald-50 text-emerald-700',
  open: 'border border-emerald-200/80 bg-emerald-50 text-emerald-700',
  closed: 'border border-slate-200 bg-slate-100 text-slate-700',
  processing: 'border border-sky-200/80 bg-sky-50 text-sky-700',
  raw_loaded: 'border border-indigo-200/80 bg-indigo-50 text-indigo-700',
  normalizing: 'border border-amber-200/80 bg-amber-50 text-amber-700',
  normalized: 'border border-emerald-200/80 bg-emerald-50 text-emerald-700',
  publishing: 'border border-sky-200/80 bg-sky-50 text-sky-700',
  published: 'border border-emerald-200/80 bg-emerald-50 text-emerald-700',
  error: 'border border-rose-200/80 bg-rose-50 text-rose-700',
  unknown: 'border border-slate-200 bg-slate-50 text-slate-600',
};

type AdminStatusBadgeProps = {
  status: string;
};

export function AdminStatusBadge({ status }: AdminStatusBadgeProps) {
  const normalized = (status?.toLowerCase?.() ?? 'unknown') as AdminStatus;
  const safeStatus: AdminStatus = normalized in statusClasses ? normalized : 'unknown';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] ${statusClasses[safeStatus]}`}
    >
      {safeStatus}
    </span>
  );
}
