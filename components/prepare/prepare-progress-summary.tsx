import Link from 'next/link';
import type { PrepareAreaSummary } from '@/lib/data/prepare';

type PrepareProgressSummaryProps = {
  areas: PrepareAreaSummary[];
};

export function PrepareProgressSummary({ areas }: PrepareProgressSummaryProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {areas.map((area) => (
        <Link
          key={area.areaCode}
          href={`/prepare/${area.areaCode}`}
          className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_55px_rgba(15,23,42,0.1)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Área</p>
              <h2 className="mt-2 text-xl font-black text-slate-950">{area.areaLabel}</h2>
            </div>
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">{area.progressPct}%</span>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${area.progressPct}%` }} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
            <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-800">
              <span className="font-bold">{area.uploadedModules}</span> completos
            </p>
            <p className="rounded-2xl bg-amber-50 px-3 py-2 text-amber-800">
              <span className="font-bold">{area.pendingModules}</span> pendientes
            </p>
            <p className="rounded-2xl bg-rose-50 px-3 py-2 text-rose-800">
              <span className="font-bold">{area.errorModules}</span> con error
            </p>
            <p className="rounded-2xl bg-slate-100 px-3 py-2 text-slate-700">
              <span className="font-bold">{area.reusedModules}</span> reutilizados
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
