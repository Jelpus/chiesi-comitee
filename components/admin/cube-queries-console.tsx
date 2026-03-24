'use client';

import { Download, Play } from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  getCubeQueryPeriods,
  getCubeQuerySchema,
  runCubePreviewQuery,
} from '@/app/admin/cube-queries/actions';
import type { PreviewOption } from '@/lib/bigquery/table_preview';

type CubeQueriesConsoleProps = {
  options: PreviewOption[];
};

type SchemaRow = {
  column_name: string;
  data_type: string;
  is_nullable: string;
  ordinal_position: number;
};

type EnrichmentOption = {
  key: 'none' | 'gob360_catalog';
  label: string;
  description: string;
  requiredColumn: string | null;
  selectAliases: string[];
};

type QueryResult = {
  tableId: string;
  rows: Array<Record<string, unknown>>;
};

const ENRICHED_COLUMNS = [
  'catalog_market_group',
  'catalog_product_id',
  'catalog_business_unit_name',
  'catalog_portfolio_name',
  'catalog_brand_name',
  'catalog_subbrand_or_device',
] as const;

function normalizeFilterValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const maybeWrapped = value as Record<string, unknown>;
    if ('value' in maybeWrapped && Object.keys(maybeWrapped).length <= 2) {
      return normalizeFilterValue(maybeWrapped.value);
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function GenericPreviewTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        No rows returned.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-slate-200">
      <table className="min-w-full border-collapse text-xs">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-slate-100 last:border-b-0">
              {columns.map((column) => (
                <td key={`${rowIndex}-${column}`} className="max-w-[320px] truncate px-3 py-2 text-slate-700">
                  {row[column] === null || row[column] === undefined
                    ? 'NULL'
                    : typeof row[column] === 'object'
                      ? JSON.stringify(row[column])
                      : String(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CubeQueriesConsole({ options }: CubeQueriesConsoleProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedBase, setSelectedBase] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [schemaRows, setSchemaRows] = useState<SchemaRow[]>([]);
  const [periodCandidates, setPeriodCandidates] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [periodColumn, setPeriodColumn] = useState('');
  const [periodValues, setPeriodValues] = useState<string[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [enrichmentOptions, setEnrichmentOptions] = useState<EnrichmentOption[]>([]);
  const [enrichmentKey, setEnrichmentKey] = useState<EnrichmentOption['key']>('none');
  const [previewLimit, setPreviewLimit] = useState(1000);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [activeValueFilterColumns, setActiveValueFilterColumns] = useState<string[]>([]);
  const [valueFilters, setValueFilters] = useState<Record<string, string[]>>({});
  const [showOnlyEnrichedRows, setShowOnlyEnrichedRows] = useState(true);

  const groupedOptions = useMemo(() => {
    const map = new Map<string, PreviewOption[]>();
    for (const option of options) {
      const base = option.key.split('.')[0] ?? 'other';
      const current = map.get(base) ?? [];
      current.push(option);
      map.set(base, current);
    }
    return Array.from(map.entries())
      .map(([base, baseOptions]) => ({
        base,
        options: baseOptions.sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.base.localeCompare(b.base));
  }, [options]);

  useEffect(() => {
    if (!selectedBase && groupedOptions.length > 0) {
      setSelectedBase(groupedOptions[0].base);
    }
  }, [groupedOptions, selectedBase]);

  const baseOptions = useMemo(
    () => groupedOptions.find((entry) => entry.base === selectedBase)?.options ?? [],
    [groupedOptions, selectedBase],
  );

  const previewDistinctValues = useMemo(() => {
    if (!result || result.rows.length === 0) return {} as Record<string, string[]>;
    const map: Record<string, Set<string>> = {};
    const columns = Object.keys(result.rows[0] ?? {});
    for (const column of columns) {
      map[column] = new Set<string>();
    }
    for (const row of result.rows) {
      for (const column of columns) {
        map[column].add(normalizeFilterValue(row[column]));
      }
    }
    const finalMap: Record<string, string[]> = {};
    for (const column of columns) {
      const values = Array.from(map[column]).sort((a, b) => a.localeCompare(b));
      if (values.length > 1 && values.length <= 300) {
        finalMap[column] = values;
      }
    }
    return finalMap;
  }, [result]);

  const enrichedRowsCount = useMemo(() => {
    if (!result) return 0;
    return result.rows.filter((row) =>
      ENRICHED_COLUMNS.some((column) => {
        const value = normalizeFilterValue(row[column]);
        return value !== '';
      }),
    ).length;
  }, [result]);

  const previewRowsToDisplay = useMemo(() => {
    if (!result) return [];
    if (!(enrichmentKey === 'gob360_catalog' && showOnlyEnrichedRows)) {
      return result.rows;
    }
    return result.rows.filter((row) =>
      ENRICHED_COLUMNS.some((column) => {
        const value = normalizeFilterValue(row[column]);
        return value !== '';
      }),
    );
  }, [result, enrichmentKey, showOnlyEnrichedRows]);

  useEffect(() => {
    if (baseOptions.length === 0) {
      setSelectedKey('');
      return;
    }

    if (!baseOptions.some((option) => option.key === selectedKey)) {
      setSelectedKey(baseOptions[0].key);
    }
  }, [baseOptions, selectedKey]);

  useEffect(() => {
    if (!selectedKey) return;
    setErrorMessage('');
    setResult(null);
    setActiveValueFilterColumns([]);
    setValueFilters({});
    setShowOnlyEnrichedRows(true);
    setPeriodValues([]);
    setSelectedPeriods([]);
    setPeriodColumn('');

    startTransition(async () => {
      try {
        const response = await getCubeQuerySchema(selectedKey);
        setSchemaRows(response.columns);
        setPeriodCandidates(response.periodCandidates);
        setSelectedColumns(response.columns.slice(0, Math.min(8, response.columns.length)).map((item) => item.column_name));
        setSelectedTableId(response.tableId);
        setEnrichmentOptions(response.enrichments);
        setEnrichmentKey(response.enrichments.some((item) => item.key === 'none') ? 'none' : response.enrichments[0]?.key ?? 'none');
      } catch (error) {
        setSchemaRows([]);
        setPeriodCandidates([]);
        setSelectedColumns([]);
        setEnrichmentOptions([{ key: 'none', label: 'No enrichment', description: '', requiredColumn: null, selectAliases: [] }]);
        setEnrichmentKey('none');
        setErrorMessage(error instanceof Error ? error.message : 'Unable to fetch schema.');
      }
    });
  }, [selectedKey]);

  useEffect(() => {
    if (!selectedKey || !periodColumn) {
      setPeriodValues([]);
      setSelectedPeriods([]);
      return;
    }

    setErrorMessage('');
    startTransition(async () => {
      try {
        const response = await getCubeQueryPeriods(selectedKey, periodColumn);
        setPeriodValues(response.values);
        setSelectedPeriods(response.values.slice(0, Math.min(6, response.values.length)));
      } catch (error) {
        setPeriodValues([]);
        setSelectedPeriods([]);
        setErrorMessage(error instanceof Error ? error.message : 'Unable to fetch period values.');
      }
    });
  }, [periodColumn, selectedKey]);

  function toggleColumn(columnName: string) {
    setSelectedColumns((current) =>
      current.includes(columnName) ? current.filter((item) => item !== columnName) : [...current, columnName],
    );
  }

  function togglePeriod(period: string) {
    setSelectedPeriods((current) =>
      current.includes(period) ? current.filter((item) => item !== period) : [...current, period],
    );
  }

  function toggleValueFilterColumn(columnName: string) {
    setActiveValueFilterColumns((current) => {
      if (current.includes(columnName)) {
        const next = current.filter((item) => item !== columnName);
        setValueFilters((existing) => {
          const clone = { ...existing };
          delete clone[columnName];
          return clone;
        });
        return next;
      }
      return [...current, columnName];
    });
  }

  function setFilterValuesForColumn(columnName: string, values: string[]) {
    setValueFilters((current) => ({
      ...current,
      [columnName]: values,
    }));
  }

  function runPreview() {
    if (!selectedKey) return;
    if (selectedColumns.length === 0) {
      setErrorMessage('Select at least one property.');
      return;
    }
    const safeEnrichmentKey: 'none' | 'gob360_catalog' =
      enrichmentKey === 'gob360_catalog' ? 'gob360_catalog' : 'none';

    setErrorMessage('');
    startTransition(async () => {
      try {
        const response = await runCubePreviewQuery({
          optionKey: selectedKey,
          selectedColumns,
          periodColumn: periodColumn || undefined,
          periodValues: selectedPeriods,
          valueFilters,
          enrichmentKey: safeEnrichmentKey,
          previewLimit,
        });
        setResult({
          tableId: response.tableId,
          rows: response.rows,
        });
      } catch (error) {
        setResult(null);
        setErrorMessage(error instanceof Error ? error.message : 'Unable to execute query.');
      }
    });
  }

  async function exportFullCsv() {
    if (!selectedKey || selectedColumns.length === 0) return;
    const safeEnrichmentKey: 'none' | 'gob360_catalog' =
      enrichmentKey === 'gob360_catalog' ? 'gob360_catalog' : 'none';
    setErrorMessage('');
    try {
      const response = await fetch('/api/admin/cube-queries/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionKey: selectedKey,
          selectedColumns,
          periodColumn: periodColumn || undefined,
          periodValues: selectedPeriods,
          valueFilters,
          enrichmentKey: safeEnrichmentKey,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Export failed.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const filename = `cube_query_${(result?.tableId || selectedTableId || selectedKey).replace(/[^a-zA-Z0-9_.-]/g, '_')}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to export CSV.');
    }
  }

  const selectedEnrichment = enrichmentOptions.find((item) => item.key === enrichmentKey);
  const selectedColumnsSorted = [...selectedColumns].sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-4 rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Base</span>
          <select
            value={selectedBase}
            onChange={(event) => setSelectedBase(event.target.value)}
            className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {groupedOptions.map((item) => (
              <option key={item.base} value={item.base}>
                {item.base}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Tabla</span>
          <select
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
            className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {baseOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Selected table</p>
        <p className="mt-1 font-mono text-xs text-slate-800">{selectedTableId || '-'}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-2 rounded-[14px] border border-slate-200 bg-white p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Propiedades</p>
          <p className="text-xs text-slate-500">
            Select properties to include in the query and export.
          </p>
          <div className="max-h-[260px] overflow-auto rounded-[10px] border border-slate-200">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700">Use</th>
                  <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700">Column</th>
                  <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700">Type</th>
                </tr>
              </thead>
              <tbody>
                {schemaRows.map((row) => (
                  <tr key={row.column_name} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(row.column_name)}
                        onChange={() => toggleColumn(row.column_name)}
                      />
                    </td>
                    <td className="px-2 py-1.5 font-mono text-slate-800">{row.column_name}</td>
                    <td className="px-2 py-1.5 text-slate-700">{row.data_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Filtros y enrichment</p>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Period column</span>
            <select
              value={periodColumn}
              onChange={(event) => setPeriodColumn(event.target.value)}
              className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="">No period filter</option>
              {periodCandidates.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>

          {periodColumn ? (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Periods</p>
              <div className="max-h-[130px] overflow-auto rounded-[10px] border border-slate-200 bg-white p-2">
                {periodValues.length === 0 ? (
                  <p className="text-xs text-slate-500">No period values found.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    {periodValues.map((period) => (
                      <label key={period} className="flex items-center gap-1.5 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedPeriods.includes(period)}
                          onChange={() => togglePeriod(period)}
                        />
                        <span>{period}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Catalog enrichment</span>
            <select
              value={enrichmentKey}
              onChange={(event) => {
                const nextValue = event.target.value as EnrichmentOption['key'];
                setEnrichmentKey(nextValue);
                setShowOnlyEnrichedRows(nextValue === 'gob360_catalog');
              }}
              className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {enrichmentOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {selectedEnrichment?.description ? (
            <p className="text-xs text-slate-600">{selectedEnrichment.description}</p>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Preview row limit</span>
            <input
              type="number"
              min={1}
              max={50000}
              value={previewLimit}
              onChange={(event) => setPreviewLimit(Math.max(1, Math.min(50000, Number(event.target.value) || 1000)))}
              className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            />
          </label>
          <p className="text-xs text-slate-500">
            The preview limit only affects on-screen rows. CSV export runs the full query without LIMIT.
          </p>
        </div>
      </div>

      <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p>
          Selected properties: <span className="font-mono">{selectedColumnsSorted.join(', ') || '-'}</span>
        </p>
      </div>

      {result && Object.keys(previewDistinctValues).length > 0 ? (
        <div className="space-y-3 rounded-[14px] border border-slate-200 bg-white p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Export value filters</p>
          <p className="text-xs text-slate-500">
            Filters are built from preview values and applied to full CSV export.
          </p>

          <div className="max-h-[120px] overflow-auto rounded-[10px] border border-slate-200 bg-slate-50 p-2">
            <div className="grid grid-cols-2 gap-1">
              {Object.keys(previewDistinctValues).sort((a, b) => a.localeCompare(b)).map((column) => (
                <label key={column} className="flex items-center gap-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={activeValueFilterColumns.includes(column)}
                    onChange={() => toggleValueFilterColumn(column)}
                  />
                  <span className="font-mono">{column}</span>
                </label>
              ))}
            </div>
          </div>

          {activeValueFilterColumns.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {activeValueFilterColumns.map((column) => (
                <label key={column} className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {column}
                  </span>
                  <select
                    multiple
                    size={Math.min(8, Math.max(3, previewDistinctValues[column]?.length ?? 3))}
                    value={valueFilters[column] ?? []}
                    onChange={(event) =>
                      setFilterValuesForColumn(
                        column,
                        Array.from(event.target.selectedOptions).map((option) => option.value),
                      )
                    }
                    className="rounded-[10px] border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800"
                  >
                    {(previewDistinctValues[column] ?? []).map((value) => (
                      <option key={`${column}-${value}`} value={value}>
                        {value || '(empty)'}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runPreview}
          disabled={isPending || !selectedKey}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-60"
        >
          <Play className="h-3.5 w-3.5" />
          {isPending ? 'Running...' : 'Run Preview'}
        </button>

        <button
          type="button"
          onClick={exportFullCsv}
          disabled={isPending || !selectedKey || selectedColumns.length === 0}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          Export Full CSV
        </button>
      </div>

      {errorMessage ? (
        <div className="rounded-[14px] border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      {result ? (
        <>
          <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-mono">{result.tableId}</p>
            <p>Rows returned: {result.rows.length.toLocaleString()}</p>
            {enrichmentKey === 'gob360_catalog' ? (
              <p>Enriched rows: {enrichedRowsCount.toLocaleString()} / {result.rows.length.toLocaleString()}</p>
            ) : null}
          </div>

          {enrichmentKey === 'gob360_catalog' ? (
            <div className="rounded-[14px] border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showOnlyEnrichedRows}
                  onChange={(event) => setShowOnlyEnrichedRows(event.target.checked)}
                />
                <span>Show only enriched rows (catalog_* not null)</span>
              </label>
              <p className="mt-1 text-slate-500">
                Visible rows: {previewRowsToDisplay.length.toLocaleString()} / {result.rows.length.toLocaleString()}
              </p>
            </div>
          ) : null}

          <div className="rounded-[14px] border border-slate-100">
            {previewRowsToDisplay.length === 0 ? (
              <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No enriched rows found for the current preview and filters.
              </div>
            ) : (
              <GenericPreviewTable rows={previewRowsToDisplay} />
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
