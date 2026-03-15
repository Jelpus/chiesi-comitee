import { SectionHeader } from '@/components/ui/section-header';
import { SelectFilter } from '@/components/ui/select-filter';
import { TargetsManager } from '@/components/admin/targets-manager';
import { getAdminTargetAreas, getAdminTargets } from '@/lib/data/targets';
import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';

export const dynamic = 'force-dynamic';

type TargetsPageProps = {
  searchParams?: Promise<{
    area?: string;
    version?: string;
  }>;
};

export default async function TargetsPage({ searchParams }: TargetsPageProps) {
  const params = (await searchParams) ?? {};
  const selectedArea = String(params.area ?? '').trim().toLowerCase();
  const versions = await getReportingVersions();
  const selectedVersion =
    versions.find((item) => item.reportingVersionId === params.version) ?? versions[0];
  const selectedReportingVersionId = selectedVersion?.reportingVersionId ?? '';
  const selectedPeriodMonth = selectedVersion?.periodMonth ?? '';

  const [rows, areas] = await Promise.all([
    getAdminTargets(selectedArea || undefined, selectedReportingVersionId || undefined, selectedPeriodMonth || undefined),
    getAdminTargetAreas(selectedReportingVersionId || undefined, selectedPeriodMonth || undefined),
  ]);

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Admin"
        title="Targets"
        description="Centralized KPI targets by area for executive scorecards and dashboards."
        actions={
          <SelectFilter
            paramName="version"
            label="Version"
            value={selectedReportingVersionId}
            options={versions.map((item) => ({
              value: item.reportingVersionId,
              label: `${item.periodMonth} - ${item.versionName}`,
            }))}
          />
        }
      />

      <TargetsManager
        rows={rows}
        areaOptions={areas}
        selectedArea={selectedArea}
        selectedReportingVersionId={selectedReportingVersionId}
        selectedPeriodMonth={selectedPeriodMonth}
      />
    </section>
  );
}
