'use client';

import { useMemo, useState } from 'react';
import { AirCallPlanSummary } from '@/components/air/air-call-plan-summary';
import { AirDoctorMatchingTable } from '@/components/air/air-doctor-matching-table';
import { AirDoctorTable } from '@/components/air/air-doctor-table';
import { formatNumber } from '@/components/air/air-format';
import { AirOverviewCards } from '@/components/air/air-overview-cards';
import { AirPublicSegmentation } from '@/components/air/air-public-segmentation';
import { AirRelevanceKpiCards } from '@/components/air/air-relevance-kpi-cards';
import { AirSegmentationMatrix } from '@/components/air/air-segmentation-matrix';
import { AirDistrictTable, AirTerritoryTable } from '@/components/air/air-summary-tables';
import type { AirPageData } from '@/lib/air/types';

type Props = {
  data: AirPageData;
};

type TabKey = 'private-segmentation' | 'public-segmentation' | 'matching' | 'call-plan';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'private-segmentation', label: 'Private Segmentation' },
  { key: 'public-segmentation', label: 'Public Segmentation' },
  { key: 'matching', label: 'Matching quality' },
  { key: 'call-plan', label: 'Call Plan context' },
];

export function AirStrategicWorkspace({ data }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('private-segmentation');
  const [marketGroup, setMarketGroup] = useState(data.selectedMarketGroup);

  const marketGroups = [...new Set([...data.marketGroups, ...(data.publicData?.marketGroups ?? [])])].sort((a, b) =>
    a.localeCompare(b),
  );
  const segmentation = {
    segmentedDoctors: data.segmentedDoctors,
    matrix: data.matrix,
  };

  const visitStats = useMemo(() => {
    const matched = segmentation.segmentedDoctors.filter((doctor) => doctor.matchConfidence !== 'unmatched');
    return {
      visited: segmentation.segmentedDoctors.filter((doctor) => doctor.closeupVisited === true).length,
      notVisited: segmentation.segmentedDoctors.filter((doctor) => doctor.closeupVisited === false).length,
      notIdentified: segmentation.segmentedDoctors.filter((doctor) => doctor.closeupVisited == null).length,
      highOrMedium: matched.filter((doctor) => doctor.matchConfidence === 'high' || doctor.matchConfidence === 'medium').length,
    };
  }, [segmentation.segmentedDoctors]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Strategic Analysis</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Private uses CloseUp physician audit data. Public uses GOB360 CLUE demand and PC route coverage.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
                window.location.href = `/air${params.toString() ? `?${params.toString()}` : ''}`;
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
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
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
        </div>
      </div>

      {activeTab === 'private-segmentation' ? (
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Visited in CloseUp</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(visitStats.visited)}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Not visited in CloseUp</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(visitStats.notVisited)}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Not identified</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(visitStats.notIdentified)}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">High / medium match</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(visitStats.highOrMedium)}</p>
            </div>
          </div>
          <AirSegmentationMatrix matrix={segmentation.matrix} doctors={segmentation.segmentedDoctors} />
          <AirRelevanceKpiCards doctors={segmentation.segmentedDoctors} summaries={data.relevanceSummary} />
          <AirDoctorTable
            doctors={segmentation.segmentedDoctors}
            exportHref={`/api/air/doctor-segmentation/export${
              data.selectedMarketGroup === 'all' ? '' : `?marketGroup=${encodeURIComponent(data.selectedMarketGroup)}`
            }`}
          />
        </div>
      ) : null}

      {activeTab === 'public-segmentation' ? (
        <div className="mt-4">
          {data.publicData ? (
            <AirPublicSegmentation data={data.publicData} />
          ) : (
            <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Public segmentation is waiting for GOB360 data</h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                This view will render CLUE-level demand and visit coverage once GOB360 is available for the selected
                period.
              </p>
            </section>
          )}
        </div>
      ) : null}

      {activeTab === 'matching' ? (
        <div className="mt-4">
          <AirDoctorMatchingTable matches={data.matches} />
        </div>
      ) : null}

      {activeTab === 'call-plan' ? (
        <div className="mt-4 flex flex-col gap-4">
          <AirOverviewCards callPlan={data.callPlan} matches={data.matches} />
          <AirCallPlanSummary callPlan={data.callPlan} />
          <AirDistrictTable rows={data.callPlan.districts} />
          <AirTerritoryTable rows={data.callPlan.territories} />
        </div>
      ) : null}
    </section>
  );
}
