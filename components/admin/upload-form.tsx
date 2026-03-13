'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createUploadRecord, inspectUploadWorkbook } from '@/app/admin/uploads/actions';
import type { UploadFormOptions } from '@/lib/data/uploads/get-upload-form-options';

type UploadFormProps = {
  options: UploadFormOptions;
};

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

  const [moduleCode, setModuleCode] = useState(options.modules[0]?.value ?? '');
  const [dddSource, setDddSource] = useState('innovair');
  const [reportingVersionId, setReportingVersionId] = useState(initialVersionId);
  const [periodMonth, setPeriodMonth] = useState(initialPeriodMonth);
  const [sourceAsOfMonth, setSourceAsOfMonth] = useState(initialPeriodMonth);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheetOptions, setSheetOptions] = useState<string[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState('');
  const [headerRow, setHeaderRow] = useState('1');
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

  function inspectWorkbook(file: File) {
    const inspectFormData = new FormData();
    inspectFormData.append('file', file);
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

    setUiStage('uploading');

    startRegisterTransition(async () => {
      let stageStep = 0;
      const stageSequence: UploadUiStage[] = ['uploading', 'parsing', 'registering'];
      const timer = setInterval(() => {
        stageStep = Math.min(stageStep + 1, stageSequence.length - 1);
        setUiStage(stageSequence[stageStep]);
      }, 2200);

      try {
        const result = await createUploadRecord(formData);
        setResultMessage(
          `Upload registered successfully: ${result.uploadId}. Redirecting to Upload Logs to continue with Process...`,
        );
        setUiStage('registered');
        setTimeout(() => {
          router.push(
            `/admin/uploads/logs?readyUploadId=${encodeURIComponent(result.uploadId)}`,
          );
        }, 900);
      } catch (error) {
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
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Data sheet
          </span>
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
