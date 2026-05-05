'use client';

import { useMemo, useState } from 'react';
import { AirConfidenceBadge } from '@/components/air/air-confidence-badge';
import type { AirDoctorMatch, AirMatchConfidence } from '@/lib/air/types';

type Props = {
  matches: AirDoctorMatch[];
};

const FILTERS: Array<{ value: 'all' | AirMatchConfidence; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High confidence' },
  { value: 'medium', label: 'Medium confidence' },
  { value: 'low', label: 'Review needed' },
  { value: 'unmatched', label: 'Unmatched' },
];

export function AirDoctorMatchingTable({ matches }: Props) {
  const [filter, setFilter] = useState<'all' | AirMatchConfidence>('all');
  const filteredMatches = useMemo(
    () => (filter === 'all' ? matches : matches.filter((match) => match.matchConfidence === filter)),
    [filter, matches],
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">CloseUp Matching Quality</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            These matches use tokenized fuzzy scoring. Low confidence and unmatched rows should be reviewed before
            using doctor-level productivity for decisions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                filter === item.value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="py-3 pr-4">Medical file name</th>
              <th className="py-3 pr-4">IMS ID</th>
              <th className="py-3 pr-4">Best CloseUp match</th>
              <th className="py-3 pr-4 text-right">Score</th>
              <th className="py-3 pr-4">Confidence</th>
              <th className="py-3 pr-4">Matched tokens</th>
              <th className="py-3">Unmatched tokens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredMatches.slice(0, 80).map((match) => (
              <tr key={`${match.medicalFileImsId}:${match.medicalFileFullName}`} className="text-slate-700">
                <td className="py-3 pr-4 font-semibold text-slate-950">{match.medicalFileFullName}</td>
                <td className="py-3 pr-4 font-mono text-xs">{match.medicalFileImsId}</td>
                <td className="py-3 pr-4">{match.closeupHcpName ?? 'No reliable match'}</td>
                <td className="py-3 pr-4 text-right">{match.matchScore.toFixed(3)}</td>
                <td className="py-3 pr-4"><AirConfidenceBadge confidence={match.matchConfidence} /></td>
                <td className="py-3 pr-4 text-xs text-slate-600">{match.matchedTokens.join(', ') || '-'}</td>
                <td className="py-3 text-xs text-slate-600">{match.unmatchedTokens.join(', ') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredMatches.length > 80 ? (
        <p className="mt-3 text-xs text-slate-500">Showing first 80 rows of {filteredMatches.length} for this filter.</p>
      ) : null}
    </section>
  );
}
