import Link from 'next/link';
import { PrepareProgressSummary } from '@/components/prepare/prepare-progress-summary';
import { PrepareVersionSelector } from '@/components/prepare/prepare-version-selector';
import { ProductionVersionWarning } from '@/components/prepare/production-version-warning';
import type { PrepareHomeData } from '@/lib/data/prepare';

export function PrepareHome({ data }: { data: PrepareHomeData }) {
  const totalModules = data.areas.reduce((sum, area) => sum + area.totalModules, 0);
  const uploadedModules = data.areas.reduce((sum, area) => sum + area.uploadedModules, 0);
  const pendingModules = data.areas.reduce((sum, area) => sum + area.pendingModules, 0);
  const errorModules = data.areas.reduce((sum, area) => sum + area.errorModules, 0);
  const progressPct = totalModules > 0 ? Math.round((uploadedModules / totalModules) * 100) : 0;

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Preparación de cierre</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Carga de archivos por responsables</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Revisa el avance por área, entra a tu área y deja publicados los archivos requeridos para la versión de trabajo.
              </p>
            </div>
            <PrepareVersionSelector versions={data.versions} selectedVersion={data.selectedVersion} />
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:p-6">
          {[
            { label: 'Avance', value: `${progressPct}%` },
            { label: 'Módulos completos', value: uploadedModules },
            { label: 'Pendientes', value: pendingModules },
            { label: 'Con errores', value: errorModules },
          ].map((item) => (
            <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <ProductionVersionWarning version={data.selectedVersion} />

      {!data.defaultDraftVersion ? (
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <p className="text-lg font-black">No hay ninguna versión borrador disponible.</p>
          <p className="mt-2 text-sm leading-6">
            Crea una versión draft desde <Link href="/admin/versions" className="font-bold underline">Admin / Versions</Link> para preparar nuevos archivos sin tocar información publicada.
          </p>
        </div>
      ) : null}

      {data.selectedVersion ? <PrepareProgressSummary areas={data.areas} /> : null}
    </section>
  );
}
