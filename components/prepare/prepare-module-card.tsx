import { AlertCircle, CheckCircle2, Clock, CopyCheck, Download, FileWarning, UploadCloud } from 'lucide-react';
import { PrepareUploadFlow } from '@/components/prepare/prepare-upload-flow';
import type { PrepareReportingVersion, PrepareRequirement } from '@/lib/data/prepare';

type PrepareModuleCardProps = {
  requirement: PrepareRequirement;
  selectedVersion: PrepareReportingVersion | null;
};

function statusConfig(status: string) {
  if (status === 'published') return { label: 'Publicado', className: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: CheckCircle2 };
  if (status === 'reused') return { label: 'Reutilizado', className: 'border-sky-200 bg-sky-50 text-sky-800', icon: CopyCheck };
  if (status === 'validated') return { label: 'Validado', className: 'border-blue-200 bg-blue-50 text-blue-800', icon: CheckCircle2 };
  if (status === 'uploaded') return { label: 'Cargado', className: 'border-indigo-200 bg-indigo-50 text-indigo-800', icon: UploadCloud };
  if (status === 'error') return { label: 'Con errores', className: 'border-rose-200 bg-rose-50 text-rose-800', icon: AlertCircle };
  if (status === 'requires_confirmation') return { label: 'Requiere confirmación', className: 'border-amber-200 bg-amber-50 text-amber-800', icon: FileWarning };
  return { label: 'Pendiente', className: 'border-slate-200 bg-slate-100 text-slate-700', icon: Clock };
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function PrepareModuleCard({ requirement, selectedVersion }: PrepareModuleCardProps) {
  const config = statusConfig(requirement.status);
  const Icon = config.icon;
  const current = requirement.currentUpload;
  const latest = requirement.latestUpload;

  return (
    <article className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
      <div className="border-b border-slate-200 bg-slate-50/80 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-slate-950">{requirement.module.moduleName}</h2>
              {requirement.variantLabel ? (
                <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">
                  {requirement.variantLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 font-mono text-xs text-slate-500">{requirement.module.moduleCode}</p>
            {requirement.module.notes ? <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{requirement.module.notes}</p> : null}
          </div>

          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] ${config.className}`}>
            <Icon className="h-4 w-4" />
            {config.label}
          </span>
        </div>
      </div>

      <div className="grid gap-4 p-5 xl:grid-cols-[0.9fr_1.4fr]">
        <div className="space-y-4">
          <div className="grid gap-2 text-sm">
            <p className="rounded-2xl bg-slate-50 px-3 py-2">
              <span className="font-bold text-slate-500">Responsable:</span>{' '}
              <span className="text-slate-900">{requirement.module.ownerName || 'Sin asignar'}</span>
            </p>
            <p className="rounded-2xl bg-slate-50 px-3 py-2">
              <span className="font-bold text-slate-500">Email:</span>{' '}
              <span className="text-slate-900">{requirement.module.emailOwner || 'Sin email'}</span>
            </p>
          </div>

          <div className="rounded-[22px] border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Estado para esta versión</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Archivo</dt>
                <dd className="font-semibold text-slate-950">{current?.sourceFileName ?? 'Pendiente'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Subido por</dt>
                <dd className="font-semibold text-slate-950">{current?.uploadedBy ?? 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Filas</dt>
                <dd className="font-semibold text-slate-950">{current ? `${current.rowsValid}/${current.rowsTotal}` : 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Errores</dt>
                <dd className="font-semibold text-slate-950">{current?.rowsError ?? 0}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Fecha</dt>
                <dd className="font-semibold text-slate-950">{formatDate(current?.uploadedAt)}</dd>
              </div>
            </dl>
            {current?.lastErrorMessage ? (
              <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                {current.lastErrorMessage}
              </p>
            ) : null}
          </div>

          {latest ? (
            <div className="rounded-[22px] border border-slate-200 p-4 text-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Última carga publicada</p>
              <p className="mt-2 font-semibold text-slate-950">{latest.sourceFileName}</p>
              <p className="mt-1 text-slate-500">{latest.periodMonth} · {formatDate(latest.uploadedAt)}</p>
              <a
                href={`/api/prepare/download?uploadId=${encodeURIComponent(latest.uploadId)}`}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar archivo actual
              </a>
            </div>
          ) : null}
        </div>

        {selectedVersion ? <PrepareUploadFlow requirement={requirement} selectedVersion={selectedVersion} /> : null}
      </div>
    </article>
  );
}
