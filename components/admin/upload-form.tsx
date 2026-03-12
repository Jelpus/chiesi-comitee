'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createUploadRecord, inspectUploadWorkbook } from '@/app/admin/uploads/actions';
import type { UploadFormOptions } from '@/lib/data/uploads/get-upload-form-options';

type UploadFormProps = {
  options: UploadFormOptions;
};

export function UploadForm({ options }: UploadFormProps) {
  const router = useRouter();
  const versionPeriodById = useMemo(
    () => new Map(options.versions.map((version) => [version.value, version.periodMonth])),
    [options.versions],
  );

  const initialVersionId = options.versions[0]?.value ?? '';
  const initialPeriodMonth = versionPeriodById.get(initialVersionId) ?? '';

  const [moduleCode, setModuleCode] = useState(options.modules[0]?.value ?? '');
  const [reportingVersionId, setReportingVersionId] = useState(initialVersionId);
  const [periodMonth, setPeriodMonth] = useState(initialPeriodMonth);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheetOptions, setSheetOptions] = useState<string[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState('');
  const [headerRow, setHeaderRow] = useState('1');
  const [resultMessage, setResultMessage] = useState('');
  const [inspectMessage, setInspectMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  function inspectWorkbook(file: File) {
    const inspectFormData = new FormData();
    inspectFormData.append('file', file);
    setInspectMessage('Inspecting file...');

    startTransition(async () => {
      try {
        const result = await inspectUploadWorkbook(inspectFormData);
        setSheetOptions(result.sheetNames);
        setSelectedSheetName(result.suggestedSheetName);
        setHeaderRow(String(result.suggestedHeaderRow));
        setInspectMessage(`Sheets detected: ${result.sheetNames.length}`);
      } catch (error) {
        setInspectMessage(
          error instanceof Error ? error.message : 'Unable to inspect file.',
        );
      }
    });
  }

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setSheetOptions([]);
    setSelectedSheetName('');
    setHeaderRow('1');
    setInspectMessage('');

    if (file) {
      inspectWorkbook(file);
    }
  }

  function handleSubmit(formData: FormData) {
    setResultMessage('');

    if (!selectedFile) {
      setResultMessage('You must select an Excel file.');
      return;
    }

    startTransition(async () => {
      try {
        const result = await createUploadRecord(formData);
        setResultMessage(`Upload registered successfully: ${result.uploadId}`);
        router.refresh();
      } catch (error) {
        setResultMessage(
          error instanceof Error ? error.message : 'Unable to register upload.',
        );
      }
    });
  }

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
      <form action={handleSubmit} className="grid gap-5 lg:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Module</span>
          <select
            name="moduleCode"
            value={moduleCode}
            onChange={(e) => setModuleCode(e.target.value)}
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          >
            {options.modules.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Version</span>
          <select
            name="reportingVersionId"
            value={reportingVersionId}
            onChange={(e) => {
              const selectedVersionId = e.target.value;
              setReportingVersionId(selectedVersionId);
              const selectedPeriod = versionPeriodById.get(selectedVersionId);
              if (selectedPeriod) {
                setPeriodMonth(selectedPeriod);
              }
            }}
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          >
            {options.versions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Period</span>
          <input
            name="periodMonth"
            type="date"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Excel file
          </span>
          <input
            name="file"
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
            required
          />

          {inspectMessage ? <p className="mt-2 text-xs text-slate-600">{inspectMessage}</p> : null}
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Data sheet
          </span>
          <select
            name="selectedSheetName"
            value={selectedSheetName}
            onChange={(e) => setSelectedSheetName(e.target.value)}
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          >
            <option value="">Auto (first sheet)</option>
            {sheetOptions.map((sheetName) => (
              <option key={sheetName} value={sheetName}>
                {sheetName}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Header row
          </span>
          <input
            name="headerRow"
            type="number"
            min={1}
            value={headerRow}
            onChange={(e) => setHeaderRow(e.target.value)}
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          />
        </label>

        <div className="lg:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? 'Registering...' : 'Register upload'}
          </button>

          {resultMessage ? (
            <p className="text-sm text-slate-600">{resultMessage}</p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
