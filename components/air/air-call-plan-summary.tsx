import { formatNumber } from '@/components/air/air-format';
import type { AirCallPlanMetrics } from '@/lib/air/types';

type Props = {
  callPlan: AirCallPlanMetrics;
};

export function AirCallPlanSummary({ callPlan }: Props) {
  const items = [
    ['Total visit objective', formatNumber(callPlan.global.totalVisitObjective)],
    ['Physicians per territory', formatNumber(callPlan.global.avgPhysiciansPerTerritory, 1)],
    ['Objectives per territory', formatNumber(callPlan.global.avgObjectivePerTerritory, 1)],
    ['Objective per physician', formatNumber(callPlan.global.avgObjectivePerPhysician, 1)],
    ['Shared physician rate', `${formatNumber(callPlan.global.sharedPhysiciansPercentage, 1)}%`],
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-950">Call Plan Overview</h2>
        <p className="text-sm text-slate-600">
          The Call Plan is defined by physician-territory assignments and their visit objective.
        </p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
