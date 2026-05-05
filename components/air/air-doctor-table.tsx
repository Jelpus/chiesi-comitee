'use client';

import { useMemo, useState } from 'react';
import { AirConfidenceBadge } from '@/components/air/air-confidence-badge';
import { formatNumber, formatPercent } from '@/components/air/air-format';
import type { AirSegmentedDoctor } from '@/lib/air/types';

type Props = {
  doctors: AirSegmentedDoctor[];
  exportHref?: string;
};

const relevanceOrder: Record<string, number> = {
  'A. Strategic Chiesi Lovers': 1,
  'B. High Potential Market Prescribers': 2,
  'C. Maintain / Defend': 3,
  'D. Low Priority': 4,
  'E. Review / Unmatched': 5,
};

export function AirDoctorTable({ doctors, exportHref }: Props) {
  const [visitedStatus, setVisitedStatus] = useState('all');
  const [marketSegment, setMarketSegment] = useState('all');
  const [affinitySegment, setAffinitySegment] = useState('all');
  const [airRelevance, setAirRelevance] = useState('all');

  const visitLabel = (value: boolean | null) => {
    if (value === true) return 'Visited';
    if (value === false) return 'Not visited';
    return 'Not identified';
  };
  const visitClass = (value: boolean | null) => {
    if (value === true) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (value === false) return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    return 'border-slate-200 bg-slate-100 text-slate-600';
  };
  const filterOptions = useMemo(() => {
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return {
      marketSegments: unique(doctors.map((doctor) => doctor.marketVolumeSegment)),
      affinitySegments: unique(doctors.map((doctor) => doctor.chiesiAffinitySegment)),
      airRelevanceSegments: unique(doctors.map((doctor) => doctor.airRelevanceSegment)),
    };
  }, [doctors]);

  const sortedDoctors = [...doctors].filter((doctor) => {
    const visitedMatch =
      visitedStatus === 'all' ||
      (visitedStatus === 'visited' && doctor.closeupVisited === true) ||
      (visitedStatus === 'not_visited' && doctor.closeupVisited === false) ||
      (visitedStatus === 'not_identified' && doctor.closeupVisited == null);
    return (
      visitedMatch &&
      (marketSegment === 'all' || doctor.marketVolumeSegment === marketSegment) &&
      (affinitySegment === 'all' || doctor.chiesiAffinitySegment === affinitySegment) &&
      (airRelevance === 'all' || doctor.airRelevanceSegment === airRelevance)
    );
  }).sort((a, b) => {
    const relevanceDiff =
      (relevanceOrder[a.airRelevanceSegment] ?? 99) - (relevanceOrder[b.airRelevanceSegment] ?? 99);
    if (relevanceDiff !== 0) return relevanceDiff;
    return b.marketRxMat - a.marketRxMat;
  });

  async function exportToExcel() {
    const XLSX = await import('xlsx');
    const rows = sortedDoctors.map((doctor) => ({
      ims_id: doctor.imsId,
      medical_file_full_name: doctor.fullName,
      territories: doctor.territories.join(', '),
      districts: doctor.districts.join(', '),
      territories_count: doctor.territoriesCount,
      districts_count: doctor.districtsCount,
      total_visit_objective: doctor.totalVisitObjective,
      is_shared_between_territories: doctor.isSharedBetweenTerritories,
      closeup_hcp_name: doctor.closeupHcpName ?? '',
      closeup_visit_status: visitLabel(doctor.closeupVisited),
      match_score: doctor.matchScore,
      match_confidence: doctor.matchConfidence,
      matched_tokens: doctor.matchedTokens.join(', '),
      unmatched_tokens: doctor.unmatchedTokens.join(', '),
      market_rx_mat: doctor.marketRxMat,
      chiesi_rx_mat: doctor.chiesiRxMat,
      chiesi_share_mat: doctor.chiesiShareMat,
      market_volume_segment: doctor.marketVolumeSegment,
      chiesi_affinity_segment: doctor.chiesiAffinitySegment,
      air_relevance_segment: doctor.airRelevanceSegment,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Doctor Segmentation');
    XLSX.writeFile(workbook, `air_doctor_segmentation_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Doctor-Level Segmentation</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Unmatched physicians are present in the AIR medical file but were not confidently matched against CloseUp names.
          </p>
        </div>
        {exportHref ? (
          <a
            href={exportHref}
            className="inline-flex w-fit rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            Export full Excel
          </a>
        ) : (
          <button
            type="button"
            onClick={exportToExcel}
            className="inline-flex w-fit rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            Export full Excel
          </button>
        )}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          label="Visited status"
          value={visitedStatus}
          onChange={setVisitedStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'visited', label: 'Visited' },
            { value: 'not_visited', label: 'Not visited' },
            { value: 'not_identified', label: 'Not identified' },
          ]}
        />
        <FilterSelect
          label="Market segment"
          value={marketSegment}
          onChange={setMarketSegment}
          options={[
            { value: 'all', label: 'All' },
            ...filterOptions.marketSegments.map((segment) => ({ value: segment, label: segment })),
          ]}
        />
        <FilterSelect
          label="Affinity segment"
          value={affinitySegment}
          onChange={setAffinitySegment}
          options={[
            { value: 'all', label: 'All' },
            ...filterOptions.affinitySegments.map((segment) => ({ value: segment, label: segment })),
          ]}
        />
        <FilterSelect
          label="AIR relevance"
          value={airRelevance}
          onChange={setAirRelevance}
          options={[
            { value: 'all', label: 'All' },
            ...filterOptions.airRelevanceSegments.map((segment) => ({ value: segment, label: segment })),
          ]}
        />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[1300px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="py-3 pr-4">IMS ID</th>
              <th className="py-3 pr-4">Medical file name</th>
              <th className="py-3 pr-4">Territories</th>
              <th className="py-3 pr-4">Districts</th>
              <th className="py-3 pr-4 text-right">Objective</th>
              <th className="py-3 pr-4">CloseUp name</th>
              <th className="py-3 pr-4">CloseUp visit status</th>
              <th className="py-3 pr-4">Confidence</th>
              <th className="py-3 pr-4 text-right">Market Rx MAT</th>
              <th className="py-3 pr-4 text-right">Chiesi Rx MAT</th>
              <th className="py-3 pr-4 text-right">Chiesi share</th>
              <th className="py-3 pr-4">Market segment</th>
              <th className="py-3 pr-4">Affinity segment</th>
              <th className="py-3">AIR relevance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedDoctors.slice(0, 120).map((doctor) => (
              <tr key={doctor.imsId} className="text-slate-700">
                <td className="py-3 pr-4 font-mono text-xs">{doctor.imsId}</td>
                <td className="py-3 pr-4 font-semibold text-slate-950">{doctor.fullName}</td>
                <td className="py-3 pr-4 text-xs">{doctor.territories.join(', ')}</td>
                <td className="py-3 pr-4 text-xs">{doctor.districts.join(', ')}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(doctor.totalVisitObjective, 1)}</td>
                <td className="py-3 pr-4">{doctor.closeupHcpName ?? 'No reliable match'}</td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${visitClass(doctor.closeupVisited)}`}>
                    {visitLabel(doctor.closeupVisited)}
                  </span>
                </td>
                <td className="py-3 pr-4"><AirConfidenceBadge confidence={doctor.matchConfidence} /></td>
                <td className="py-3 pr-4 text-right">{formatNumber(doctor.marketRxMat)}</td>
                <td className="py-3 pr-4 text-right">{formatNumber(doctor.chiesiRxMat)}</td>
                <td className="py-3 pr-4 text-right">{formatPercent(doctor.chiesiShareMat)}</td>
                <td className="py-3 pr-4">{doctor.marketVolumeSegment}</td>
                <td className="py-3 pr-4">{doctor.chiesiAffinitySegment}</td>
                <td className="py-3">{doctor.airRelevanceSegment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sortedDoctors.length > 120 ? <p className="mt-3 text-xs text-slate-500">Showing first 120 doctors of {sortedDoctors.length}.</p> : null}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
