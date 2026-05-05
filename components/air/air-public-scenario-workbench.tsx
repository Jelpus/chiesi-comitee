'use client';

import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { AlertTriangle, Gauge, MapPinned, Route, Target } from 'lucide-react';
import { formatNumber, formatPercent } from '@/components/air/air-format';
import { CapacityBadge } from '@/components/air/air-workbench-format';
import {
  buildAirPublicScenarios,
  getAirPublicScenarioById,
} from '@/lib/air/public-scenario-builder';
import { AIR_SCENARIOS } from '@/lib/air/scenario-builder';
import type {
  AirPublicPageData,
  AirPublicRecommendationAction,
  AirPublicScenarioClueRow,
  AirPublicScenarioTerritoryRow,
  ScenarioId,
} from '@/lib/air/types';

type Props = {
  data: AirPublicPageData;
};

const actionLabel: Record<AirPublicRecommendationAction, string> = {
  add_to_route: 'Add to route',
  maintain_coverage: 'Maintain coverage',
  increase_priority: 'Increase priority',
  decrease_priority: 'Decrease priority',
  remove_or_deprioritize: 'Remove / deprioritize',
  review_manually: 'Review manually',
};

const actionClass: Record<AirPublicRecommendationAction, string> = {
  add_to_route: 'border-sky-200 bg-sky-50 text-sky-700',
  maintain_coverage: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  increase_priority: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  decrease_priority: 'border-amber-200 bg-amber-50 text-amber-700',
  remove_or_deprioritize: 'border-rose-200 bg-rose-50 text-rose-700',
  review_manually: 'border-slate-200 bg-slate-100 text-slate-700',
};

const allValue = 'all';

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function AirPublicScenarioWorkbench({ data }: Props) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('balanced_redesign');
  const [action, setAction] = useState(allValue);
  const [state, setState] = useState(allValue);
  const [marketGroup, setMarketGroup] = useState(allValue);
  const [territory, setTerritory] = useState(allValue);
  const [visited, setVisited] = useState(allValue);
  const [demandSegment, setDemandSegment] = useState(allValue);
  const [affinitySegment, setAffinitySegment] = useState(allValue);
  const [relevanceSegment, setRelevanceSegment] = useState(allValue);

  const scenarios = useMemo(() => buildAirPublicScenarios(data.clues), [data.clues]);
  const selectedScenario = getAirPublicScenarioById(scenarios, scenarioId);

  const options = useMemo(
    () => ({
      states: uniqueSorted(selectedScenario.clueRows.map((row) => row.state)),
      marketGroups: uniqueSorted(selectedScenario.clueRows.map((row) => row.marketGroup)),
      territories: uniqueSorted(selectedScenario.clueRows.map((row) => row.recommendedTerritory)),
      demandSegments: uniqueSorted(selectedScenario.clueRows.map((row) => row.demandSegment)),
      affinitySegments: uniqueSorted(selectedScenario.clueRows.map((row) => row.chiesiAffinitySegment)),
      relevanceSegments: uniqueSorted(selectedScenario.clueRows.map((row) => row.airRelevanceSegment)),
    }),
    [selectedScenario.clueRows],
  );

  const filteredRows = useMemo(() => {
    return selectedScenario.clueRows
      .filter((row) => action === allValue || row.recommendationAction === action)
      .filter((row) => state === allValue || row.state === state)
      .filter((row) => marketGroup === allValue || row.marketGroup === marketGroup)
      .filter((row) => territory === allValue || row.recommendedTerritory === territory)
      .filter((row) => {
        if (visited === allValue) return true;
        if (visited === 'visited') return row.visited === true;
        if (visited === 'not_visited') return row.visited === false;
        return true;
      })
      .filter((row) => demandSegment === allValue || row.demandSegment === demandSegment)
      .filter((row) => affinitySegment === allValue || row.chiesiAffinitySegment === affinitySegment)
      .filter((row) => relevanceSegment === allValue || row.airRelevanceSegment === relevanceSegment)
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
  }, [
    action,
    affinitySegment,
    demandSegment,
    marketGroup,
    relevanceSegment,
    scenarioId,
    selectedScenario.clueRows,
    state,
    territory,
    visited,
  ]);

  const summary = selectedScenario.summary;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Public Channel Scenario Workbench</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Scenario support for adding, maintaining or removing CLUEs from public route coverage using GOB360 demand,
            Chiesi share and state-level route feasibility.
          </p>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Scenario</span>
          <select
            value={scenarioId}
            onChange={(event) => setScenarioId(event.target.value as ScenarioId)}
            className="min-w-[260px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500"
          >
            {AIR_SCENARIOS.map((scenario) => (
              <option key={scenario.scenarioId} value={scenario.scenarioId}>
                {scenario.scenarioName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Recommended CLUEs" value={summary.totalCluesRecommended} icon={MapPinned} />
        <SummaryCard label="Recommended visits" value={summary.totalRecommendedVisits} icon={Target} />
        <SummaryCard label="CLUEs added" value={summary.cluesAdded} icon={Route} />
        <SummaryCard label="Capacity utilization" value={formatPercent(summary.capacityUtilization)} icon={Gauge} />
      </div>

      {summary.warnings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0" />
            <div>
              <p className="font-semibold">Scenario notes</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {summary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Filter
          label="Action"
          value={action}
          onChange={setAction}
          options={Object.keys(actionLabel)}
          getLabel={(value) => actionLabel[value as AirPublicRecommendationAction] ?? value}
        />
        <Filter label="State" value={state} onChange={setState} options={options.states} />
        <Filter label="Market group" value={marketGroup} onChange={setMarketGroup} options={options.marketGroups} />
        <Filter label="Recommended route" value={territory} onChange={setTerritory} options={options.territories} />
        <Filter
          label="Visited status"
          value={visited}
          onChange={setVisited}
          options={['visited', 'not_visited']}
          getLabel={(value) => (value === 'visited' ? 'Visited' : 'Not visited')}
        />
        <Filter label="Demand segment" value={demandSegment} onChange={setDemandSegment} options={options.demandSegments} />
        <Filter label="Affinity segment" value={affinitySegment} onChange={setAffinitySegment} options={options.affinitySegments} />
        <Filter label="AIR relevance" value={relevanceSegment} onChange={setRelevanceSegment} options={options.relevanceSegments} />
      </div>

      <PublicRecommendedClueTable rows={filteredRows} />
      <PublicTerritoryImpact rows={selectedScenario.territoryRows} />
    </section>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {typeof value === 'number' ? formatNumber(value, 1) : value}
          </p>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-sky-50 text-sky-700">
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
    </div>
  );
}

function PublicRecommendedClueTable({ rows }: { rows: AirPublicScenarioClueRow[] }) {
  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Recommended Public Call Plan</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[1680px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="py-3 pr-4">CLUE</th>
              <th className="py-3 pr-4">Unidad</th>
              <th className="py-3 pr-4">Market group</th>
              <th className="py-3 pr-4">State</th>
              <th className="py-3 pr-4">Current route</th>
              <th className="py-3 pr-4">Recommended route</th>
              <th className="py-3 pr-4">Visited</th>
              <th className="py-3 pr-4 text-right">Recommended visits</th>
              <th className="py-3 pr-4">Action</th>
              <th className="py-3 pr-4">Reason</th>
              <th className="py-3 pr-4 text-right">Opportunity</th>
              <th className="py-3 pr-4 text-right">Public pieces MAT</th>
              <th className="py-3 pr-4 text-right">Chiesi share</th>
              <th className="py-3 pr-4">Demand</th>
              <th className="py-3 pr-4">Affinity</th>
              <th className="py-3">AIR relevance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 180).map((row) => (
              <tr key={`${row.scenarioId}:${row.clue}:${row.marketGroup}:${row.recommendedTerritory}`} className="text-slate-700">
                <td className="py-3 pr-4 font-mono text-xs">{row.clue}</td>
                <td className="py-3 pr-4 font-semibold text-slate-950">{row.unitName}</td>
                <td className="py-3 pr-4">{row.marketGroup}</td>
                <td className="py-3 pr-4">{row.state || '-'}</td>
                <td className="py-3 pr-4">{row.currentTerritory}</td>
                <td className="py-3 pr-4">{row.recommendedTerritory}</td>
                <td className="py-3 pr-4">{row.visited ? 'Visited' : 'Not visited'}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.recommendedVisits, 1)}</td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${actionClass[row.recommendationAction]}`}>
                    {actionLabel[row.recommendationAction]}
                  </span>
                </td>
                <td className="max-w-[340px] py-3 pr-4 text-xs leading-5 text-slate-600">{row.recommendationReason}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.opportunityScore, 1)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.publicDemandMat)}</td>
                <td className="py-3 pr-4 text-right">{formatPercent(row.chiesiShareMat)}</td>
                <td className="py-3 pr-4">{row.demandSegment}</td>
                <td className="py-3 pr-4">{row.chiesiAffinitySegment}</td>
                <td className="py-3">{row.airRelevanceSegment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 180 ? (
        <p className="mt-3 text-xs text-slate-500">Showing first 180 CLUEs of {formatNumber(rows.length)} filtered rows.</p>
      ) : null}
    </section>
  );
}

function PublicTerritoryImpact({ rows }: { rows: AirPublicScenarioTerritoryRow[] }) {
  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Public Route Capacity Impact</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        CLUE additions are assigned to routes that already visit the same state whenever capacity allows.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="py-3 pr-4">Route</th>
              <th className="py-3 pr-4">District</th>
              <th className="py-3 pr-4">State</th>
              <th className="py-3 pr-4 text-right">Recommended CLUEs</th>
              <th className="py-3 pr-4 text-right">Recommended visits</th>
              <th className="py-3 pr-4 text-right">Standard capacity</th>
              <th className="py-3 pr-4 text-right">Max capacity</th>
              <th className="py-3 pr-4 text-right">Gap vs max</th>
              <th className="py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 60).map((row) => (
              <tr key={row.territory} className="text-slate-700">
                <td className="py-3 pr-4 font-semibold text-slate-950">{row.territory}</td>
                <td className="py-3 pr-4">{row.district}</td>
                <td className="py-3 pr-4">{row.state}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.recommendedClues)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.recommendedVisits, 1)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.availableCapacity)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(row.maxCapacity)}</td>
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
