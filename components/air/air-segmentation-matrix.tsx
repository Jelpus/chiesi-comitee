import { Fragment } from 'react';
import { airAffinitySegments, airMarketSegments } from '@/lib/air/segment-doctors';
import { formatNumber } from '@/components/air/air-format';
import type { AirSegmentedDoctor, AirSegmentationMatrixCell } from '@/lib/air/types';

type Props = {
  matrix: AirSegmentationMatrixCell[];
  doctors?: AirSegmentedDoctor[];
};

const relevanceStyles: Record<string, { label: string; bg: string; border: string; text: string }> = {
  'A. Strategic Chiesi Lovers': {
    label: 'A',
    bg: 'rgba(16, 185, 129, VAR_ALPHA)',
    border: '#6ee7b7',
    text: 'text-emerald-900',
  },
  'B. High Potential Market Prescribers': {
    label: 'B',
    bg: 'rgba(14, 165, 233, VAR_ALPHA)',
    border: '#7dd3fc',
    text: 'text-sky-900',
  },
  'C. Maintain / Defend': {
    label: 'C',
    bg: 'rgba(99, 102, 241, VAR_ALPHA)',
    border: '#a5b4fc',
    text: 'text-indigo-900',
  },
  'D. Low Priority': {
    label: 'D',
    bg: 'rgba(245, 158, 11, VAR_ALPHA)',
    border: '#fcd34d',
    text: 'text-amber-900',
  },
  'E. Review / Unmatched': {
    label: 'E',
    bg: 'rgba(148, 163, 184, VAR_ALPHA)',
    border: '#cbd5e1',
    text: 'text-slate-800',
  },
};

function dominantRelevance(doctors: AirSegmentedDoctor[]) {
  const counts = new Map<string, number>();
  for (const doctor of doctors) {
    counts.set(doctor.airRelevanceSegment, (counts.get(doctor.airRelevanceSegment) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'E. Review / Unmatched';
}

export function AirSegmentationMatrix({ matrix, doctors = [] }: Props) {
  const countByCell = new Map(
    matrix.map((cell) => [`${cell.marketVolumeSegment}:${cell.chiesiAffinitySegment}`, cell.doctorCount]),
  );
  const doctorsByCell = new Map<string, AirSegmentedDoctor[]>();
  for (const doctor of doctors) {
    const key = `${doctor.marketVolumeSegment}:${doctor.chiesiAffinitySegment}`;
    const existing = doctorsByCell.get(key) ?? [];
    existing.push(doctor);
    doctorsByCell.set(key, existing);
  }
  const maxCount = Math.max(1, ...matrix.map((cell) => cell.doctorCount));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Physician Segmentation Matrix</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Market prescription volume uses MAT quintiles. Chiesi affinity uses Chiesi prescriptions divided by total
          CloseUp prescriptions in MAT.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(relevanceStyles).map(([segment, style]) => (
            <span
              key={segment}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
            >
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded text-[10px] text-white"
                style={{ backgroundColor: style.border }}
              >
                {style.label}
              </span>
              {segment}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[920px]">
          <div className="grid grid-cols-[220px_repeat(5,minmax(120px,1fr))] gap-2">
            <div />
            {airAffinitySegments.map((affinity) => (
              <div key={affinity} className="rounded-md bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-700">
                {affinity}
              </div>
            ))}
            {airMarketSegments.map((market) => (
              <Fragment key={market}>
                <div className="rounded-md bg-slate-100 px-3 py-3 text-sm font-semibold text-slate-700">
                  {market}
                </div>
                {airAffinitySegments.map((affinity) => {
                  const count = countByCell.get(`${market}:${affinity}`) ?? 0;
                  const intensity = count / maxCount;
                  const cellDoctors = doctorsByCell.get(`${market}:${affinity}`) ?? [];
                  const relevance = dominantRelevance(cellDoctors);
                  const style = relevanceStyles[relevance] ?? relevanceStyles['E. Review / Unmatched'];
                  const alpha = (0.1 + intensity * 0.45).toFixed(2);
                  return (
                    <div
                      key={`${market}:${affinity}`}
                      className={`rounded-md border px-3 py-3 text-center ${style.text}`}
                      style={{
                        backgroundColor: style.bg.replace('VAR_ALPHA', alpha),
                        borderColor: style.border,
                      }}
                      title={cellDoctors.length > 0 ? relevance : 'No doctors in this cell'}
                    >
                      <p className="text-lg font-semibold text-slate-950">{formatNumber(count)}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-slate-700">
                        {cellDoctors.length > 0 ? (relevanceStyles[relevance]?.label ?? '-') : '-'} relevance
                      </p>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
