import { Activity, BadgeCheck } from 'lucide-react';
import { formatMonth } from '@/components/air/air-format';
import type { AirReportingVersion } from '@/lib/air/types';

type Props = {
  reportingVersion: AirReportingVersion | null;
};

export function AirRevolutionHeader({ reportingVersion }: Props) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-sky-800">
            <Activity className="h-3.5 w-3.5" />
            AIR Business Unit
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-slate-950">AirRevolution</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            AIR sales force, medical file, call plan and physician productivity analysis.
          </p>
        </div>

        <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:grid-cols-3 lg:min-w-[460px]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Current period</p>
            <p className="mt-1 font-semibold text-slate-950">{formatMonth(reportingVersion?.periodMonth)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Version</p>
            <p className="mt-1 font-semibold text-slate-950">{reportingVersion?.versionName ?? 'Not available'}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Status</p>
            <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-emerald-700">
              <BadgeCheck className="h-4 w-4" />
              {reportingVersion?.status ?? 'No version'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
