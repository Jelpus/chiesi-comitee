'use client';

import { Fragment, useMemo, useState } from 'react';
import { formatNumber, formatPercent } from '@/components/air/air-format';
import {
  airPublicAffinitySegments,
  airPublicDemandSegments,
} from '@/lib/air/public-segmentation-config';
import type { AirPublicClueSegment, AirPublicPageData } from '@/lib/air/types';

type Props = {
  data: AirPublicPageData;
};

const relevanceStyles: Record<string, { label: string; bg: string; border: string; text: string }> = {
  'A. Strategic Public Demand Centers': {
    label: 'A',
    bg: 'rgba(16, 185, 129, VAR_ALPHA)',
    border: '#6ee7b7',
    text: 'text-emerald-900',
  },
  'B. High Potential Unvisited CLUEs': {
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
  'E. Review / Unmapped': {
    label: 'E',
    bg: 'rgba(148, 163, 184, VAR_ALPHA)',
    border: '#cbd5e1',
    text: 'text-slate-800',
  },
};

function dominantRelevance(clues: AirPublicClueSegment[]) {
  const counts = new Map<string, number>();
  for (const clue of clues) {
    counts.set(clue.airRelevanceSegment, (counts.get(clue.airRelevanceSegment) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'E. Review / Unmapped';
}

function visitLabel(value: boolean) {
  return value ? 'Visited' : 'Not visited';
}

function visitClass(value: boolean) {
  return value
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-indigo-200 bg-indigo-50 text-indigo-700';
}

export function AirPublicSegmentation({ data }: Props) {
  const [visitedStatus, setVisitedStatus] = useState('all');
  const [marketSegment, setMarketSegment] = useState('all');
  const [affinitySegment, setAffinitySegment] = useState('all');
  const [airRelevance, setAirRelevance] = useState('all');
  const demandSegments = airPublicDemandSegments;
  const maxCount = Math.max(1, ...data.matrix.map((cell) => cell.clueCount));
  const countByCell = new Map(
    data.matrix.map((cell) => [`${cell.demandSegment}:${cell.chiesiAffinitySegment}`, cell.clueCount]),
  );
  const cluesByCell = new Map<string, AirPublicClueSegment[]>();
  for (const clue of data.clues) {
    const key = `${clue.demandSegment}:${clue.chiesiAffinitySegment}`;
    const existing = cluesByCell.get(key) ?? [];
    existing.push(clue);
    cluesByCell.set(key, existing);
  }
  const filterOptions = useMemo(() => {
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return {
      marketSegments: unique(data.clues.map((clue) => clue.demandSegment)),
      affinitySegments: unique(data.clues.map((clue) => clue.chiesiAffinitySegment)),
      airRelevanceSegments: unique(data.clues.map((clue) => clue.airRelevanceSegment)),
    };
  }, [data.clues]);
  const filteredClues = data.clues.filter((clue) => {
    const visitedMatch =
      visitedStatus === 'all' ||
      (visitedStatus === 'visited' && clue.visited) ||
      (visitedStatus === 'not_visited' && !clue.visited);
    return (
      visitedMatch &&
      (marketSegment === 'all' || clue.demandSegment === marketSegment) &&
      (affinitySegment === 'all' || clue.chiesiAffinitySegment === affinitySegment) &&
      (airRelevance === 'all' || clue.airRelevanceSegment === airRelevance)
    );
  });

  async function exportToExcel() {
    const XLSX = await import('xlsx');
    const rows = filteredClues.map((clue) => ({
      clue: clue.clue,
      unidad_o_almacen: clue.unitName,
      ruta: clue.territory,
      distrito: clue.district,
      estado: clue.state,
      institucion: clue.institution,
      referencia: clue.reference,
      visited_status: visitLabel(clue.visited),
      market_group: clue.marketGroup,
      public_demand_mat: clue.publicDemandMat,
      chiesi_pieces_mat: clue.chiesiPublicDemandMat,
      chiesi_share_mat: clue.chiesiShareMat,
      demand_segment: clue.demandSegment,
      affinity_segment: clue.chiesiAffinitySegment,
      coverage_segment: clue.visitCoverageSegment,
      air_relevance_segment: clue.airRelevanceSegment,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CLUE Segmentation');
    XLSX.writeFile(workbook, `air_public_clue_segmentation_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="flex flex-col gap-4">
      {data.warnings.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Public data notes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Public CLUEs" value={data.totalClues} />
        <KpiCard label="Visited CLUEs" value={data.visitedClues} />
        <KpiCard label="Public demand MAT" value={data.totalPublicDemandMat} />
        <KpiCard label="Chiesi pieces MAT" value={data.totalChiesiPublicDemandMat} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Public Segmentation Matrix</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Public channel segmentation uses GOB360 CLUE demand over MAT and Chiesi share of dispensed PIEZAS within
            each selected market group.
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
            <div className="grid grid-cols-[220px_repeat(5,minmax(130px,1fr))] gap-2">
              <div />
              {airPublicAffinitySegments.map((affinity) => (
                <div
                  key={affinity}
                  className="rounded-md bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-700"
                >
                  {affinity}
                </div>
              ))}
              {demandSegments.map((demand) => (
                <Fragment key={demand}>
                  <div className="rounded-md bg-slate-100 px-3 py-3 text-sm font-semibold text-slate-700">
                    {demand}
                  </div>
                  {airPublicAffinitySegments.map((affinity) => {
                    const count = countByCell.get(`${demand}:${affinity}`) ?? 0;
                    const intensity = count / maxCount;
                    const cellClues = cluesByCell.get(`${demand}:${affinity}`) ?? [];
                    const relevance = dominantRelevance(cellClues);
                    const style = relevanceStyles[relevance] ?? relevanceStyles['E. Review / Unmapped'];
                    const alpha = (0.1 + intensity * 0.45).toFixed(2);
                    return (
                      <div
                        key={`${demand}:${affinity}`}
                        className={`rounded-md border px-3 py-3 text-center ${style.text}`}
                        style={{
                          backgroundColor: style.bg.replace('VAR_ALPHA', alpha),
                          borderColor: style.border,
                        }}
                        title={cellClues.length > 0 ? relevance : 'No CLUEs in this cell'}
                      >
                        <p className="text-lg font-semibold text-slate-950">{formatNumber(count)}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-slate-700">
                          {cellClues.length > 0 ? (relevanceStyles[relevance]?.label ?? '-') : '-'} relevance
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

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Public AIR Relevance Summary</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {data.relevanceSummary.map((summary) => {
            const style = relevanceStyles[summary.segment] ?? relevanceStyles['E. Review / Unmapped'];
            return (
              <div key={summary.segment} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-xs font-semibold text-white"
                  style={{ backgroundColor: style.border }}
                >
                  {style.label}
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-950">{summary.segment}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{formatNumber(summary.total)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatNumber(summary.publicDemandMat)} pieces MAT · {formatNumber(summary.chiesiPublicDemandMat)} Chiesi
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">CLUE-Level Segmentation</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              This table analyzes public demand centers instead of physicians. Demand comes from GOB360 PC sales by CLUE.
            </p>
          </div>
          <button
            type="button"
            onClick={exportToExcel}
            className="inline-flex w-fit rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            Export Excel
          </button>
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
          <table className="min-w-[1180px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="py-3 pr-4">CLUE</th>
                <th className="py-3 pr-4">Unidad / almacén</th>
                <th className="py-3 pr-4">Ruta</th>
                <th className="py-3 pr-4">Distrito</th>
                <th className="py-3 pr-4">Estado</th>
                <th className="py-3 pr-4">Visit status</th>
                <th className="py-3 pr-4 text-right">Public demand MAT</th>
                <th className="py-3 pr-4 text-right">Chiesi pieces MAT</th>
                <th className="py-3 pr-4 text-right">Chiesi share</th>
                <th className="py-3 pr-4">Demand segment</th>
                <th className="py-3 pr-4">Affinity segment</th>
                <th className="py-3 pr-4">Coverage</th>
                <th className="py-3">AIR relevance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClues.slice(0, 150).map((clue) => (
                <tr key={`${clue.clue}:${clue.marketGroup}`} className="text-slate-700">
                  <td className="py-3 pr-4 font-mono text-xs">{clue.clue}</td>
                  <td className="py-3 pr-4 font-semibold text-slate-950">{clue.unitName}</td>
                  <td className="py-3 pr-4">{clue.territory || 'No route'}</td>
                  <td className="py-3 pr-4">{clue.district || 'No district'}</td>
                  <td className="py-3 pr-4">{clue.state || '-'}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${visitClass(clue.visited)}`}>
                      {visitLabel(clue.visited)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">{formatNumber(clue.publicDemandMat)}</td>
                  <td className="py-3 pr-4 text-right">{formatNumber(clue.chiesiPublicDemandMat)}</td>
                  <td className="py-3 pr-4 text-right">{formatPercent(clue.chiesiShareMat)}</td>
                  <td className="py-3 pr-4">{clue.demandSegment}</td>
                  <td className="py-3 pr-4">{clue.chiesiAffinitySegment}</td>
                  <td className="py-3 pr-4">{clue.visitCoverageSegment}</td>
                  <td className="py-3">{clue.airRelevanceSegment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredClues.length > 150 ? (
          <p className="mt-3 text-xs text-slate-500">Showing first 150 CLUEs of {filteredClues.length} filtered rows.</p>
        ) : null}
      </section>
    </div>
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

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(value)}</p>
    </div>
  );
}
