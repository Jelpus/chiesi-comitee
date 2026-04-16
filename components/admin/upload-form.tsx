'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createUploadRecord, inspectUploadWorkbook } from '@/app/admin/uploads/actions';
import type { UploadFormOptions } from '@/lib/data/uploads/get-upload-form-options';

type UploadFormProps = {
  options: UploadFormOptions;
};

type ModuleAreaCode =
  | 'sales_internal'
  | 'business_excellence'
  | 'commercial_operations'
  | 'human_resources'
  | 'opex'
  | 'other';

function detectModuleArea(moduleCode: string, moduleLabel?: string): ModuleAreaCode {
  const code = moduleCode.trim().toLowerCase();
  const label = (moduleLabel ?? '').trim().toLowerCase();
  const joined = `${code} ${label}`;

  if (code === 'sales_internal' || joined.includes('sales internal')) return 'sales_internal';
  if (code.startsWith('business_excellence') || joined.includes('business excellence'))
    return 'business_excellence';
  if (code.startsWith('commercial_operations') || joined.includes('commercial operations'))
    return 'commercial_operations';
  if (code.startsWith('human_resources') || joined.includes('human resources')) return 'human_resources';
  if (code.startsWith('opex') || joined.includes('opex')) return 'opex';
  return 'other';
}

function moduleAreaLabel(area: ModuleAreaCode) {
  switch (area) {
    case 'sales_internal':
      return 'Sales Internal';
    case 'business_excellence':
      return 'Business Excellence';
    case 'commercial_operations':
      return 'Commercial Operations';
    case 'human_resources':
      return 'Human Resources';
    case 'opex':
      return 'OPEX';
    default:
      return 'Other';
  }
}

function moduleAreaOrder(area: ModuleAreaCode) {
  switch (area) {
    case 'sales_internal':
      return 1;
    case 'business_excellence':
      return 2;
    case 'commercial_operations':
      return 3;
    case 'human_resources':
      return 4;
    case 'opex':
      return 5;
    default:
      return 99;
  }
}

function formatPeriodOptionLabel(periodMonth: string) {
  const date = new Date(`${periodMonth}T00:00:00`);
  if (Number.isNaN(date.getTime())) return periodMonth;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function shiftMonth(periodMonth: string, deltaMonths: number) {
  const date = new Date(`${periodMonth}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return periodMonth;
  date.setUTCMonth(date.getUTCMonth() + deltaMonths);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function isCsvFileName(fileName: string) {
  return /\.csv$/i.test(fileName.trim());
}

type UploadUiStage =
  | 'idle'
  | 'inspecting'
  | 'inspected'
  | 'uploading'
  | 'parsing'
  | 'registering'
  | 'registered'
  | 'error';

function stageProgress(stage: UploadUiStage) {
  switch (stage) {
    case 'inspecting':
      return 15;
    case 'inspected':
      return 30;
    case 'uploading':
      return 45;
    case 'parsing':
      return 70;
    case 'registering':
      return 90;
    case 'registered':
      return 100;
    case 'error':
      return 100;
    default:
      return 0;
  }
}

function stageLabel(stage: UploadUiStage) {
  switch (stage) {
    case 'inspecting':
      return 'Inspecting';
    case 'inspected':
      return 'Inspect complete';
    case 'uploading':
      return 'Uploading';
    case 'parsing':
      return 'Parsing';
    case 'registering':
      return 'Registering';
    case 'registered':
      return 'Registered';
    case 'error':
      return 'Error';
    default:
      return 'Ready';
  }
}

export function UploadForm({ options }: UploadFormProps) {
  const router = useRouter();
  const modulesWithArea = useMemo(
    () =>
      options.modules.map((item) => ({
        ...item,
        area: detectModuleArea(item.value, item.label),
      })),
    [options.modules],
  );
  const areaOptions = useMemo(() => {
    const uniqueAreas = [...new Set(modulesWithArea.map((item) => item.area))];
    return uniqueAreas
      .sort((a, b) => moduleAreaOrder(a) - moduleAreaOrder(b) || moduleAreaLabel(a).localeCompare(moduleAreaLabel(b)))
      .map((area) => ({ value: area, label: moduleAreaLabel(area) }));
  }, [modulesWithArea]);
  const versionPeriodById = useMemo(
    () => new Map(options.versions.map((version) => [version.value, version.periodMonth])),
    [options.versions],
  );

  const initialVersionId = options.versions[0]?.value ?? '';
  const initialPeriodMonth = versionPeriodById.get(initialVersionId) ?? '';
  const periodOptions = useMemo(() => {
    const uniquePeriods = [...new Set(options.versions.map((version) => version.periodMonth))];
    return uniquePeriods.map((value) => ({
      value,
      label: formatPeriodOptionLabel(value),
    }));
  }, [options.versions]);

  const initialArea = areaOptions[0]?.value ?? 'other';
  const [selectedArea, setSelectedArea] = useState<ModuleAreaCode>(initialArea);
  const filteredModules = useMemo(
    () => modulesWithArea.filter((item) => item.area === selectedArea),
    [modulesWithArea, selectedArea],
  );
  const [moduleCode, setModuleCode] = useState(filteredModules[0]?.value ?? options.modules[0]?.value ?? '');
  const [dddSource, setDddSource] = useState('innovair');
  const [reportingVersionId, setReportingVersionId] = useState(initialVersionId);
  const [periodMonth, setPeriodMonth] = useState(initialPeriodMonth);
  const [sourceAsOfMonth, setSourceAsOfMonth] = useState(initialPeriodMonth);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheetOptions, setSheetOptions] = useState<string[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState('');
  const [headerRow, setHeaderRow] = useState('1');
  const [opexJanPreviousCol, setOpexJanPreviousCol] = useState('');
  const [opexJanBudgetCol, setOpexJanBudgetCol] = useState('');
  const [opexJanCurrentCol, setOpexJanCurrentCol] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [inspectMessage, setInspectMessage] = useState('');
  const [uiStage, setUiStage] = useState<UploadUiStage>('idle');
  const [isInspecting, startInspectTransition] = useTransition();
  const [isRegistering, startRegisterTransition] = useTransition();
  const isBusy = isInspecting || isRegistering;
  const asOfOptions = useMemo(() => {
    const anchor = periodMonth || initialPeriodMonth;
    const values = Array.from({ length: 36 }, (_, index) => shiftMonth(anchor, -index));
    return values.map((value) => ({
      value,
      label: formatPeriodOptionLabel(value),
    }));
  }, [periodMonth, initialPeriodMonth]);
  const isDddModule =
    moduleCode === 'business_excellence_ddd' ||
    moduleCode === 'business_excellence_pmm' ||
    moduleCode === 'pmm' ||
    moduleCode === 'ddd';
  const isSellOutModule =
    moduleCode === 'business_excellence_budget_sell_out' ||
    moduleCode === 'business_excellence_sell_out' ||
    moduleCode === 'sell_out';
  const showsSourceSelector = isDddModule || isSellOutModule;
  const isOpexByCcModule = moduleCode === 'opex_by_cc';

  useEffect(() => {
    try {
      const savedDraft = window.sessionStorage.getItem('admin-upload-form-draft');
      if (!savedDraft) return;
      const draft = JSON.parse(savedDraft) as Partial<{
        selectedArea: ModuleAreaCode;
        moduleCode: string;
        dddSource: string;
        reportingVersionId: string;
        periodMonth: string;
        sourceAsOfMonth: string;
        selectedSheetName: string;
        headerRow: string;
        opexJanPreviousCol: string;
        opexJanBudgetCol: string;
        opexJanCurrentCol: string;
      }>;

      if (draft.selectedArea) setSelectedArea(draft.selectedArea);
      if (draft.moduleCode) setModuleCode(draft.moduleCode);
      if (draft.dddSource !== undefined) setDddSource(draft.dddSource);
      if (draft.reportingVersionId) setReportingVersionId(draft.reportingVersionId);
      if (draft.periodMonth) setPeriodMonth(draft.periodMonth);
      if (draft.sourceAsOfMonth) setSourceAsOfMonth(draft.sourceAsOfMonth);
      if (draft.selectedSheetName) setSelectedSheetName(draft.selectedSheetName);
      if (draft.headerRow) setHeaderRow(draft.headerRow);
      if (draft.opexJanPreviousCol !== undefined) setOpexJanPreviousCol(draft.opexJanPreviousCol);
      if (draft.opexJanBudgetCol !== undefined) setOpexJanBudgetCol(draft.opexJanBudgetCol);
      if (draft.opexJanCurrentCol !== undefined) setOpexJanCurrentCol(draft.opexJanCurrentCol);
    } catch {
      // Ignore corrupt session draft and keep defaults.
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        'admin-upload-form-draft',
        JSON.stringify({
          moduleCode,
          selectedArea,
          dddSource,
          reportingVersionId,
          periodMonth,
          sourceAsOfMonth,
          selectedSheetName,
          headerRow,
          opexJanPreviousCol,
          opexJanBudgetCol,
          opexJanCurrentCol,
        }),
      );
    } catch {
      // Ignore session storage failures in the upload form.
    }
  }, [
    dddSource,
    headerRow,
    moduleCode,
    selectedArea,
    periodMonth,
    reportingVersionId,
    selectedSheetName,
    sourceAsOfMonth,
    opexJanPreviousCol,
    opexJanBudgetCol,
    opexJanCurrentCol,
  ]);

  function inspectWorkbook(file: File) {
    const inspectFormData = new FormData();
    inspectFormData.append('file', file);
    inspectFormData.append('moduleCode', moduleCode);
    setInspectMessage('Inspecting file...');
    setUiStage('inspecting');

    startInspectTransition(async () => {
      try {
        const result = await inspectUploadWorkbook(inspectFormData);
        setSheetOptions(result.sheetNames);
        setSelectedSheetName(result.suggestedSheetName);
        setHeaderRow(String(result.suggestedHeaderRow));
        setInspectMessage(`Sheets detected: ${result.sheetNames.length}`);
        setUiStage('inspected');
      } catch (error) {
        setInspectMessage(
          error instanceof Error ? error.message : 'Unable to inspect file.',
        );
        setUiStage('error');
      }
    });
  }

  useEffect(() => {
    if (!moduleCode) {
      if (filteredModules[0]?.value) setModuleCode(filteredModules[0].value);
      return;
    }
    const moduleInsideArea = filteredModules.some((item) => item.value === moduleCode);
    if (!moduleInsideArea) {
      setModuleCode(filteredModules[0]?.value ?? '');
    }
  }, [filteredModules, moduleCode]);

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setSheetOptions([]);
    setSelectedSheetName('');
    setHeaderRow('1');
    setInspectMessage('');

    if (file) {
      if (isCsvFileName(file.name)) {
        setSheetOptions(['CSV']);
        setSelectedSheetName('CSV');
        setHeaderRow('1');
        setInspectMessage('CSV detected: inspection skipped.');
        setUiStage('inspected');
        return;
      }
      inspectWorkbook(file);
    }
  }

  function handleSubmit(formData: FormData) {
    setResultMessage('');

    if (!selectedFile) {
      setResultMessage('You must select a file (.xlsx, .xls, .csv).');
      setUiStage('error');
      return;
    }

    const payload = new FormData();
    for (const [key, value] of formData.entries()) {
      if (key === 'file') continue;
      payload.append(key, value);
    }
    payload.set('file', selectedFile, selectedFile.name);

    setUiStage('uploading');

    startRegisterTransition(async () => {
      let stageStep = 0;
      const stageSequence: UploadUiStage[] = ['uploading', 'parsing', 'registering'];
      const timer = setInterval(() => {
        stageStep = Math.min(stageStep + 1, stageSequence.length - 1);
        setUiStage(stageSequence[stageStep]);
      }, 2200);

      try {
          const result = await createUploadRecord(payload);
          setResultMessage(
            `Upload registered successfully: ${result.uploadId}. Redirecting to Upload Logs to continue with Process and Normalize...`,
          );
          setUiStage('registered');
        try {
          window.sessionStorage.removeItem('admin-upload-form-draft');
        } catch {
          // Ignore session storage failures after successful registration.
        }
        setTimeout(() => {
          router.push(
            `/admin/uploads/logs?readyUploadId=${encodeURIComponent(result.uploadId)}`,
          );
        }, 900);
      } catch (error) {
        console.error('[UploadForm] register upload failed', {
          moduleCode,
          reportingVersionId,
          periodMonth,
          sourceAsOfMonth,
          dddSource,
          opexJanPreviousCol,
          opexJanBudgetCol,
          opexJanCurrentCol,
          selectedSheetName,
          headerRow,
          selectedFileName: selectedFile?.name ?? null,
          selectedFileSize: selectedFile?.size ?? null,
          error,
        });
        setResultMessage(
          error instanceof Error ? error.message : 'Unable to register upload.',
        );
        setUiStage('error');
      } finally {
        clearInterval(timer);
      }
    });
  }

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
      <form action={handleSubmit} className="grid gap-5 lg:grid-cols-2">
        <div className="lg:col-span-2 rounded-[16px] border border-slate-200/80 bg-slate-50/80 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
            <span className="inline-flex items-center gap-2 font-medium">
              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {stageLabel(uiStage)}
            </span>
            <span>{stageProgress(uiStage)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${uiStage === 'error' ? 'bg-rose-500' : 'bg-slate-900'}`}
              style={{ width: `${stageProgress(uiStage)}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] uppercase tracking-[0.14em] text-slate-500 sm:grid-cols-4">
            <span className={uiStage === 'inspecting' || uiStage === 'inspected' || isRegistering ? 'text-slate-900' : ''}>
              Inspecting
            </span>
            <span className={uiStage === 'uploading' || uiStage === 'parsing' || uiStage === 'registering' || uiStage === 'registered' ? 'text-slate-900' : ''}>
              Uploading
            </span>
            <span className={uiStage === 'parsing' || uiStage === 'registering' || uiStage === 'registered' ? 'text-slate-900' : ''}>
              Parsing
            </span>
            <span className={uiStage === 'registering' || uiStage === 'registered' ? 'text-slate-900' : ''}>
              Registered
            </span>
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Area</span>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value as ModuleAreaCode)}
            disabled={isBusy}
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          >
            {areaOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Module</span>
          <select
            name="moduleCode"
            value={moduleCode}
            onChange={(e) => {
              const next = e.target.value;
              setModuleCode(next);
              if (
                next === 'business_excellence_budget_sell_out' ||
                next === 'business_excellence_sell_out' ||
                next === 'sell_out'
              ) {
                setDddSource('privado');
              } else if (
                next === 'business_excellence_ddd' ||
                next === 'business_excellence_pmm' ||
                next === 'pmm' ||
                next === 'ddd'
              ) {
                setDddSource('innovair');
              } else {
                setDddSource('');
              }
            }}
            disabled={isBusy}
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          >
            {filteredModules.map((item) => (
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
            disabled={isBusy}
            onChange={(e) => {
              const selectedVersionId = e.target.value;
              setReportingVersionId(selectedVersionId);
              const selectedPeriod = versionPeriodById.get(selectedVersionId);
              if (selectedPeriod) {
                setPeriodMonth(selectedPeriod);
                setSourceAsOfMonth(selectedPeriod);
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
          <select
            name="periodMonth"
            value={periodMonth}
            disabled={isBusy}
            onChange={(e) => setPeriodMonth(e.target.value)}
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Data As Of</span>
          <select
            name="sourceAsOfMonth"
            value={sourceAsOfMonth}
            disabled={isBusy}
            onChange={(e) => setSourceAsOfMonth(e.target.value)}
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          >
            {asOfOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {showsSourceSelector ? (
          <label className="flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
              {isSellOutModule ? 'Sell Out Source' : 'DDD Source'}
            </span>
            <select
              name="dddSource"
              value={dddSource}
              disabled={isBusy}
              onChange={(e) => setDddSource(e.target.value)}
              className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
            >
              {isSellOutModule ? (
                <>
                  <option value="privado">Privado</option>
                  <option value="gobierno">Gobierno</option>
                </>
              ) : (
                <>
                  <option value="innovair">Innovair</option>
                  <option value="ribuspir">Ribuspir</option>
                  <option value="rinoclenil">Rinoclenil</option>
                </>
              )}
            </select>
          </label>
        ) : (
          <input type="hidden" name="dddSource" value="" />
        )}

        <input type="hidden" name="opexJanPreviousCol" value="" />
        <input type="hidden" name="opexJanBudgetCol" value="" />
        <input type="hidden" name="opexJanCurrentCol" value="" />

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Source file
          </span>
          <input
            name="file"
            type="file"
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel"
            disabled={isBusy}
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
            required
          />

          {inspectMessage ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-slate-600">
              {isInspecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {inspectMessage}
            </p>
          ) : null}
          {selectedFile ? (
            <p className="mt-1 text-xs text-slate-500">
              Selected file: <span className="font-medium text-slate-700">{selectedFile.name}</span>
            </p>
          ) : null}
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            {isOpexByCcModule ? 'Workbook sheets' : 'Data sheet'}
          </span>
          {isOpexByCcModule ? (
            <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
              Uses `Ant`, `Budget`, and `Current` automatically.
            </div>
          ) : (
            <select
              name="selectedSheetName"
              value={selectedSheetName}
              onChange={(e) => setSelectedSheetName(e.target.value)}
              disabled={isBusy}
              className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
            >
              <option value="">Auto (first sheet)</option>
              {sheetOptions.map((sheetName) => (
                <option key={sheetName} value={sheetName}>
                  {sheetName}
                </option>
              ))}
            </select>
          )}
          {isOpexByCcModule ? <input type="hidden" name="selectedSheetName" value={selectedSheetName} /> : null}
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
            disabled={isBusy}
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          />
        </label>

        <div className="lg:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={isBusy}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {isRegistering ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Registering...
              </span>
            ) : (
              'Register upload'
            )}
          </button>

          {resultMessage ? (
            <p className="text-sm text-slate-600">{resultMessage}</p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
