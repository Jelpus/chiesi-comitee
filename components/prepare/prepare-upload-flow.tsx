'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, UploadCloud, XCircle } from 'lucide-react';
import {
  confirmReusePreviousUpload,
  prepareCreateUploadRecord,
} from '@/app/prepare/actions';
import { SourceAsOfMonthField } from '@/components/prepare/source-as-of-month-field';
import type { PrepareReportingVersion, PrepareRequirement } from '@/lib/data/prepare';
import { expectedSourceAsOfMonth, formatMonthYear } from '@/lib/uploads/source-period-policy';
import { getWorkbookPolicy, inspectWorkbookSheets } from '@/lib/uploads/workbook-policy';
import { detectWorkbookPeriodMonths } from '@/lib/uploads/workbook-period-detection';

type PrepareUploadFlowProps = {
  requirement: PrepareRequirement;
  selectedVersion: PrepareReportingVersion;
  onCompleted?: () => void;
};

type ProgressModalState = {
  open: boolean;
  title: string;
  detail: string;
  steps: string[];
  activeStep: number;
  finalState: 'running' | 'waiting' | 'success' | 'error';
};

type SignedUploadResponse = {
  ok: boolean;
  uploadId?: string;
  signedUrl?: string;
  storagePath?: string;
  contentType?: string;
  message?: string;
};

const uploadPublishSteps = [
  'Preparar archivo',
  'Subir archivo a almacenamiento',
  'Registrar carga',
  'Confirmar recepcion',
];

function isProductionVersion(version: PrepareReportingVersion) {
  return version.status === 'ready_to_show' || version.status === 'closed';
}

function isCsvFileName(fileName: string) {
  return /\.csv$/i.test(fileName.trim());
}

function normalizeHeaderCandidate(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function readPhysicalSheetRowCells(
  xlsx: typeof import('xlsx'),
  sheet: import('xlsx').WorkSheet,
  rowNumber: number,
) {
  if (!sheet['!ref']) return [];

  const range = xlsx.utils.decode_range(sheet['!ref']);
  const rowIndex = rowNumber - 1;
  if (rowIndex < range.s.r || rowIndex > range.e.r) return [];

  const cells: string[] = [];
  for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
    const address = xlsx.utils.encode_cell({ r: rowIndex, c: colIndex });
    const cell = sheet[address];
    const value = cell?.w ?? cell?.v ?? '';
    const text = String(value ?? '').trim();
    if (text) cells.push(text);
  }

  return cells;
}

function detectExpectedHeaderRowFromSheet(
  xlsx: typeof import('xlsx'),
  sheet: import('xlsx').WorkSheet,
  moduleCode: string,
) {
  if (!sheet['!ref']) return null;

  const range = xlsx.utils.decode_range(sheet['!ref']);
  const lastRowToScan = Math.min(range.e.r, range.s.r + 24);
  const expectedHeadersByModule: Record<string, string[]> = {
    business_excellence_ddd: ['PACK_DES', 'MONTH', 'YEAR'],
    business_excellence_pmm: ['PACK_DES', 'MONTH', 'YEAR'],
    pmm: ['PACK_DES', 'MONTH', 'YEAR'],
    ddd: ['PACK_DES', 'MONTH', 'YEAR'],
    human_resources_open_vacancy: ['ESTATUS', 'AREA', 'MANAGER'],
    business_excellence_recompra_lexicomp: ['DISTRIBUIDOR', 'ANO', 'MES'],
  };
  const expectedHeaders = expectedHeadersByModule[moduleCode] ?? [];
  if (expectedHeaders.length === 0) return null;

  for (let rowIndex = range.s.r; rowIndex <= lastRowToScan; rowIndex += 1) {
    const normalizedCells = new Set(
      readPhysicalSheetRowCells(xlsx, sheet, rowIndex + 1)
        .map(normalizeHeaderCandidate)
        .filter(Boolean),
    );

    const matchesAllHeaders = expectedHeaders.every((column) =>
      normalizedCells.has(normalizeHeaderCandidate(column)),
    );

    if (matchesAllHeaders) return rowIndex + 1;
  }

  return null;
}

function detectLexicompHeaderRowFromSheet(xlsx: typeof import('xlsx'), sheet: import('xlsx').WorkSheet) {
  if (!sheet['!ref']) return null;
  const requiredHeaders = ['DISTRIBUIDOR', 'ANO', 'MES', 'Piezas Vendidas'].map(normalizeHeaderCandidate);
  const range = xlsx.utils.decode_range(sheet['!ref']);
  const lastRowToScan = Math.min(range.e.r, range.s.r + 24);

  for (let rowIndex = range.s.r; rowIndex <= lastRowToScan; rowIndex += 1) {
    const normalizedCells = new Set<string>();
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
      const address = xlsx.utils.encode_cell({ r: rowIndex, c: colIndex });
      const normalizedValue = normalizeHeaderCandidate(sheet[address]?.v);
      if (normalizedValue) normalizedCells.add(normalizedValue);
    }
    if (requiredHeaders.every((header) => normalizedCells.has(header))) {
      return rowIndex + 1;
    }
  }

  return null;
}

function initialProgress(): ProgressModalState {
  return {
    open: false,
    title: '',
    detail: '',
    steps: [],
    activeStep: 0,
    finalState: 'running',
  };
}

function ProgressModal({
  state,
  onClose,
}: {
  state: ProgressModalState;
  onClose: () => void;
}) {
  if (!state.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />
      <section className="relative w-full max-w-lg overflow-hidden rounded-[30px] border border-white/20 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.35)]">
        <div className="bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Preparacion de archivo</p>
              <h2 className="mt-2 text-2xl font-black">{state.title}</h2>
            </div>
            {state.finalState !== 'running' ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
              >
                Cerrar
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{state.detail}</p>
        </div>

        <div className="space-y-3 p-6">
          {state.steps.map((step, index) => {
            const isDone = state.finalState === 'success' ? index <= state.activeStep : index < state.activeStep;
            const isActive = state.finalState === 'running' && index === state.activeStep;
            const isWaitingNext = state.finalState === 'waiting' && index === state.activeStep;
            const isError = state.finalState === 'error' && index === state.activeStep;

            return (
              <div
                key={step}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${isError
                    ? 'border-rose-200 bg-rose-50 text-rose-800'
                    : isDone
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : isActive || isWaitingNext
                        ? 'border-slate-300 bg-slate-50 text-slate-950'
                        : 'border-slate-200 bg-white text-slate-500'
                  }`}
              >
                {isError ? (
                  <XCircle className="h-5 w-5 shrink-0" />
                ) : isDone ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                ) : isWaitingNext ? (
                  <span className="h-5 w-5 shrink-0 rounded-full border border-current" />
                ) : (
                  <span className="h-5 w-5 shrink-0 rounded-full border border-current opacity-40" />
                )}
                <span>{step}</span>
              </div>
            );
          })}

          {state.finalState === 'running' ? (
            <p className="text-xs leading-5 text-slate-500">
              No cierres esta ventana. Si tu conexion es lenta, el proceso puede tardar un poco mas.
            </p>
          ) : null}

          {state.finalState === 'success' ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white transition hover:bg-slate-800"
            >
              <CheckCircle2 className="h-4 w-4" />
              Entendido
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function PrepareUploadFlow({ requirement, selectedVersion, onCompleted }: PrepareUploadFlowProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isInspecting, startInspectTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progressModal, setProgressModal] = useState<ProgressModalState>(initialProgress);

  const production = isProductionVersion(selectedVersion);
  const defaults = requirement.inferredDefaults;
  const [sheetOptions, setSheetOptions] = useState<string[]>(defaults.selectedSheetName ? [defaults.selectedSheetName] : []);
  const [selectedSheetName, setSelectedSheetName] = useState(defaults.selectedSheetName);
  const [selectedHeaderRow, setSelectedHeaderRow] = useState(String(defaults.selectedHeaderRow || 1));
  const [detectedSheetNames, setDetectedSheetNames] = useState<string[]>(defaults.selectedSheetName ? [defaults.selectedSheetName] : []);
  const [detectedPeriodMonths, setDetectedPeriodMonths] = useState<string[]>([]);
  const [inspectMessage, setInspectMessage] = useState(
    defaults.selectedSheetName ? 'Agrega un archivo para continuar...' : '',
  );
  const shouldShowSheetConfig = Boolean(selectedFile);
  const workbookPolicy = getWorkbookPolicy(requirement.module.moduleCode);
  const workbookInspection = inspectWorkbookSheets(requirement.module.moduleCode, detectedSheetNames);
  const systemManagesSheets = workbookPolicy.mode !== 'single_user_selected';
  const hasWorkbookSheetErrors = systemManagesSheets && Boolean(selectedFile) && workbookInspection.missingLabels.length > 0;
  const expectedFilePeriod = expectedSourceAsOfMonth(
    selectedVersion.periodMonth,
    requirement.module.sourcePeriodOffsetMonths,
  );
  const detectedLatestPeriod = detectedPeriodMonths.at(-1) ?? '';
  const hasDetectedPeriodMismatch = Boolean(
    detectedLatestPeriod && expectedFilePeriod && detectedLatestPeriod !== expectedFilePeriod,
  );

  function openProgressModal(input: Omit<ProgressModalState, 'open' | 'finalState'>) {
    setProgressModal({
      ...input,
      open: true,
      finalState: 'running',
    });
  }

  function updateProgressStep(activeStep: number, detail: string) {
    setProgressModal((current) => ({
      ...current,
      activeStep,
      detail,
      finalState: 'running',
    }));
  }

  function finishProgressModal(finalState: 'success' | 'error', detail: string) {
    setProgressModal((current) => ({
      ...current,
      activeStep: finalState === 'success' ? Math.max(current.steps.length - 1, 0) : current.activeStep,
      detail,
      finalState,
    }));
  }

  async function inspectWorkbook(file: File) {
    setInspectMessage('Leyendo hojas del archivo...');
    openProgressModal({
      title: 'Leyendo archivo',
      detail: 'Estamos detectando las hojas disponibles desde tu navegador.',
      steps: ['Leyendo archivo local', 'Detectando hojas', 'Buscando sugerencias', 'Listo para continuar'],
      activeStep: 0,
    });

    startInspectTransition(async () => {
      try {
        updateProgressStep(1, 'Detectando hojas del libro.');
        let detectedLexicompHeaderRow: number | null = null;
        const detectedHeaderRowsBySheet: Record<string, number> = {};
        let workbookPeriodMonths: string[] = [];
        const sheetNames = isCsvFileName(file.name)
          ? ['CSV']
          : await file.arrayBuffer().then(async (buffer) => {
              const xlsx = await import('xlsx');
              const workbook = xlsx.read(buffer, { type: 'array' });
              workbookPeriodMonths = detectWorkbookPeriodMonths(xlsx, workbook, requirement.module.moduleCode);
              if (requirement.module.moduleCode === 'business_excellence_recompra_lexicomp') {
                const detailSheetName = workbook.SheetNames.find((sheetName) => sheetName.trim().toUpperCase() === 'DETALLE DESPLAZAMIENTO');
                const sheet = detailSheetName ? workbook.Sheets[detailSheetName] : null;
                if (sheet) {
                  detectedLexicompHeaderRow = detectLexicompHeaderRowFromSheet(xlsx, sheet);
                }
              }
              for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const detectedHeaderRow = sheet
                  ? detectExpectedHeaderRowFromSheet(xlsx, sheet, requirement.module.moduleCode)
                  : null;
                if (detectedHeaderRow) {
                  detectedHeaderRowsBySheet[sheetName] = detectedHeaderRow;
                }
              }
              return workbook.SheetNames;
            });

        if (sheetNames.length === 0) {
          throw new Error('No se detectaron hojas en el archivo.');
        }

        updateProgressStep(2, 'Aplicando sugerencia de hoja y fila de encabezados.');
        const lexicompSheetName = sheetNames.find((sheetName) => sheetName.trim().toUpperCase() === 'DETALLE DESPLAZAMIENTO');
        const suggestedSheetName = workbookPolicy.mode !== 'single_user_selected'
          ? inspectWorkbookSheets(requirement.module.moduleCode, sheetNames).resolvedSheetNames[0] ?? sheetNames[0] ?? ''
          : defaults.selectedSheetName && sheetNames.includes(defaults.selectedSheetName)
            ? defaults.selectedSheetName
            : requirement.module.moduleCode === 'business_excellence_recompra_lexicomp' && lexicompSheetName
              ? lexicompSheetName
              : sheetNames[0] ?? '';
        const suggestedHeaderRow =
          requirement.module.moduleCode === 'business_excellence_recompra_lexicomp'
            ? detectedLexicompHeaderRow ?? (defaults.selectedHeaderRow || 3)
            : detectedHeaderRowsBySheet[suggestedSheetName]
              ? detectedHeaderRowsBySheet[suggestedSheetName]
            : defaults.selectedHeaderRow && defaults.selectedHeaderRow !== 1
              ? defaults.selectedHeaderRow
              : defaults.selectedHeaderRow || 1;

        setDetectedSheetNames(sheetNames);
        setDetectedPeriodMonths(workbookPeriodMonths);
        setSheetOptions(sheetNames);
        setSelectedSheetName(suggestedSheetName);
        setSelectedHeaderRow(String(suggestedHeaderRow));
        setInspectMessage(`Hojas detectadas: ${sheetNames.length}. Se preselecciono la mejor sugerencia.`);
        finishProgressModal('success', 'Archivo leido correctamente. Revisa la hoja y la fila antes de subirlo.');
      } catch (inspectError) {
        const errorMessage =
          inspectError instanceof Error
            ? inspectError.message
            : 'No se pudo leer el archivo. Puedes completar hoja y fila manualmente.';

        setSheetOptions([]);
        setDetectedSheetNames([]);
        setDetectedPeriodMonths([]);
        setSelectedSheetName(defaults.selectedSheetName);
        setSelectedHeaderRow(String(defaults.selectedHeaderRow || 1));
        setInspectMessage(errorMessage);
        finishProgressModal('error', errorMessage);
      }
    });
  }

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setMessage(null);
    setError(null);
    setDetectedPeriodMonths([]);

    if (!file) {
      setSheetOptions(defaults.selectedSheetName ? [defaults.selectedSheetName] : []);
      setDetectedSheetNames(defaults.selectedSheetName ? [defaults.selectedSheetName] : []);
      setSelectedSheetName(defaults.selectedSheetName);
      setSelectedHeaderRow(String(defaults.selectedHeaderRow || 1));
      setInspectMessage(defaults.selectedSheetName ? 'Sugerencia basada en la carga anterior.' : '');
      return;
    }

    inspectWorkbook(file);
  }

  async function uploadFileDirectly(file: File) {
    const contentType = file.type || 'application/octet-stream';
    const response = await fetch('/api/uploads/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType,
        moduleCode: requirement.module.moduleCode,
        periodMonth: selectedVersion.periodMonth,
      }),
    });
    const signedUpload = (await response.json()) as SignedUploadResponse;
    if (!response.ok || !signedUpload.ok || !signedUpload.signedUrl || !signedUpload.uploadId || !signedUpload.storagePath) {
      throw new Error(signedUpload.message || 'No se pudo preparar la subida del archivo.');
    }

    const uploadResponse = await fetch(signedUpload.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': signedUpload.contentType || contentType },
      body: file,
    });
    if (!uploadResponse.ok) {
      throw new Error('No se pudo subir el archivo al almacenamiento.');
    }

    return {
      uploadId: signedUpload.uploadId,
      storagePath: signedUpload.storagePath,
      sourceFileName: file.name,
      sourceSheetsJson: JSON.stringify(detectedSheetNames.length > 0 ? detectedSheetNames : sheetOptions),
    };
  }

  function runUpload(formData: FormData) {
    setMessage(null);
    setError(null);
    if (!selectedFile) {
      setError('Selecciona un archivo antes de continuar.');
      return;
    }
    if (hasWorkbookSheetErrors) {
      setError(`El archivo no contiene las hojas requeridas: ${workbookInspection.missingLabels.join(', ')}.`);
      return;
    }
    if (hasDetectedPeriodMismatch) {
      setError(
        `Periodo incorrecto: el archivo contiene datos hasta ${formatMonthYear(detectedLatestPeriod)}, pero este módulo espera ${formatMonthYear(expectedFilePeriod)}. Selecciona el archivo correcto.`,
      );
      return;
    }
    const submittedSheetName = String(formData.get('selectedSheetName') ?? selectedSheetName).trim() || selectedSheetName;
    const submittedHeaderRow = String(formData.get('selectedHeaderRow') ?? selectedHeaderRow).trim() || selectedHeaderRow;
    formData.set('selectedSheetName', submittedSheetName);
    formData.set('selectedHeaderRow', submittedHeaderRow);

    openProgressModal({
      title: 'Subiendo archivo',
      detail: 'Paso 1 de 4: preparando el archivo.',
      steps: uploadPublishSteps,
      activeStep: 0,
    });

    startTransition(async () => {
      let currentStep = uploadPublishSteps[0];
      try {
        currentStep = uploadPublishSteps[0];
        updateProgressStep(0, 'Paso 1 de 4: preparando el archivo seleccionado.');

        currentStep = uploadPublishSteps[1];
        updateProgressStep(1, 'Paso 2 de 4: subiendo el archivo al almacenamiento.');
        try {
          const directUpload = await uploadFileDirectly(selectedFile);
          formData.set('uploadId', directUpload.uploadId);
          formData.set('storagePath', directUpload.storagePath);
          formData.set('sourceFileName', directUpload.sourceFileName);
          formData.set('sourceSheetsJson', directUpload.sourceSheetsJson);
          formData.delete('file');
        } catch (directUploadError) {
          console.warn('[PrepareUploadFlow] direct browser upload failed; falling back to server upload', directUploadError);
          formData.delete('uploadId');
          formData.delete('storagePath');
          formData.delete('sourceFileName');
          formData.delete('sourceSheetsJson');
        }

        currentStep = uploadPublishSteps[2];
        updateProgressStep(2, 'Paso 3 de 4: registrando la carga y guardando metadatos.');
        const created = await prepareCreateUploadRecord(formData);
        if (!created.ok || !created.uploadId) {
          throw new Error(created.message);
        }

        currentStep = uploadPublishSteps[3];
        updateProgressStep(3, 'Paso 4 de 4: confirmando recepcion.');
        const successMessage =
          created.message ||
          `Gracias. El archivo fue recibido correctamente. Upload ${created.uploadId}.`;

        setMessage(successMessage);
        formRef.current?.reset();
        setSelectedFile(null);
        setDetectedSheetNames([]);
        finishProgressModal('success', successMessage);
        onCompleted?.();
        router.refresh();
      } catch (uploadError) {
        const errorMessage = uploadError instanceof Error ? uploadError.message : 'No se pudo completar la carga.';
        const detailedError = `Fallo en "${currentStep}": ${errorMessage}`;
        setError(detailedError);
        finishProgressModal('error', detailedError);
      }
    });
  }

  function runReuse(formData: FormData) {
    setMessage(null);
    setError(null);
    openProgressModal({
      title: 'Confirmando reutilizacion',
      detail: 'Estamos registrando el archivo anterior para esta version.',
      steps: ['Validando version', 'Registrando carga', 'Guardando trazabilidad'],
      activeStep: 0,
    });

    startTransition(async () => {
      let stageStep = 0;
      const stageMessages = [
        'Validando que el archivo anterior se puede reutilizar.',
        'Registrando la carga para esta version.',
        'Guardando confirmacion de reutilizacion.',
      ];
      const timer = window.setInterval(() => {
        stageStep = Math.min(stageStep + 1, stageMessages.length - 1);
        updateProgressStep(stageStep, stageMessages[stageStep]);
      }, 2600);

      const result = await confirmReusePreviousUpload(formData);
      window.clearInterval(timer);
      if (result.ok) {
        setMessage(result.message);
        finishProgressModal('success', result.message);
        onCompleted?.();
        router.refresh();
      } else {
        setError(result.message);
        finishProgressModal('error', result.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {requirement.currentUpload?.status === 'uploaded' ? (
        <div className="rounded-[22px] border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-bold text-blue-950">
            Hay una carga registrada para esta version.
          </p>
          <p className="mt-1 text-xs leading-5 text-blue-800">
            Upload {requirement.currentUpload.uploadId}. Si el flujo no termino en Prepare, se puede completar desde Admin / Uploads.
          </p>
        </div>
      ) : null}

      {requirement.latestUpload && requirement.reusable ? (
        <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-950">
            Existe una carga publicada de este archivo en {requirement.latestUpload.periodMonth}.
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Puedes confirmar que sigue siendo el archivo adecuado para esta version o subir una nueva version.
          </p>
          <form action={runReuse} className="mt-3 flex flex-wrap items-center gap-3">
            <input type="hidden" name="moduleCode" value={requirement.module.moduleCode} />
            <input type="hidden" name="areaCode" value={requirement.module.areaCode} />
            <input type="hidden" name="reportingVersionId" value={selectedVersion.reportingVersionId} />
            <input type="hidden" name="originalUploadId" value={requirement.latestUpload.uploadId} />
            <input type="hidden" name="dddSource" value={requirement.dddSource} />
            {production ? (
              <label className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                <input type="checkbox" name="confirmProductionVersion" value="true" required />
                Confirmo actualizar una version en productivo.
              </label>
            ) : null}
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirmar usar el mismo archivo
            </button>
          </form>
        </div>
      ) : null}

      <form ref={formRef} action={runUpload} className="grid gap-4 rounded-[22px] border border-slate-200 bg-white p-4">
        <input type="hidden" name="moduleCode" value={requirement.module.moduleCode} />
        <input type="hidden" name="areaCode" value={requirement.module.areaCode} />
        <input type="hidden" name="reportingVersionId" value={selectedVersion.reportingVersionId} />
        <input type="hidden" name="dddSource" value={requirement.dddSource || defaults.dddSource} />

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Archivo</span>
            <input
              name="file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => handleFileChange(event.currentTarget.files?.[0] ?? null)}
              required
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
            />
            {inspectMessage ? (
              <span className="block text-xs leading-5 text-slate-500">
                {isInspecting ? 'Leyendo archivo... ' : ''}
                {inspectMessage}
              </span>
            ) : null}
          </label>

          <SourceAsOfMonthField
            periodMonth={selectedVersion.periodMonth}
            sourcePeriodOffsetMonths={requirement.module.sourcePeriodOffsetMonths}
          />

        </div>

        {detectedPeriodMonths.length > 0 ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${hasDetectedPeriodMismatch ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
            <p className="font-bold">{hasDetectedPeriodMismatch ? 'El periodo del archivo no coincide' : 'Periodos detectados en el archivo'}</p>
            <p className={`mt-1 text-xs leading-5 ${hasDetectedPeriodMismatch ? 'text-rose-800' : 'text-emerald-800'}`}>
              {detectedPeriodMonths.map((period) => formatMonthYear(period)).join(', ')}. Último periodo: {formatMonthYear(detectedLatestPeriod)}.
              {hasDetectedPeriodMismatch ? ` Este módulo espera ${formatMonthYear(expectedFilePeriod)}; selecciona el archivo correcto.` : ' El periodo coincide con la política del módulo.'}
            </p>
          </div>
        ) : null}

        {systemManagesSheets ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${hasWorkbookSheetErrors ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
            <p className="font-bold">
              {workbookPolicy.mode === 'multi_required' ? 'Hojas procesadas automáticamente' : 'Hoja seleccionada automáticamente'}
            </p>
            <p className="mt-1 text-xs leading-5">
              {workbookPolicy.mode === 'multi_required' ? 'El normalizador utilizará todas las pestañas indicadas.' : 'El normalizador localizará la pestaña indicada; no es necesario seleccionarla.'}
            </p>
            <ul className="mt-2 space-y-1 text-xs font-semibold">
              {workbookInspection.checks.map((check) => (
                <li key={check.label} className={check.resolvedSheetName ? 'text-emerald-700' : selectedFile ? 'text-rose-700' : 'text-slate-500'}>
                  {check.resolvedSheetName ? '✓' : selectedFile ? '✕' : '○'} {check.label}
                  {check.resolvedSheetName && check.resolvedSheetName !== check.label ? ` (${check.resolvedSheetName})` : ''}
                </li>
              ))}
            </ul>
            {hasWorkbookSheetErrors ? <p className="mt-2 text-xs font-bold">Selecciona un Excel que contenga todas las hojas requeridas.</p> : null}
          </div>
        ) : null}

        {shouldShowSheetConfig ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {systemManagesSheets ? (
              <input type="hidden" name="selectedSheetName" value={selectedSheetName} />
            ) : <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Hoja</span>
              {sheetOptions.length > 0 ? (
                <select
                  name="selectedSheetName"
                  value={selectedSheetName}
                  onChange={(event) => setSelectedSheetName(event.target.value)}
                  disabled={isInspecting}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950"
                  required
                >
                  {sheetOptions.map((sheetName) => (
                    <option key={sheetName} value={sheetName}>
                      {sheetName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name="selectedSheetName"
                  value={selectedSheetName}
                  onChange={(event) => setSelectedSheetName(event.target.value)}
                  placeholder="Hoja detectada"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950"
                />
              )}
            </label>}
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Fila de encabezados</span>
              <input
                name="selectedHeaderRow"
                type="number"
                min={1}
                value={selectedHeaderRow}
                onChange={(event) => setSelectedHeaderRow(event.target.value)}
                disabled={isInspecting}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950"
              />
            </label>
            {requirement.module.moduleCode === 'opex_by_cc' ? (
              <div className="grid grid-cols-3 gap-2">
                <input name="opexJanPreviousCol" type="number" min={1} placeholder="Ant." defaultValue={defaults.opexJanPreviousCol ?? ''} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm" />
                <input name="opexJanBudgetCol" type="number" min={1} placeholder="Budget" defaultValue={defaults.opexJanBudgetCol ?? ''} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm" />
                <input name="opexJanCurrentCol" type="number" min={1} placeholder="Actual" defaultValue={defaults.opexJanCurrentCol ?? ''} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm" />
              </div>
            ) : null}
          </div>
        ) : null}

        {production ? (
          <label className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
            <input type="checkbox" name="confirmProductionVersion" value="true" required className="mt-1" />
            <span>
              Esta version ya esta en productivo. Confirmo que quiero continuar con la carga.
            </span>
          </label>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          
          <button
            type="submit"
            disabled={isPending || isInspecting || hasDetectedPeriodMismatch || hasWorkbookSheetErrors}
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-900/15 disabled:opacity-50"
          >
            {isPending || isInspecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Subir archivo
          </button>
        </div>
      </form>

      {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p> : null}

      <ProgressModal
        state={progressModal}
        onClose={() => setProgressModal((current) => ({ ...current, open: false }))}
      />
    </div>
  );
}
