import { formatNumber, formatPercent } from '@/components/air/air-format';
import type { AirRelevanceSummary, AirSegmentedDoctor } from '@/lib/air/types';

type Props = {
  doctors: AirSegmentedDoctor[];
  summaries?: AirRelevanceSummary[];
};

const relevanceOrder = [
  'A. Strategic Chiesi Lovers',
  'B. High Potential Market Prescribers',
  'C. Maintain / Defend',
  'D. Low Priority',
  'E. Review / Unmatched',
];

export function AirRelevanceKpiCards({ doctors, summaries }: Props) {
  const total = doctors.length;
  const rows = summaries ?? relevanceOrder.map((segment) => {
    const segmentDoctors = doctors.filter((doctor) => doctor.airRelevanceSegment === segment);
    return {
      segment,
      total: segmentDoctors.length,
      visited: segmentDoctors.filter((doctor) => doctor.closeupVisited === true).length,
      notVisited: segmentDoctors.filter((doctor) => doctor.closeupVisited === false).length,
      objective: segmentDoctors.reduce((sum, doctor) => sum + doctor.totalVisitObjective, 0),
      marketRx: segmentDoctors.reduce((sum, doctor) => sum + doctor.marketRxMat, 0),
    };
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">AIR Relevance Summary</h2>
        <p className="mt-1 text-sm text-slate-600">
          Count of physicians by strategic relevance for the selected market group.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {rows.map((row) => (
          <div key={row.segment} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="min-h-[36px] text-sm font-semibold leading-5 text-slate-950">{row.segment}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{formatNumber(row.total)}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              {formatPercent(total === 0 ? 0 : row.total / total)} of doctors
            </p>
            <div className="mt-4 space-y-1 text-xs text-slate-600">
              <p>Visited: <span className="font-semibold text-slate-900">{formatNumber(row.visited)}</span></p>
              <p>Not visited: <span className="font-semibold text-slate-900">{formatNumber(row.notVisited)}</span></p>
              <p>Objective: <span className="font-semibold text-slate-900">{formatNumber(row.objective, 1)}</span></p>
              <p>Market Rx MAT: <span className="font-semibold text-slate-900">{formatNumber(row.marketRx)}</span></p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
