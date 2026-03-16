import { InfoChip } from '@/components/ui/info-chip';
import { SectionHeader } from '@/components/ui/section-header';
import { MedicalForm } from '@/components/forms/medical-form';
import { getLatestReportingVersion } from '@/lib/data/versions/get-latest-version';
import { getAdminTargets } from '@/lib/data/targets';
import { getMedicalMonthlyInputs } from '@/lib/data/medical-forms';
import type { MedicalTargetRow } from '@/lib/data/medical-forms-schema';

export const dynamic = 'force-dynamic';

function formatMonth(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

type PageProps = {
  searchParams: Promise<{ period?: string }>;
};

export default async function MedicalFormPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const latestVersion = await getLatestReportingVersion();
  const periodMonth = (params.period ?? '').trim() || latestVersion.period_month;
  const rows = await getMedicalMonthlyInputs(periodMonth);
  const sourceAsOfMonth = rows[0]?.sourceAsOfMonth || periodMonth;
  const targetsRaw = await getAdminTargets('medical', latestVersion.reporting_version_id, periodMonth);

  const targets: MedicalTargetRow[] = targetsRaw
    .filter((item) => item.isActive)
    .map((item) => ({
      targetId: item.targetId,
      kpiName: item.kpiName,
      kpiLabel: item.kpiLabel?.trim() || item.kpiName,
      qtyUnit: item.qtyUnit,
      objectiveValueText: item.targetValueText,
      objectiveValueNumeric: item.targetValueNumeric,
    }))
    .sort((a, b) => a.kpiLabel.localeCompare(b.kpiLabel));

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 overflow-hidden lg:gap-2 xl:gap-3 2xl:gap-4">
      <SectionHeader
        eyebrow="Forms"
        title="Medical"
        description="Monthly KPI capture based on centrally managed targets."
        actions={
          <>
            <InfoChip label="Period" value={formatMonth(periodMonth)} />
            <InfoChip label="KPIs" value={String(targets.length)} />
          </>
        }
      />
      <div className="overflow-auto pr-1">
        <article className="mb-4 rounded-[18px] border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-amber-800">Targets Governance</p>
          <p className="mt-1 text-sm text-slate-700">
            Objectives are managed centrally and cannot be edited in forms. To request changes, contact{' '}
            <span className="font-semibold">j.arevalo@chiesi.com</span>.
          </p>
        </article>
        <MedicalForm
          defaultPeriodMonth={periodMonth}
          defaultSourceAsOfMonth={sourceAsOfMonth}
          reportingVersionId={latestVersion.reporting_version_id}
          targets={targets}
          rows={rows}
        />
      </div>
    </section>
  );
}
