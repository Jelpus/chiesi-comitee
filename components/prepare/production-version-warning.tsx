import type { PrepareReportingVersion } from '@/lib/data/prepare';

export function ProductionVersionWarning({ version }: { version: PrepareReportingVersion | null }) {
  if (!version || version.status === 'draft') return null;

  return (
    <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
      <p className="font-bold">Esta versión ya está en productivo.</p>
      <p className="mt-1">
        Si actualizas archivos aquí, podrías modificar información ya visible en Executive. Para continuar, cada carga
        pedirá una confirmación explícita.
      </p>
    </div>
  );
}
