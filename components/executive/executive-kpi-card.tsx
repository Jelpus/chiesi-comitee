import Link from 'next/link';
import type { ExecutiveCardItem } from '@/types/executive';
import { ModuleIcon } from '@/components/executive/module-icon';

type ExecutiveKpiCardProps = {
  item: ExecutiveCardItem;
};

export function ExecutiveKpiCard({ item }: ExecutiveKpiCardProps) {
  const signalToneClass: Record<'green' | 'light-green' | 'yellow' | 'red' | 'neutral', string> = {
    green: 'bg-emerald-500',
    'light-green': 'bg-emerald-300',
    yellow: 'bg-amber-400',
    red: 'bg-rose-500',
    neutral: 'bg-slate-300',
  };
  const statusToneClass: Record<ExecutiveCardItem['status'], string> = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-400',
    red: 'bg-rose-500',
    neutral: 'bg-slate-300',
  };
  const sourceAsOfLabel = (() => {
    const value = String(item.sourceAsOfMonth ?? '').trim();
    if (!value || value === '[object Object]') return null;
    if (!value) return null;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
  })();

  return (
    <article className="group relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_20px_48px_rgba(15,23,42,0.10)] 2xl:rounded-[22px]">

      {/* Accent bar top */}
      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-indigo-500 via-sky-400 to-cyan-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex flex-1 min-w-0 flex-col gap-3.5 p-4 sm:p-5 lg:p-4 xl:p-5 2xl:p-6">

        {/* Header: module + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-500 shadow-sm transition-all duration-200 group-hover:border-indigo-100 group-hover:bg-indigo-50 group-hover:text-indigo-600">
              <ModuleIcon module={item.module} className="h-[18px] w-[18px]" />
            </span>
            <p className="max-w-[150px] truncate text-[10.5px] font-semibold uppercase tracking-[0.20em] text-slate-400 lg:max-w-[120px] lg:text-[10px] xl:max-w-[170px] xl:text-[10.5px]">
              {item.module}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1">
            {item.kpiSignals && item.kpiSignals.length > 0 ? (
              item.kpiSignals.map((signal) => (
                <span
                  key={signal.label}
                  className={`inline-block h-2.5 w-2.5 rounded-full ${signalToneClass[signal.tone]}`}
                  title={`${signal.label}: ${
                    signal.coveragePct == null ? 'N/A' : `${signal.coveragePct.toFixed(1)}%`
                  }`}
                />
              ))
            ) : (
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${statusToneClass[item.status]}`}
                title={`Status: ${item.status}`}
              />
            )}
          </div>
        </div>

        {/* KPI title */}
        <h2 className="text-[16px] font-semibold leading-snug tracking-tight text-slate-900 lg:text-base xl:text-[18px] 2xl:text-xl">
          {item.kpi}
        </h2>

        {/* Actual value */}
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Actual
          </p>
          <span className="block break-words text-[24px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[28px] lg:text-[24px] xl:text-[30px] 2xl:text-[34px]">
            {item.actual}
          </span>
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-slate-100" />

        {/* Target + Variance */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Target
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-800 lg:text-xs xl:text-sm 2xl:text-[15px]">
              {item.target}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Variance
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-800 lg:text-xs xl:text-sm 2xl:text-[15px]">
              {item.variance}
            </p>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="min-h-[26px]">
            {sourceAsOfLabel ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Source As Of: {sourceAsOfLabel}
              </span>
            ) : null}
          </div>
          <div className="shrink-0">
            {item.detailHref ? (
              <Link
                href={item.detailHref}
                className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-700 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-100 hover:shadow-sm sm:text-[13px]"
              >
                View details
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="h-3.5 w-3.5 opacity-70"
                >
                  <path
                    fillRule="evenodd"
                    d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06L7.28 11.78a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-medium text-slate-400 sm:text-[13px]"
              >
                Coming soon
              </button>
            )}
          </div>
        </div>

      </div>
    </article>
  );
}
