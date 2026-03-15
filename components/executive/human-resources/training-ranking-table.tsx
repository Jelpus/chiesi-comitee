'use client';

import { useState } from 'react';
import type {
  HumanResourcesTrainingRankingDimension,
  HumanResourcesTrainingRankingRow,
} from '@/types/human-resources';

function formatInt(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

type TrainingRankingTableProps = {
  initialDimension?: HumanResourcesTrainingRankingDimension;
  rowsByDimension: Record<HumanResourcesTrainingRankingDimension, HumanResourcesTrainingRankingRow[]>;
};

const DIMENSIONS: Array<{ key: HumanResourcesTrainingRankingDimension; label: string }> = [
  { key: 'area', label: 'By Area' },
  { key: 'entity_title', label: 'By Entity' },
  { key: 'item_type', label: 'By Item Type' },
  { key: 'instructor', label: 'By Instructor' },
];

export function TrainingRankingTable({
  initialDimension = 'area',
  rowsByDimension,
}: TrainingRankingTableProps) {
  const [dimension, setDimension] = useState<HumanResourcesTrainingRankingDimension>(initialDimension);
  const rows = rowsByDimension[dimension] ?? [];
  const orderedRows = [...rows].sort((a, b) => b.hours - a.hours);

  const labelHeader =
    dimension === 'area'
      ? 'Area'
      : dimension === 'entity_title'
        ? 'Entity Title'
        : dimension === 'item_type'
          ? 'Item Type'
          : 'Instructor';

  return (
    <div className="rounded-[16px] border border-slate-200 bg-slate-50/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Ranking Table</p>
      <div className="mt-2 inline-flex rounded-full border border-slate-200 bg-white p-1">
        {DIMENSIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setDimension(item.key)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
              dimension === item.key
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <th className="py-2">{labelHeader}</th>
              <th className="py-2 text-right">Events</th>
              <th className="py-2 text-right">Hours</th>
              <th className="py-2 text-right">Employees</th>
            </tr>
          </thead>
          <tbody>
            {orderedRows.map((row) => (
              <tr key={`${dimension}-${row.label}`} className="border-b border-slate-100 last:border-b-0">
                <td className="py-2.5 text-slate-900">{row.label}</td>
                <td className="py-2.5 text-right text-slate-700">{formatInt(row.events)}</td>
                <td className="py-2.5 text-right font-semibold text-slate-900">{row.hours.toFixed(1)}</td>
                <td className="py-2.5 text-right text-slate-700">{formatInt(row.employees)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

