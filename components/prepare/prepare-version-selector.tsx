'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { PrepareReportingVersion } from '@/lib/data/prepare';

type PrepareVersionSelectorProps = {
  versions: PrepareReportingVersion[];
  selectedVersion: PrepareReportingVersion | null;
};

function statusLabel(status: string) {
  if (status === 'draft') return 'Borrador';
  if (status === 'ready_to_show') return 'En productivo';
  if (status === 'closed') return 'Cerrada';
  return status;
}

export function PrepareVersionSelector({ versions, selectedVersion }: PrepareVersionSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('version', value);
    else params.delete('version');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="flex min-w-[280px] flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Versión de trabajo</span>
      <select
        value={selectedVersion?.reportingVersionId ?? ''}
        onChange={(event) => handleChange(event.target.value)}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
      >
        <option value="" disabled>
          Selecciona una versión
        </option>
        {versions.map((version) => (
          <option key={version.reportingVersionId} value={version.reportingVersionId}>
            {version.periodMonth} - {version.versionName} - {statusLabel(version.status)}
          </option>
        ))}
      </select>
    </label>
  );
}
