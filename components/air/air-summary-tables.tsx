import { formatNumber } from '@/components/air/air-format';
import type { AirDistrictSummary, AirTerritorySummary } from '@/lib/air/types';

type DistrictProps = {
  rows: AirDistrictSummary[];
};

type TerritoryProps = {
  rows: AirTerritorySummary[];
};

export function AirDistrictTable({ rows }: DistrictProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">District Summary</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="py-3 pr-4">District</th>
              <th className="py-3 pr-4 text-right">Territories</th>
              <th className="py-3 pr-4 text-right">Unique physicians</th>
              <th className="py-3 pr-4 text-right">Visit objective</th>
              <th className="py-3 pr-4 text-right">Avg obj / physician</th>
              <th className="py-3 text-right">Shared physicians</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 20).map((row) => (
              <tr key={row.district} className="text-slate-700">
                <td className="py-3 pr-4 font-semibold text-slate-950">{row.district}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.territoryCount)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.uniqueImsIds)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.totalVisitObjective)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.avgObjectivePerPhysician, 1)}</td>
                <td className="py-3 text-right">{formatNumber(row.sharedPhysiciansCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AirTerritoryTable({ rows }: TerritoryProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Territory Summary</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="py-3 pr-4">Territory</th>
              <th className="py-3 pr-4">District</th>
              <th className="py-3 pr-4 text-right">Unique physicians</th>
              <th className="py-3 pr-4 text-right">Visit objective</th>
              <th className="py-3 pr-4 text-right">Avg obj / physician</th>
              <th className="py-3 text-right">Shared physicians</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 30).map((row) => (
              <tr key={row.territory} className="text-slate-700">
                <td className="py-3 pr-4 font-semibold text-slate-950">{row.territory}</td>
                <td className="py-3 pr-4">{row.district}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.uniqueImsIds)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.totalVisitObjective)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.avgObjectivePerPhysician, 1)}</td>
                <td className="py-3 text-right">{formatNumber(row.sharedPhysiciansCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
