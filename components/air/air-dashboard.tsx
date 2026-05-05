import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { AirRevolutionHeader } from '@/components/air/air-revolution-header';
import { AirStrategicWorkspace } from '@/components/air/air-strategic-workspace';
import type { AirPageData } from '@/lib/air/types';

type Props = {
  data: AirPageData;
};

export function AirDashboard({ data }: Props) {
  const hasReportingVersion = Boolean(data.reportingVersion);
  const hasMedicalRows = data.callPlan.global.totalRows > 0;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <AirRevolutionHeader reportingVersion={data.reportingVersion} />

      <section className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl">
            Scenario planning, visit recommendations and capacity impact now live in the AIR strategic workbench.
          </p>

          <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center sm:justify-end">
            <Link
              href="/air/workbench-private"
              className="inline-flex items-center justify-center rounded-full bg-sky-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-800 hover:shadow-md"
            >
              Open Private Workbench
            </Link>

            <Link
              href="/air/workbench-public"
              className="inline-flex items-center justify-center rounded-full border border-sky-300 bg-white px-4 py-2 text-xs font-semibold text-sky-800 shadow-sm transition hover:border-sky-400 hover:bg-sky-100 hover:shadow-md"
            >
              Open Public Workbench
            </Link>
          </div>
        </div>
      </section>

      {data.warnings.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0" />
            <div>
              <p className="font-semibold">Data notes</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {data.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {!hasReportingVersion || !hasMedicalRows ? (
        <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">AirRevolution is waiting for source data</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            The page will render the Call Plan, CloseUp matching and segmentation once a valid reporting version and AIR
            medical file rows are available.
          </p>
        </section>
      ) : (
        <AirStrategicWorkspace data={data} />
      )}
    </div>
  );
}
