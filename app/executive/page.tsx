import { ExecutiveKpiCard } from '@/components/executive/executive-kpi-card';
import { ShowDevelopmentVersionsToggle } from '@/components/executive/show-development-versions-toggle';
import { InfoChip } from '@/components/ui/info-chip';
import { SectionHeader } from '@/components/ui/section-header';
import { SelectFilter } from '@/components/ui/select-filter';
import { getExecutivePageData } from '@/lib/data/excecutive/get-executive-page-data';

type ExecutivePageProps = {
  searchParams: Promise<{
    version?: string;
    showDrafts?: string;
  }>;
};

function buildVersionLabel(periodMonth: string, versionName: string) {
  return `${periodMonth} - ${versionName}`;
}

export default async function ExecutivePage({ searchParams }: ExecutivePageProps) {
  const params = await searchParams;
  const showDrafts = params.showDrafts === '1';

  const data = await getExecutivePageData({
    reportingVersionId: params.version,
    showDrafts,
  });
  const selectedIsDraft = data.selectedVersionStatus === 'draft';

  return (
    <section className="space-y-4 lg:grid lg:gap-2 xl:gap-3 2xl:gap-4">
      <SectionHeader
        eyebrow="Executive"
        title="Executive Home"
        description="Monthly close summary with key KPIs, major variances, and module status for the Operational Committee."
        actions={
          <>
            <InfoChip label="Period" value={data.context.periodLabel} />
            <InfoChip label="Version" value={data.context.versionLabel} />

            {data.availableVersions.length > 0 ? (
              <SelectFilter
                paramName="version"
                label="Change version"
                value={data.selectedReportingVersionId}
                options={data.availableVersions.map((item) => ({
                  value: item.reportingVersionId,
                  label: buildVersionLabel(item.periodMonth, item.versionName),
                }))}
              />
            ) : null}
          </>
        }
        extras={
          <ShowDevelopmentVersionsToggle enabled={showDrafts} />
        }
      />

      {selectedIsDraft ? (
        <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          In development - not visible by default in Executive
        </div>
      ) : null}

      {data.availableVersions.length === 0 ? (
        <div className="rounded-[18px] border border-slate-200 bg-white p-8">
          <p className="text-sm font-semibold text-slate-950">No published Executive version is available.</p>
          <p className="mt-2 text-sm text-slate-600">
            Executive only loads versions marked ready_to_show or closed by default.
            {data.hasHiddenDrafts ? ' Enable development versions to review drafts.' : ''}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-2 xl:gap-3 2xl:gap-4">
        {data.cards.map((item) => (
          <ExecutiveKpiCard key={`${item.module}-${item.kpi}`} item={item} />
        ))}
      </div>
    </section>
  );
}
