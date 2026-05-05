'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Gauge, Target, Users } from 'lucide-react';
import { AirRecommendedCallPlanTable } from '@/components/air/air-recommended-call-plan-table';
import { AirTerritoryCapacityTable } from '@/components/air/air-territory-capacity-table';
import { formatNumber, formatPercent } from '@/components/air/air-format';
import { AirRevolutionHeader } from '@/components/air/air-revolution-header';
import { AIR_SCENARIOS, buildAirScenarios, getScenarioById } from '@/lib/air/scenario-builder';
import {
  DEFAULT_MONTHLY_VISIT_CAPACITY,
  DEFAULT_VISITS_PER_DAY,
  DEFAULT_WORKING_DAYS_PER_MONTH,
  MAX_MONTHLY_VISIT_CAPACITY,
  MAX_VISITS_PER_DAY,
} from '@/lib/air/capacity-model';
import type { AirPageData, ScenarioId } from '@/lib/air/types';

type Props = {
  data: AirPageData;
};

type WorkbenchTab = 'overview' | 'scenarios' | 'recommended-call-plan';

const tabs: Array<{ key: WorkbenchTab; label: string }> = [
  { key: 'overview', label: 'Strategic overview' },
  { key: 'scenarios', label: 'Scenario builder' },
  { key: 'recommended-call-plan', label: 'Recommended Call Plan' },
];

export function AirScenarioWorkbench({ data }: Props) {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('overview');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('balanced_redesign');
  const [marketGroup, setMarketGroup] = useState(data.selectedMarketGroup);
  const marketGroups = data.marketGroups;

  const scenarios = useMemo(() => {
    return buildAirScenarios(data.medicalRows, data.segmentedDoctors);
  }, [data.medicalRows, data.segmentedDoctors]);

  const selectedScenario = getScenarioById(scenarios, scenarioId);
  const baselineScenario = getScenarioById(scenarios, 'baseline');
  const hasData = Boolean(data.reportingVersion) && data.medicalRows.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <AirRevolutionHeader reportingVersion={data.reportingVersion} />

      {data.warnings.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0" />
            <div>
              <p className="font-semibold">Data notes</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {data.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {!hasData ? (
        <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Workbench is waiting for AIR source data</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Scenario planning requires the AIR medical file and a valid reporting version.
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Call Plan Scenario Workbench</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Decision support for redesigning AIR visit objectives under territory capacity constraints.
              </p>
              <p className="mt-2 max-w-3xl text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Standard: {DEFAULT_VISITS_PER_DAY} visits/day x {DEFAULT_WORKING_DAYS_PER_MONTH} working days ={' '}
                {DEFAULT_MONTHLY_VISIT_CAPACITY} visits/month. Operational max: {MAX_VISITS_PER_DAY} visits/day ={' '}
                {MAX_MONTHLY_VISIT_CAPACITY} visits/month.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Market group</span>
                <select
                  value={marketGroup}
                  onChange={(event) => {
                    const nextMarketGroup = event.target.value;
                    setMarketGroup(nextMarketGroup);
                    const params = new URLSearchParams(window.location.search);
                    if (nextMarketGroup === 'all') params.delete('marketGroup');
                    else params.set('marketGroup', nextMarketGroup);
                    window.location.href = `/air/workbench-private${params.toString() ? `?${params.toString()}` : ''}`;
                  }}
                  className="min-w-[240px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500"
                >
                  <option value="all">All market groups</option>
                  {marketGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>

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
          </div>

          <div className="mt-4 inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded px-3 py-2 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-950'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' ? (
            <StrategicOverview selectedScenario={selectedScenario} baselineScenario={baselineScenario} />
          ) : null}

          {activeTab === 'scenarios' ? (
            <ScenarioImpact selectedScenario={selectedScenario} baselineScenario={baselineScenario} />
          ) : null}

          {activeTab === 'recommended-call-plan' ? (
            <div className="mt-4 flex flex-col gap-4">
              <AirRecommendedCallPlanTable rows={selectedScenario.doctorRows} />
              <AirTerritoryCapacityTable rows={selectedScenario.territoryRows} />
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

function StrategicOverview({
  selectedScenario,
  baselineScenario,
}: {
  selectedScenario: ReturnType<typeof getScenarioById>;
  baselineScenario: ReturnType<typeof getScenarioById>;
}) {
  const summary = selectedScenario.summary;
  const baseline = baselineScenario.summary;
  const cards = [
    {
      label: 'Current visit objective',
      value: formatNumber(summary.totalCurrentObjective, 1),
      icon: Target,
    },
    {
      label: 'Suggested visit objective',
      value: formatNumber(summary.totalRecommendedObjective, 1),
      icon: ArrowRight,
    },
    {
      label: 'Capacity utilization',
      value: formatPercent(summary.capacityUtilization),
      icon: Gauge,
    },
    {
      label: 'Overloaded territories',
      value: formatNumber(summary.territoriesOverloaded),
      icon: AlertTriangle,
    },
    {
      label: 'Underutilized territories',
      value: formatNumber(summary.territoriesUnderutilized),
      icon: Gauge,
    },
    {
      label: 'High potential included',
      value: formatNumber(summary.highPotentialDoctorsIncluded),
      icon: Users,
    },
    {
      label: 'Low priority included',
      value: formatNumber(summary.lowPriorityDoctorsIncluded),
      icon: Users,
    },
    {
      label: 'Doctors requiring review',
      value: formatNumber(summary.doctorsReview),
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-lg font-semibold text-slate-950">{selectedScenario.definition.scenarioName}</h2>
        <p className="mt-1 text-sm text-slate-600">{selectedScenario.definition.description}</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
          Objective delta vs baseline: {formatNumber(summary.totalRecommendedObjective - baseline.totalRecommendedObjective, 1)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{card.value}</p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-sky-50 text-sky-700">
                  <Icon className="h-4.5 w-4.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {summary.warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Scenario warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {summary.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ScenarioImpact({
  selectedScenario,
  baselineScenario,
}: {
  selectedScenario: ReturnType<typeof getScenarioById>;
  baselineScenario: ReturnType<typeof getScenarioById>;
}) {
  const summary = selectedScenario.summary;
  const baseline = baselineScenario.summary;

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ImpactCard label="Doctors added" value={summary.doctorsAdded} baseline={baseline.doctorsAdded} />
        <ImpactCard label="Doctors increased" value={summary.doctorsIncreased} baseline={baseline.doctorsIncreased} />
        <ImpactCard label="Doctors decreased" value={summary.doctorsDecreased} baseline={baseline.doctorsDecreased} />
        <ImpactCard label="Doctors removed" value={summary.doctorsRemoved} baseline={baseline.doctorsRemoved} />
        <ImpactCard label="Market Rx covered" value={summary.marketRxMatCovered} baseline={baseline.marketRxMatCovered} />
        <ImpactCard label="Chiesi Rx covered" value={summary.chiesiRxMatCovered} baseline={baseline.chiesiRxMatCovered} />
        <ImpactCard label="Capacity gap" value={summary.capacityGap} baseline={baseline.capacityGap} />
        <ImpactCard label="Review needed" value={summary.doctorsReview} baseline={baseline.doctorsReview} />
      </div>
      <AirTerritoryCapacityTable rows={selectedScenario.territoryRows} />
    </div>
  );
}

function ImpactCard({ label, value, baseline }: { label: string; value: number; baseline: number }) {
  const delta = value - baseline;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{formatNumber(value, 1)}</p>
      <p className={`mt-1 text-xs font-semibold ${delta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
        {delta >= 0 ? '+' : ''}{formatNumber(delta, 1)} vs baseline
      </p>
    </div>
  );
}
