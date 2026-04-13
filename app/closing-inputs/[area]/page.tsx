import { notFound } from 'next/navigation';
import { InfoChip } from '@/components/ui/info-chip';
import { SectionHeader } from '@/components/ui/section-header';
import { ClosingInputsForm } from '@/components/forms/closing-inputs-form';
import { getLatestReportingVersion } from '@/lib/data/versions/get-latest-version';
import { getClosingInput } from '@/lib/data/closing-inputs';
import { getClosingInputAreaMeta } from '@/lib/data/closing-inputs-schema';

export const dynamic = 'force-dynamic';

function formatMonth(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

type PageProps = {
  params: Promise<{ area: string }>;
  searchParams: Promise<{ period?: string }>;
};

export default async function ClosingInputsAreaPage({ params, searchParams }: PageProps) {
  const [routeParams, queryParams] = await Promise.all([params, searchParams]);
  const areaSlug = String(routeParams.area ?? '').trim();
  const areaMeta = getClosingInputAreaMeta(areaSlug);
  if (!areaMeta) notFound();

  const latestVersion = await getLatestReportingVersion();
  const periodMonth = (queryParams.period ?? '').trim() || latestVersion.period_month;
  const row = await getClosingInput({
    areaSlug,
    reportingVersionId: latestVersion.reporting_version_id,
    periodMonth,
  });
  const sourceAsOfMonth = row?.sourceAsOfMonth || periodMonth;

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 overflow-hidden lg:gap-2 xl:gap-3 2xl:gap-4">
      <SectionHeader
        eyebrow="Closing Inputs"
        title={areaMeta.label}
        description="Mini close form for key committee messages."
        actions={
          <>
            <InfoChip label="Period" value={formatMonth(periodMonth)} />
            <InfoChip label="Version" value={latestVersion.version_name} />
          </>
        }
      />
      <div className="overflow-auto pr-1">
        <ClosingInputsForm
          areaSlug={areaSlug}
          areaLabel={areaMeta.label}
          reportingVersionId={latestVersion.reporting_version_id}
          defaultPeriodMonth={periodMonth}
          defaultSourceAsOfMonth={sourceAsOfMonth}
          row={row}
        />
      </div>
    </section>
  );
}

