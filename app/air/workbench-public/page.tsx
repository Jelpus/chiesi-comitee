import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { AirPublicScenarioWorkbench } from '@/components/air/air-public-scenario-workbench';
import { AirRevolutionHeader } from '@/components/air/air-revolution-header';
import { getAirPublicPageData } from '@/lib/air/get-air-public-data';
import { getLatestAirReportingVersion } from '@/lib/air/get-air-data';

export const dynamic = 'force-dynamic';

export default async function AirPublicWorkbenchPage({
  searchParams,
}: {
  searchParams?: Promise<{ marketGroup?: string }>;
}) {
  const params = await searchParams;
  const reportingVersion = await getLatestAirReportingVersion();
  const publicData = await getAirPublicPageData({
    periodMonth: reportingVersion?.periodMonth,
    marketGroup: params?.marketGroup,
    includeAllRows: true,
  });

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <AirRevolutionHeader reportingVersion={reportingVersion} />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Public Channel Workbench</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              CLUE-level public demand analysis using GOB360 PC sales, product mapping and route visit coverage.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <form action="/air/workbench-public" className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Market group
                </span>
                <select
                  name="marketGroup"
                  defaultValue={publicData.selectedMarketGroup}
                  className="min-w-[240px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500"
                >
                  <option value="all">All market groups</option>
                  {publicData.marketGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="inline-flex rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Apply
              </button>
            </form>

            <Link
              href="/air/workbench-private"
              className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Open Private Workbench
            </Link>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <p className="font-semibold">Public methodology</p>
          <p className="mt-1 leading-6">
            Public does not use physician-level CloseUp matching. The unit of analysis is the CLUE: demand comes from
            GOB360 pieces by product key, and visit coverage comes from the PC structure table where REFERENCIA is
            VISITADO.
          </p>
        </div>

        {!reportingVersion ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0" />
              <p>No valid reporting period is available for public workbench analysis.</p>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <AirPublicScenarioWorkbench data={publicData} />
          </div>
        )}
      </section>
    </div>
  );
}
