'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CopyCheck,
  Download,
  FileWarning,
  FolderOpen,
  HelpCircle,
  Info,
  Layers3,
  Search,
  UploadCloud,
} from 'lucide-react';
import { PrepareUploadFlow } from '@/components/prepare/prepare-upload-flow';
import { PrepareVersionSelector } from '@/components/prepare/prepare-version-selector';
import { ProductionVersionWarning } from '@/components/prepare/production-version-warning';
import type { PrepareAreaData, PrepareRequirement } from '@/lib/data/prepare';
import { getExpectedUploadColumnGroups } from '@/lib/uploads/expected-columns';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function statusConfig(status: string) {
  if (status === 'published') {
    return {
      label: 'Publicado',
      shortLabel: 'Listo',
      helper: 'Este archivo ya está publicado para la versión seleccionada.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      dotClassName: 'bg-emerald-500',
      icon: CheckCircle2,
    };
  }

  if (status === 'reused') {
    return {
      label: 'Reutilizado',
      shortLabel: 'Reutilizado',
      helper: 'Se está usando el último archivo disponible, sin una nueva carga.',
      className: 'border-sky-200 bg-sky-50 text-sky-800',
      dotClassName: 'bg-sky-500',
      icon: CopyCheck,
    };
  }

  if (status === 'validated') {
    return {
      label: 'Validado',
      shortLabel: 'Validado',
      helper: 'El archivo fue cargado y pasó las validaciones principales.',
      className: 'border-blue-200 bg-blue-50 text-blue-800',
      dotClassName: 'bg-blue-500',
      icon: CheckCircle2,
    };
  }

  if (status === 'uploaded') {
    return {
      label: 'Cargado',
      shortLabel: 'Cargado',
      helper: 'El archivo fue cargado y está pendiente de revisión o validación.',
      className: 'border-indigo-200 bg-indigo-50 text-indigo-800',
      dotClassName: 'bg-indigo-500',
      icon: UploadCloud,
    };
  }

  if (status === 'error') {
    return {
      label: 'Con errores',
      shortLabel: 'Revisar',
      helper: 'Hay errores que deben corregirse antes de continuar.',
      className: 'border-rose-200 bg-rose-50 text-rose-800',
      dotClassName: 'bg-rose-500',
      icon: AlertCircle,
    };
  }

  if (status === 'requires_confirmation') {
    return {
      label: 'Requiere confirmación',
      shortLabel: 'Confirmar',
      helper: 'El sistema necesita que confirmes si quieres reutilizar o reemplazar el archivo.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
      dotClassName: 'bg-amber-500',
      icon: FileWarning,
    };
  }

  return {
    label: 'Pendiente',
    shortLabel: 'Pendiente',
    helper: 'Todavía falta subir o confirmar el archivo de este módulo.',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
    dotClassName: 'bg-slate-400',
    icon: Clock,
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No disponible';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-gradient-to-r from-slate-950 to-blue-600 transition-all"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const config = statusConfig(status);
  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold', config.className)}>
      <Icon className="h-4 w-4" />
      {config.label}
    </span>
  );
}

function DetailsDisclosure({
  title,
  description,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  function toggleOpen() {
    const nextOpen = !isOpen;
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
      >
        <span>
          <span className="block text-sm font-black text-slate-950">{title}</span>
          {description ? <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span> : null}
        </span>
        {isOpen ? <ChevronDown className="h-5 w-5 text-slate-500" /> : <ChevronRight className="h-5 w-5 text-slate-500" />}
      </button>

      {isOpen ? <div className="border-t border-slate-200 px-4 py-4">{children}</div> : null}
    </div>
  );
}

function ModuleListItem({
  requirement,
  isSelected,
  onSelect,
}: {
  requirement: PrepareRequirement;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const config = statusConfig(requirement.status);

  const parsedName = requirement.module.moduleName
    ?.split(' - ')
    .pop()
    ?.trim();



  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md',
        isSelected ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/15' : 'border-slate-200 bg-white text-slate-950 hover:border-slate-300',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full', config.dotClassName)} />
            <p className="truncate text-sm font-black">{parsedName}</p>
          </div>
          {requirement.variantLabel ? (
            <p className={cn('mt-1 truncate text-xs font-semibold', isSelected ? 'text-slate-300' : 'text-slate-500')}>
              {requirement.variantLabel}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]',
            isSelected ? 'bg-white/10 text-white' : config.className,
          )}
        >
          {config.shortLabel}
        </span>
      </div>
    </button>
  );
}

function ModuleDetail({ requirement, selectedVersion }: { requirement: PrepareRequirement; selectedVersion: PrepareAreaData['selectedVersion'] }) {
  const config = statusConfig(requirement.status);
  const Icon = config.icon;
  const current = requirement.currentUpload;
  const latest = requirement.latestUpload;
  const hasCurrentErrors = Boolean(current?.lastErrorMessage) || Number(current?.rowsError ?? 0) > 0;
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const expectedColumnGroups = getExpectedUploadColumnGroups(requirement.module.moduleCode);

  const parsedFileName = requirement.latestUpload?.sourceFileName
    ?.split('-')
    .pop()
    ?.trim();

  return (
    <article className="min-w-0 overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
      <div className="border-b border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Archivo seleccionado</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {requirement.module.moduleName}
            </h2>
            {requirement.variantLabel ? (
              <p className="mt-2 inline-flex rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">
                {requirement.variantLabel}
              </p>
            ) : null}
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              {config.helper} Sigue el bloque principal de acción y abre los detalles solo si necesitas revisar información adicional.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Responsable</p>
              <p className="mt-2 font-bold text-slate-950">{requirement.module.ownerName || 'Sin responsable asignado'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Email</p>
              {requirement.module.emailOwner ? (
                <a href={`mailto:${requirement.module.emailOwner}`} className="mt-2 block font-bold text-slate-950 underline-offset-4 hover:underline">
                  {requirement.module.emailOwner}
                </a>
              ) : (
                <p className="mt-2 font-bold text-slate-950">Sin email</p>
              )}
            </div>
          </div>


          <StatusPill status={requirement.status} />
        </div>
      </div>

      {hasCurrentErrors ? (
        <div className="border-b border-rose-200 bg-rose-50 px-5 py-4 text-rose-900 sm:px-6">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">Este archivo necesita corrección</p>
              <p className="mt-1 text-sm leading-6">
                {current?.lastErrorMessage ?? `Hay ${current?.rowsError} filas con error. Corrige el archivo y vuelve a cargarlo.`}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.45fr)_360px] sm:p-6">
        <div className="space-y-5">
          <div className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                <Icon className="h-5 w-5 text-slate-800" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-950">Qué tienes que hacer ahora</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Usa este bloque para subir, reemplazar o confirmar el archivo. La información técnica queda debajo para no distraer.
                </p>
              </div>
            </div>

            {selectedVersion ? (
              <PrepareUploadFlow
                key={requirement.key}
                requirement={requirement}
                selectedVersion={selectedVersion}
                onCompleted={() => setShowTechnicalDetails(true)}
              />
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                Selecciona una versión antes de preparar este archivo.
              </div>
            )}
          </div>



          <DetailsDisclosure
            title="Detalles técnicos de la carga"
            description="Nombre del archivo, filas procesadas, errores y fecha. Úsalo solo para revisar o dar soporte."
            open={showTechnicalDetails}
            onOpenChange={setShowTechnicalDetails}
          >
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Archivo</dt>
                <dd className="mt-2 break-words font-bold text-slate-950">{current?.sourceFileName ?? 'Pendiente'}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Subido por</dt>
                <dd className="mt-2 font-bold text-slate-950">{current?.uploadedBy ?? 'No disponible'}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Filas correctas</dt>
                <dd className="mt-2 font-bold text-slate-950">{current ? `${current.rowsValid}/${current.rowsTotal}` : 'No disponible'}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Errores</dt>
                <dd className={cn('mt-2 font-bold', Number(current?.rowsError ?? 0) > 0 ? 'text-rose-700' : 'text-slate-950')}>
                  {current?.rowsError ?? 0}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
                <dt className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Fecha</dt>
                <dd className="mt-2 font-bold text-slate-950">{formatDate(current?.uploadedAt)}</dd>
              </div>
            </dl>
          </DetailsDisclosure>
        </div>

        <aside className="space-y-4">

          {latest ? (
            <div className="rounded-[26px] border border-slate-200 bg-white p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Última carga disponible</p>
              <p className="mt-3 break-words font-sm font-semibold text-slate-950">{parsedFileName}</p>
              <p className="mt-1 text-sm text-slate-500">{latest.periodMonth} · {formatDate(latest.uploadedAt)}</p>
              <a
                href={`/api/prepare/download?uploadId=${encodeURIComponent(latest.uploadId)}`}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar referencia
              </a>
            </div>
          ) : null}


          {expectedColumnGroups.length > 0 ? (
            <div className="rounded-[26px] border border-amber-200 bg-amber-50 p-5 text-amber-950">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white/80 p-3 text-amber-700 shadow-sm ring-1 ring-amber-200">
                  <FileWarning className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black">Atencion, el sistema espera las siguientes columnas en el archivo:</h3>
                  <div className="mt-4 space-y-3">
                    {expectedColumnGroups.map((group) => (
                      <div key={group.label}>
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-800">{group.label}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {group.columns.map((column) => (
                            <span
                              key={column}
                              className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-bold text-amber-950"
                            >
                              {column}
                            </span>
                          ))}
                        </div>
                        {group.helper ? <p className="mt-2 text-xs leading-5 text-amber-800">{group.helper}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}



        </aside>
      </div>
    </article>
  );
}

export function PrepareAreaView({ data }: { data: PrepareAreaData }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(data.requirements[0]?.key ?? null);
  const [query, setQuery] = useState('');

  const filteredRequirements = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return data.requirements;

    return data.requirements.filter((requirement) => {
      return [
        requirement.module.moduleName,
        requirement.variantLabel,
        requirement.module.ownerName,
        requirement.module.emailOwner,
        requirement.module.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [data.requirements, query]);

  const selectedRequirement = useMemo(() => {
    return data.requirements.find((requirement) => requirement.key === selectedKey) ?? filteredRequirements[0] ?? data.requirements[0] ?? null;
  }, [data.requirements, filteredRequirements, selectedKey]);

  const nextPending = useMemo(() => {
    return data.requirements.find((requirement) => ['pending', 'error', 'requires_confirmation'].includes(requirement.status));
  }, [data.requirements]);

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/prepare" className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300 hover:text-white">
                Preparación / Volver
              </Link>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{data.areaLabel}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Selecciona un archivo en el panel lateral y completa una acción a la vez. La información secundaria queda escondida para evitar confusión.
              </p>
            </div>
            <PrepareVersionSelector versions={data.versions} selectedVersion={data.selectedVersion} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">

          {/* Columna izquierda */}
          <div className="rounded-[26px]  bg-slate-50/70 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-950">Guía rápida</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Primero elige un archivo en la lista izquierda. Después completa únicamente la acción principal. Si algo falla, el sistema mostrará el error en este mismo panel.
                </p>
              </div>
            </div>
          </div>


          <div className="border-b border-slate-200 bg-slate-50/70 p-4 lg:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_280px] lg:items-center">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-black text-slate-950">Progreso general</p>
                  <p className="text-sm font-black text-slate-950">{data.summary.progressPct}%</p>
                </div>
                <ProgressBar value={data.summary.progressPct} />
                <p className="text-sm leading-6 text-slate-600">
                  {data.summary.uploadedModules} completos · {data.summary.pendingModules} pendientes · {data.summary.errorModules} con errores
                </p>
              </div>



              {nextPending ? (
                <button
                  type="button"
                  onClick={() => setSelectedKey(nextPending.key)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Continuar pendiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                  Todo está completo para esta área.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ProductionVersionWarning version={data.selectedVersion} />

      {!data.defaultDraftVersion ? (
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <p className="text-lg font-black">No hay ninguna versión borrador disponible.</p>
          <p className="mt-2 text-sm leading-6">
            Crea una versión draft desde{' '}
            <Link href="/admin/versions" className="font-bold underline">
              Admin / Versions
            </Link>{' '}
            antes de preparar archivos.
          </p>
        </div>
      ) : null}

      {data.selectedVersion ? (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
              <div className="border-b border-slate-200 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-slate-950 p-3 text-white">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-black text-slate-950">Archivos del área</h2>
                    <p className="mt-1 text-sm leading-5 text-slate-500">Elige un archivo y trabaja solo en ese punto.</p>
                  </div>
                </div>

                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar archivo..."
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  />
                </div>
              </div>

              <div className="max-h-[calc(100vh-320px)] space-y-3 overflow-y-auto p-3">
                {filteredRequirements.map((requirement) => (
                  <ModuleListItem
                    key={requirement.key}
                    requirement={requirement}
                    isSelected={selectedRequirement?.key === requirement.key}
                    onSelect={() => setSelectedKey(requirement.key)}
                  />
                ))}

                {filteredRequirements.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                    <Info className="mx-auto h-6 w-6 text-slate-400" />
                    <p className="mt-2 font-bold text-slate-950">No encontramos archivos</p>
                    <p className="mt-1 text-sm text-slate-500">Prueba con otro término de búsqueda.</p>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            {selectedRequirement ? (
              <ModuleDetail requirement={selectedRequirement} selectedVersion={data.selectedVersion} />
            ) : (
              <div className="rounded-[30px] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                <Layers3 className="mx-auto h-10 w-10 text-slate-400" />
                <p className="mt-4 text-lg font-black text-slate-950">No hay módulos activos configurados para esta área.</p>
                <p className="mt-2 text-sm text-slate-500">Cuando existan módulos activos, aparecerán en el panel lateral.</p>
              </div>
            )}
          </main>
        </div>
      ) : null}
    </section>
  );
}
