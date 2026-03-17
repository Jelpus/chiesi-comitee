'use client';

import { Copy, Database, Download, Play, Table2 } from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  getTableSamplePreview,
  getTableSchemaPreview,
  runTablePreviewQuery,
} from '@/app/admin/tables/actions';
import type { PreviewOption } from '@/lib/bigquery/table_preview';

type TablesConsoleProps = {
  options: PreviewOption[];
};

type SchemaRow = {
  column_name: string;
  data_type: string;
  is_nullable: string;
  ordinal_position: number;
};

type QueryResult = {
  tableId: string;
  rows: Array<Record<string, unknown>>;
};

function normalizeCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';

  const columnSet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columnSet.add(key);
    }
  }

  const columns = Array.from(columnSet);
  const header = columns.map((column) => escapeCsvCell(column)).join(',');
  const body = rows.map((row) =>
    columns
      .map((column) => escapeCsvCell(normalizeCellValue(row[column])))
      .join(','),
  );

  return [header, ...body].join('\n');
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

export function TablesConsole({ options }: TablesConsoleProps) {
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<'sample' | 'query'>('query');
  const [selectedKey, setSelectedKey] = useState(options[0]?.key ?? '');
  const [selectClause, setSelectClause] = useState('*');
  const [querySuffix, setQuerySuffix] = useState('LIMIT 50');
  const [schemaRows, setSchemaRows] = useState<SchemaRow[]>([]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [showAsJson, setShowAsJson] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'ok' | 'error'>('idle');

  const selectedOption = useMemo(
    () => options.find((option) => option.key === selectedKey) ?? null,
    [options, selectedKey],
  );

  const previewLabel = selectedOption?.tableId ?? selectedOption?.label ?? 'No table selected';

  function loadSchema(options?: { clearResult?: boolean }) {
    if (!selectedKey) return;
    const clearResult = options?.clearResult ?? false;
    setErrorMessage('');
    startTransition(async () => {
      try {
        const response = await getTableSchemaPreview(selectedKey);
        setSchemaRows(response.columns);
        if (clearResult) setResult(null);
      } catch (error) {
        setSchemaRows([]);
        if (clearResult) setResult(null);
        setErrorMessage(error instanceof Error ? error.message : 'Unable to fetch schema.');
      }
    });
  }

  function runSample() {
    if (!selectedKey) return;
    setErrorMessage('');
    startTransition(async () => {
      try {
        const response = await getTableSamplePreview(selectedKey, 25);
        setResult({
          tableId: response.tableId,
          rows: response.rows,
        });
        setSchemaRows([]);
      } catch (error) {
        setResult(null);
        setSchemaRows([]);
        setErrorMessage(error instanceof Error ? error.message : 'Unable to fetch sample.');
      }
    });
  }

  function runQuery() {
    if (!selectedKey) return;
    setErrorMessage('');
    startTransition(async () => {
      try {
        const response = await runTablePreviewQuery(selectedKey, selectClause, querySuffix);
        setResult({
          tableId: response.tableId,
          rows: response.rows,
        });
        setSchemaRows([]);
      } catch (error) {
        setResult(null);
        setSchemaRows([]);
        setErrorMessage(error instanceof Error ? error.message : 'Unable to execute query.');
      }
    });
  }

  const runCurrent = mode === 'sample' ? runSample : runQuery;

  async function copyJsonResult() {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
      setCopyFeedback('ok');
    } catch {
      setCopyFeedback('error');
    }

    setTimeout(() => setCopyFeedback('idle'), 1800);
  }

  function downloadCsvResult() {
    if (!result) return;

    const csvContent = toCsv(result.rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filename = `${result.tableId.replace(/[^a-zA-Z0-9_.-]/g, '_')}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function appendColumnToSelect(columnName: string) {
    const trimmed = selectClause.trim();
    if (!trimmed || trimmed === '*') {
      setSelectClause(columnName);
      return;
    }

    const currentItems = trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (currentItems.includes(columnName)) return;
    setSelectClause(`${trimmed}, ${columnName}`);
  }

  useEffect(() => {
    if (mode === 'query') {
      loadSchema({ clearResult: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedKey]);

  return (
    <div className="space-y-4 rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Table</span>
          <select
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
            className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setMode('sample')}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
            mode === 'sample' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-700'
          }`}
        >
          Sample
        </button>
        <button
          type="button"
          onClick={() => setMode('query')}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
            mode === 'query' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-700'
          }`}
        >
          Query
        </button>
      </div>

      <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Selected</p>
        <p className="mt-1 font-mono text-xs text-slate-800">{previewLabel}</p>
      </div>

      {mode === 'query' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-2 rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Query Builder</p>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">SELECT</span>
              <input
                value={selectClause}
                onChange={(event) => setSelectClause(event.target.value)}
                className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800"
                placeholder="* or brand_name, ytd_units, ytd_net_sales"
              />
            </label>
            <p className="font-mono text-xs text-slate-700">FROM `{selectedOption?.tableId ?? ''}`</p>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Conditions / Order / Limit</span>
              <textarea
                value={querySuffix}
                onChange={(event) => setQuerySuffix(event.target.value)}
                className="min-h-[88px] w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800"
                placeholder="WHERE market_group = 'Asma' ORDER BY period_month DESC LIMIT 50"
              />
            </label>
          </div>

          <div className="rounded-[14px] border border-slate-200 bg-white p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Schema (Quick View)</p>
            <div className="mt-2 max-h-[220px] overflow-auto rounded-[10px] border border-slate-200">
              <table className="min-w-full border-collapse text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700">Column</th>
                    <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {schemaRows.map((row) => (
                    <tr key={row.column_name} className="border-b border-slate-100 last:border-b-0">
                      <td
                        className="cursor-pointer px-2 py-1.5 font-mono text-slate-800 hover:bg-slate-100"
                        onDoubleClick={() => appendColumnToSelect(row.column_name)}
                        title="Double click to add to SELECT"
                      >
                        {row.column_name}
                      </td>
                      <td className="px-2 py-1.5 text-slate-700">{row.data_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runCurrent}
          disabled={!selectedKey || isPending}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-60"
        >
          {mode === 'query' ? <Play className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {isPending ? 'Running...' : mode === 'sample' ? 'Load Sample' : 'Run Query'}
        </button>
        <button
          type="button"
          onClick={() => setShowAsJson((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700"
        >
          <Database className="h-3.5 w-3.5" />
          {showAsJson ? 'Table View' : 'JSON View'}
        </button>
        {showAsJson && result ? (
          <>
            <button
              type="button"
              onClick={copyJsonResult}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700"
            >
              <Copy className="h-3.5 w-3.5" />
              {copyFeedback === 'ok' ? 'Copied' : copyFeedback === 'error' ? 'Copy Error' : 'Copy JSON'}
            </button>
            <button
              type="button"
              onClick={downloadCsvResult}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </button>
          </>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="rounded-[14px] border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      {result ? (
        showAsJson ? (
          <pre className="max-h-[540px] overflow-auto rounded-[14px] border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
            {JSON.stringify(result.rows, null, 2)}
          </pre>
        ) : (
          <GenericPreviewTable rows={result.rows} />
        )
      ) : null}
    </div>
  );
}
