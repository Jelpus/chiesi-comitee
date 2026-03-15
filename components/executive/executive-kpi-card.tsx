import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ExecutiveCardItem } from '@/types/executive';
import { ModuleIcon } from '@/components/executive/module-icon';

type ExecutiveKpiCardProps = {
  item: ExecutiveCardItem;
};

export function ExecutiveKpiCard({ item }: ExecutiveKpiCardProps) {
  return (
    <article className="group flex h-full min-h-0 flex-col rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:ring-2 hover:ring-sky-100 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] lg:rounded-[16px] lg:p-3 xl:rounded-[18px] xl:p-4 2xl:rounded-[20px] 2xl:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition group-hover:border-sky-200 group-hover:bg-sky-50 group-hover:text-sky-700">
              <ModuleIcon module={item.module} className="h-5 w-5" />
            </span>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 lg:text-[10px] lg:tracking-[0.18em] xl:text-[11px] xl:tracking-[0.22em]">
              {item.module}
            </p>
          </div>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 lg:text-lg xl:text-[22px] 2xl:text-2xl">
            {item.kpi}
          </h2>
        </div>

        <StatusBadge status={item.status} />
      </div>

      <div className="mt-3 lg:mt-2.5 xl:mt-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Actual</p>
        <div className="mt-1.5 flex items-end gap-3 lg:mt-1">
          <span className="text-2xl font-semibold tracking-tight text-slate-950 lg:text-[26px] xl:text-3xl 2xl:text-[34px]">
            {item.actual}
          </span>
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 lg:gap-x-3 lg:pt-2.5 xl:gap-x-4 xl:pt-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Target</p>
          <p className="mt-1 text-sm font-medium text-slate-900 lg:text-xs xl:text-base">{item.target}</p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Variance</p>
          <p className="mt-1 text-sm font-medium text-slate-900 lg:text-xs xl:text-base">{item.variance}</p>
        </div>

        <div className="col-span-2 mt-1 flex items-center justify-end border-t border-slate-100 pt-3 lg:pt-2.5 xl:pt-3">
          {item.detailHref ? (
            <Link
              href={item.detailHref}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:text-sm"
            >
              View details
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400 sm:text-sm"
            >
              Coming soon
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
