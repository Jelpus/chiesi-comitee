import { formatNumber, formatPercent } from '@/components/air/air-format';
import { CapacityBadge } from '@/components/air/air-workbench-format';
import { MAX_MONTHLY_VISIT_CAPACITY } from '@/lib/air/capacity-model';
import type { AirScenarioTerritoryRow } from '@/lib/air/types';

type Props = {
  rows: AirScenarioTerritoryRow[];
};

export function AirTerritoryCapacityTable({ rows }: Props) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Territory Capacity Impact</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Standard capacity is 160 visits per month. Scenario recommendations are capped at a maximum of{' '}
        {formatNumber(MAX_MONTHLY_VISIT_CAPACITY)} visits per territory per month.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="py-3 pr-4">Territory</th>
              <th className="py-3 pr-4">District</th>
              <th className="py-3 pr-4 text-right">Current visits</th>
              <th className="py-3 pr-4 text-right">Scenario visits</th>
              <th className="py-3 pr-4 text-right">Standard capacity</th>
              <th className="py-3 pr-4 text-right">Max cap</th>
              <th className="py-3 pr-4 text-right">Utilization</th>
              <th className="py-3 pr-4 text-right">Gap</th>
              <th className="py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 40).map((row) => (
              <tr key={row.territory} className="text-slate-700">
                <td className="py-3 pr-4 font-semibold text-slate-950">{row.territory}</td>
                <td className="py-3 pr-4">{row.district}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.currentObjectiveTotal, 1)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.scenarioObjectiveTotal, 1)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.availableCapacity)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(MAX_MONTHLY_VISIT_CAPACITY)}</td>
                <td className="py-3 pr-4 text-right">{formatPercent(row.capacityUtilization)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.capacityGap, 1)}</td>
                <td className="py-3"><CapacityBadge status={row.capacityStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
