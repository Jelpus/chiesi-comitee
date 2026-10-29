'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { createUploadRecord, inspectUploadWorkbook, normalizeExistingUpload, processUpload, publishUpload } from '@/app/admin/uploads/actions';
import type { UploadFormOptions } from '@/lib/data/uploads/get-upload-form-options';
import type { ModuleAreaCode } from '@/lib/data/modules';
import { getWorkbookPolicy, inspectWorkbookSheets } from '@/lib/uploads/workbook-policy';
import { expectedSourceAsOfMonth, formatMonthYear, sourcePeriodPolicyLabel } from '@/lib/uploads/source-period-policy';

type UploadFormProps = {
  options: UploadFormOptions;
};

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
    case 'medical':
      return 'Medical';
    case 'opex':
      return 'OPEX';
    case 'ra_quality_fv':
      return 'RA - Quality - FV';
    case 'legal_compliance':
      return 'Legal & Compliance';
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
    case 'medical':
      return 5;
    case 'opex':
      return 6;
    case 'ra_quality_fv':
      return 7;
    case 'legal_compliance':
      return 8;
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
  | 'processing'
  | 'normalizing'
  | 'publishing'
  | 'completed'
  | 'error';

function stageProgress(stage: UploadUiStage) {
  switch (stage) {
    case 'inspecting':
      return 15;
    case 'inspected':
      return 20;
    case 'uploading':
      return 25;
    case 'parsing':
      return 30;
    case 'registering':
      return 35;
    case 'registered':
      return 40;
    case 'processing':
      return 50;
    case 'normalizing':
      return 75;
    case 'publishing':
      return 90;
    case 'completed':
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
    case 'processing':
      return 'Processing RAW';
    case 'normalizing':
      return 'Normalizing';
    case 'publishing':
      return 'Publishing';
    case 'completed':
      return 'Published';
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
        area: item.areaCode,
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheetOptions, setSheetOptions] = useState<string[]>([]);
  const [detectedPeriodMonths, setDetectedPeriodMonths] = useState<string[]>([]);
  const [validatedThroughMonth, setValidatedThroughMonth] = useState('');
  const [selectedSheetName, setSelectedSheetName] = useState('');
  const [headerRow, setHeaderRow] = useState('1');
  const [opexJanPreviousCol, setOpexJanPreviousCol] = useState('');
  const [opexJanBudgetCol, setOpexJanBudgetCol] = useState('');
  const [opexJanCurrentCol, setOpexJanCurrentCol] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [registeredUploadId, setRegisteredUploadId] = useState<string | null>(null);
  const [autoComplete, setAutoComplete] = useState(true);
  const [inspectMessage, setInspectMessage] = useState('');
  const [uiStage, setUiStage] = useState<UploadUiStage>('idle');
  const [isInspecting, startInspectTransition] = useTransition();
  const [isRegistering, startRegisterTransition] = useTransition();
  const [isCompleting, setIsCompleting] = useState(false);
  const isBusy = isInspecting || isRegistering || isCompleting;
  const selectedModule = modulesWithArea.find((module) => module.value === moduleCode);
  const sourcePeriodOffsetMonths = selectedModule?.sourcePeriodOffsetMonths ?? 0;
  const isGob360Snapshot = moduleCode === 'business_excellence_gob360_air' || moduleCode === 'business_excellence_gob360_care';
  const sourceAsOfMonth = isGob360Snapshot
    ? (validatedThroughMonth ? `${validatedThroughMonth}-01` : '')
    : expectedSourceAsOfMonth(periodMonth || initialPeriodMonth, sourcePeriodOffsetMonths);
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
  const workbookPolicy = getWorkbookPolicy(moduleCode);
  const workbookInspection = useMemo(
    () => inspectWorkbookSheets(moduleCode, sheetOptions),
    [moduleCode, sheetOptions],
  );
  const systemManagesSheets = workbookPolicy.mode !== 'single_user_selected';
  const hasWorkbookSheetErrors = systemManagesSheets && Boolean(selectedFile) && workbookInspection.missingLabels.length > 0;
  const detectedLatestPeriod = detectedPeriodMonths.at(-1) ?? '';
  const hasDetectedPeriodMismatch = Boolean(
    !isGob360Snapshot && detectedLatestPeriod && sourceAsOfMonth && detectedLatestPeriod !== sourceAsOfMonth,
  );

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
        selectedSheetName: string;
        headerRow: string;
        opexJanPreviousCol: string;
        opexJanBudgetCol: string;
        opexJanCurrentCol: string;
      }>;

      if (draft.selectedArea) setSelectedArea(draft.selectedArea);
      if (draft.moduleCode) setModuleCode(draft.moduleCode);
      if (draft.dddSource !== undefined) setDddSource(draft.dddSource);
      const savedVersion = options.versions.find((version) => version.value === draft.reportingVersionId);
      if (savedVersion) {
        setReportingVersionId(savedVersion.value);
        setPeriodMonth(savedVersion.periodMonth);
      }
      if (draft.selectedSheetName) setSelectedSheetName(draft.selectedSheetName);
      if (draft.headerRow) setHeaderRow(draft.headerRow);
      if (draft.opexJanPreviousCol !== undefined) setOpexJanPreviousCol(draft.opexJanPreviousCol);
      if (draft.opexJanBudgetCol !== undefined) setOpexJanBudgetCol(draft.opexJanBudgetCol);
      if (draft.opexJanCurrentCol !== undefined) setOpexJanCurrentCol(draft.opexJanCurrentCol);
    } catch {
      // Ignore corrupt session draft and keep defaults.
    }
  }, [options.versions]);

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
        setDetectedPeriodMonths(result.detectedPeriodMonths);
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
    setValidatedThroughMonth('');
    setSheetOptions([]);
    setSelectedSheetName('');
    setDetectedPeriodMonths([]);
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
    setRegisteredUploadId(null);

    if (!selectedFile) {
      setResultMessage('You must select a file (.xlsx, .xls, .csv).');
      setUiStage('error');
      return;
    }
    if (hasWorkbookSheetErrors) {
      setResultMessage(`Missing required sheets: ${workbookInspection.missingLabels.join(', ')}.`);
      setUiStage('error');
      return;
    }
    if (hasDetectedPeriodMismatch) {
      setResultMessage(
        `Periodo incorrecto: el archivo contiene datos hasta ${formatMonthYear(detectedLatestPeriod)}, pero este módulo espera ${formatMonthYear(sourceAsOfMonth)}.`,
      );
      setUiStage('error');
      return;
    }
    if (isGob360Snapshot && !validatedThroughMonth) {
      setResultMessage('Selecciona el último mes validado del archivo.');
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
    setIsCompleting(true);

    startRegisterTransition(async () => {
      let createdUploadId: string | null = null;
      let stageStep = 0;
      const stageSequence: UploadUiStage[] = ['uploading', 'parsing', 'registering'];
      const timer = setInterval(() => {
        stageStep = Math.min(stageStep + 1, stageSequence.length - 1);
        setUiStage(stageSequence[stageStep]);
      }, 2200);

      try {
          const result = await createUploadRecord(payload);
          createdUploadId = result.uploadId;
          clearInterval(timer);
          setRegisteredUploadId(result.uploadId);
          setUiStage('registered');
        try {
          window.sessionStorage.removeItem('admin-upload-form-draft');
        } catch {
          // Ignore session storage failures after successful registration.
        }
        if (!autoComplete) {
          setResultMessage(`Upload ${result.uploadId} registered. Complete its phases from Upload Logs.`);
          router.push(`/admin/uploads/logs?readyUploadId=${encodeURIComponent(result.uploadId)}`);
          return;
        }
        setUiStage('processing');
        await processUpload(result.uploadId);
        setUiStage('normalizing');
        let normalization: Awaited<ReturnType<typeof normalizeExistingUpload>> | undefined;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          normalization = await normalizeExistingUpload(result.uploadId);
          if (normalization.phase !== 'normalizing') break;
        }
        if (!normalization || normalization.phase !== 'normalized' || normalization.normalizedRows < 1) {
          throw new Error('Normalization produced no staging rows. Review the upload details.');
        }
        setUiStage('publishing');
        await publishUpload(result.uploadId);
        setUiStage('completed');
        setResultMessage(`Upload ${result.uploadId} completed and published.`);
        router.push(`/admin/uploads/logs?readyUploadId=${encodeURIComponent(result.uploadId)}`);
      } catch (error) {
        console.error('[UploadForm] upload flow failed', {
          uploadId: createdUploadId,
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
          `${createdUploadId ? `Upload ${createdUploadId} stopped: ` : ''}${error instanceof Error ? error.message : 'Unable to complete upload.'}`,
        );
        setUiStage('error');
      } finally {
        clearInterval(timer);
        setIsCompleting(false);
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

        {detectedPeriodMonths.length > 0 ? (
          <div className={`rounded-[18px] border px-4 py-3 text-sm lg:col-span-2 ${hasDetectedPeriodMismatch ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
            <p className="font-bold">{hasDetectedPeriodMismatch ? 'El periodo del archivo no coincide' : 'Periodos detectados en el archivo'}</p>
            <p className="mt-1 text-xs leading-5">
              {detectedPeriodMonths.map((period) => formatMonthYear(period)).join(', ')}. Último periodo: {formatMonthYear(detectedLatestPeriod)}.
              {hasDetectedPeriodMismatch ? ` Este módulo espera ${formatMonthYear(sourceAsOfMonth)}.` : isGob360Snapshot ? ' Selecciona el último mes validado; se ignorarán las columnas posteriores.' : ' El periodo coincide con la política del módulo.'}
            </p>
          </div>
        ) : null}

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
              setValidatedThroughMonth('');
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

        <div className="flex flex-col gap-2">
          <label htmlFor="admin-source-as-of-month" className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            {isGob360Snapshot ? 'Último mes validado' : 'Data As Of'}
          </label>
          {isGob360Snapshot ? (
            <>
              <input id="admin-source-as-of-month" type="month" value={validatedThroughMonth}
                max={periodMonth.slice(0, 7)} required disabled={isBusy}
                onChange={(event) => setValidatedThroughMonth(event.target.value)}
                className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950" />
              <p className="text-xs text-slate-600">Solo se cargarán los meses hasta este corte, aunque el Excel contenga columnas posteriores.</p>
            </>
          ) : (
            <div id="admin-source-as-of-month" className="rounded-[18px] border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
              {formatMonthYear(sourceAsOfMonth)} · regla {sourcePeriodPolicyLabel(sourcePeriodOffsetMonths)}
            </div>
          )}
          <input type="hidden" name="sourceAsOfMonth" value={sourceAsOfMonth} />
        </div>

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

        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            {systemManagesSheets ? 'Workbook sheets' : 'Data sheet'}
          </span>
          {systemManagesSheets ? (
            <div className={`rounded-[18px] border px-4 py-3 text-sm ${hasWorkbookSheetErrors ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50/80 text-slate-700'}`}>
              <p className="font-semibold">
                {workbookPolicy.mode === 'multi_required' ? 'The system processes all required sheets automatically.' : 'The system selects the required sheet automatically.'}
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {workbookInspection.checks.map((check) => (
                  <li key={check.label} className={check.resolvedSheetName ? 'text-emerald-700' : selectedFile ? 'text-rose-700' : 'text-slate-500'}>
                    {check.resolvedSheetName ? '✓' : selectedFile ? '✕' : '○'} {check.label}
                    {check.resolvedSheetName && check.resolvedSheetName !== check.label ? ` (${check.resolvedSheetName})` : ''}
                  </li>
                ))}
              </ul>
              {hasWorkbookSheetErrors ? <p className="mt-2 text-xs font-semibold">Select a workbook containing every required sheet.</p> : null}
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
          {systemManagesSheets ? <input type="hidden" name="selectedSheetName" value={selectedSheetName} /> : null}
        </div>

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

        <label className="lg:col-span-2 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={autoComplete}
            onChange={(event) => setAutoComplete(event.target.checked)}
            disabled={isBusy}
          />
          Process, normalize, and publish automatically after registration
        </label>

        <div className="lg:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={isBusy || hasWorkbookSheetErrors || hasDetectedPeriodMismatch || (isGob360Snapshot && !validatedThroughMonth)}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {isCompleting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {stageLabel(uiStage)}...
              </span>
            ) : (
              autoComplete ? 'Register and complete upload' : 'Register upload'
            )}
          </button>

          {resultMessage ? (
            <p className="text-sm text-slate-600">
              {resultMessage}{' '}
              {registeredUploadId && uiStage === 'error' ? <Link className="font-semibold underline" href={`/admin/uploads/${registeredUploadId}`}>View upload</Link> : null}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
