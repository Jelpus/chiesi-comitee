'use client';

import { useMemo, useState } from 'react';
import { AirConfidenceBadge } from '@/components/air/air-confidence-badge';
import { formatNumber, formatPercent } from '@/components/air/air-format';
import { ActionBadge, actionLabel } from '@/components/air/air-workbench-format';
import type {
  AirMatchConfidence,
  AirScenarioDoctorRow,
  RecommendationAction,
} from '@/lib/air/types';

type Props = {
  rows: AirScenarioDoctorRow[];
};

const allValue = 'all';

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function visitedLabel(value: boolean | null) {
  if (value === true) return 'Visited';
  if (value === false) return 'Not visited';
  return 'Not identified';
}

export function AirRecommendedCallPlanTable({ rows }: Props) {
  const [district, setDistrict] = useState(allValue);
  const [territory, setTerritory] = useState(allValue);
  const [action, setAction] = useState<typeof allValue | RecommendationAction>(allValue);
  const [visited, setVisited] = useState(allValue);
  const [confidence, setConfidence] = useState<typeof allValue | AirMatchConfidence>(allValue);
  const [marketSegment, setMarketSegment] = useState(allValue);
  const [affinitySegment, setAffinitySegment] = useState(allValue);
  const [relevanceSegment, setRelevanceSegment] = useState(allValue);

  const options = useMemo(
    () => ({
      districts: uniqueSorted(rows.map((row) => row.district)),
      territories: uniqueSorted(rows.map((row) => row.territory)),
      marketSegments: uniqueSorted(rows.map((row) => row.marketVolumeSegment)),
      affinitySegments: uniqueSorted(rows.map((row) => row.chiesiAffinitySegment)),
      relevanceSegments: uniqueSorted(rows.map((row) => row.airRelevanceSegment)),
    }),
    [rows],
  );

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => district === allValue || row.district === district)
      .filter((row) => territory === allValue || row.territory === territory)
      .filter((row) => action === allValue || row.recommendationAction === action)
      .filter((row) => visited === allValue || visitedLabel(row.visited) === visited)
      .filter((row) => confidence === allValue || row.matchConfidence === confidence)
      .filter((row) => marketSegment === allValue || row.marketVolumeSegment === marketSegment)
      .filter((row) => affinitySegment === allValue || row.chiesiAffinitySegment === affinitySegment)
      .filter((row) => relevanceSegment === allValue || row.airRelevanceSegment === relevanceSegment)
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
  }, [action, affinitySegment, confidence, district, marketSegment, relevanceSegment, rows, territory, visited]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Recommended Call Plan</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Suggested physician-territory actions under the selected scenario. Recommendations are decision support and should be reviewed before execution.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Filter label="District" value={district} onChange={setDistrict} options={options.districts} />
        <Filter label="Territory" value={territory} onChange={setTerritory} options={options.territories} />
        <Filter
          label="Action"
          value={action}
          onChange={(value) => setAction(value as typeof allValue | RecommendationAction)}
          options={Object.keys(actionLabel)}
          getLabel={(value) => actionLabel[value as RecommendationAction] ?? value}
        />
        <Filter label="Visited" value={visited} onChange={setVisited} options={['Visited', 'Not visited', 'Not identified']} />
        <Filter
          label="Match confidence"
          value={confidence}
          onChange={(value) => setConfidence(value as typeof allValue | AirMatchConfidence)}
          options={['high', 'medium', 'low', 'unmatched']}
        />
        <Filter label="Market segment" value={marketSegment} onChange={setMarketSegment} options={options.marketSegments} />
        <Filter label="Affinity segment" value={affinitySegment} onChange={setAffinitySegment} options={options.affinitySegments} />
        <Filter label="AIR relevance" value={relevanceSegment} onChange={setRelevanceSegment} options={options.relevanceSegments} />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[1500px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="py-3 pr-4">Doctor</th>
              <th className="py-3 pr-4">IMS ID</th>
              <th className="py-3 pr-4">Territory</th>
              <th className="py-3 pr-4">District</th>
              <th className="py-3 pr-4 text-right">Current</th>
              <th className="py-3 pr-4 text-right">Suggested</th>
              <th className="py-3 pr-4 text-right">Delta</th>
              <th className="py-3 pr-4">Action</th>
              <th className="py-3 pr-4">Reason</th>
              <th className="py-3 pr-4 text-right">Opportunity</th>
              <th className="py-3 pr-4">Market</th>
              <th className="py-3 pr-4">Affinity</th>
              <th className="py-3 pr-4">Visited</th>
              <th className="py-3">Match</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.slice(0, 150).map((row) => (
              <tr key={`${row.imsId}:${row.territory}`} className="text-slate-700">
                <td className="py-3 pr-4 font-semibold text-slate-950">{row.fullName}</td>
                <td className="py-3 pr-4 font-mono text-xs">{row.imsId}</td>
                <td className="py-3 pr-4">{row.territory}</td>
                <td className="py-3 pr-4">{row.district}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.currentObjective, 1)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.scenarioObjective, 1)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.objectiveDelta, 1)}</td>
                <td className="py-3 pr-4"><ActionBadge action={row.recommendationAction} /></td>
                <td className="max-w-[320px] py-3 pr-4 text-xs leading-5 text-slate-600">{row.recommendationReason}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.opportunityScore, 1)}</td>
                <td className="py-3 pr-4">{row.marketVolumeSegment}</td>
                <td className="py-3 pr-4">{row.chiesiAffinitySegment}</td>
                <td className="py-3 pr-4">{visitedLabel(row.visited)}</td>
                <td className="py-3"><AirConfidenceBadge confidence={row.matchConfidence} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredRows.length > 150 ? (
        <p className="mt-3 text-xs text-slate-500">Showing first 150 rows of {formatNumber(filteredRows.length)} filtered assignments.</p>
      ) : null}
      <p className="mt-3 text-xs text-slate-500">
        Covered market Rx in filtered rows: {formatNumber(filteredRows.reduce((total, row) => total + row.marketRxMat, 0))};
        {' '}average Chiesi share: {formatPercent(averageShare(filteredRows))}.
      </p>
    </section>
  );
}

function averageShare(rows: AirScenarioDoctorRow[]) {
  const market = rows.reduce((total, row) => total + row.marketRxMat, 0);
  const chiesi = rows.reduce((total, row) => total + row.chiesiRxMat, 0);
  return market === 0 ? 0 : chiesi / market;
}

function Filter({
  label,
  value,
  onChange,
  options,
  getLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  getLabel?: (value: string) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500"
      >
        <option value={allValue}>All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {getLabel ? getLabel(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}
