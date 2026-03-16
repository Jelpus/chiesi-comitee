import { ExecutiveKpiCard } from '@/components/executive/executive-kpi-card';
import { InfoChip } from '@/components/ui/info-chip';
import { SectionHeader } from '@/components/ui/section-header';
import { SelectFilter } from '@/components/ui/select-filter';
import { getExecutivePageData } from '@/lib/data/excecutive/get-executive-page-data';

type ExecutivePageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

function buildVersionLabel(periodMonth: string, versionName: string) {
  return `${periodMonth} - ${versionName}`;
}

export default async function ExecutivePage({
  searchParams,
}: ExecutivePageProps) {
  const params = await searchParams;

  const data = await getExecutivePageData({
    reportingVersionId: params.version,
  });

  return (
    <section className="space-y-4 lg:grid lg:h-full lg:min-h-0 lg:grid-rows-[auto_1fr] lg:gap-2 lg:overflow-hidden xl:gap-3 2xl:gap-4">
      <SectionHeader
        eyebrow="Executive"
        title="Executive Home"
        description="Monthly close summary with key KPIs, major variances, and module status for the Commercial Committee."
        actions={
          <>
            <InfoChip label="Period" value={data.context.periodLabel} />
            <InfoChip label="Version" value={data.context.versionLabel} />
            <SelectFilter
              paramName="version"
              label="Change version"
              value={data.selectedReportingVersionId}
              options={data.availableVersions.map((item) => ({
                value: item.reportingVersionId,
                label: buildVersionLabel(item.periodMonth, item.versionName),
              }))}
            />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:min-h-0 lg:auto-rows-fr lg:grid-cols-4 lg:grid-rows-2 lg:gap-2 xl:gap-3 2xl:gap-4">
        {data.cards.map((item) => (
          <ExecutiveKpiCard key={`${item.module}-${item.kpi}`} item={item} />
        ))}
      </div>
    </section>
  );
}
