import { InfoChip } from '@/components/ui/info-chip';
import { SectionHeader } from '@/components/ui/section-header';
import { LegalComplianceForm } from '@/components/forms/legal-compliance-form';
import { getLatestReportingVersion } from '@/lib/data/versions/get-latest-version';
import { getLegalComplianceMonthlyInputs } from '@/lib/data/legal-compliance-forms';
import { getAdminTargets } from '@/lib/data/targets';
import type { LegalComplianceAnswerField, LegalComplianceKpiName } from '@/lib/data/legal-compliance-forms-schema';
import {
  LEGAL_COMPLIANCE_KPI_FIELDS,
  LEGAL_COMPLIANCE_KPIS,
  parseLegalComplianceFields,
} from '@/lib/data/legal-compliance-forms-schema';

export const dynamic = 'force-dynamic';

function formatMonth(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

type PageProps = { searchParams: Promise<{ period?: string }> };

export default async function LegalComplianceFormPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const latestVersion = await getLatestReportingVersion();
  const periodMonth = (params.period ?? '').trim() || latestVersion.period_month;
  const rows = await getLegalComplianceMonthlyInputs(periodMonth);
  const sourceAsOfMonth = rows[0]?.sourceAsOfMonth || periodMonth;
  const targets = await getAdminTargets('legal_compliance', latestVersion.reporting_version_id, periodMonth);
  const objectiveByKpi = Object.fromEntries(
    targets.map((target) => [target.kpiName, target.targetValueNumeric ?? null]),
  ) as Record<string, number | null>;
  const answerFieldsByKpi = new Map<LegalComplianceKpiName, ReadonlyArray<LegalComplianceAnswerField>>();
  const kpiNameLookup = new Map(LEGAL_COMPLIANCE_KPIS.map((name) => [normalizeText(name), name]));

  for (const target of targets) {
    const resolvedKpi = kpiNameLookup.get(normalizeText(target.kpiName));
    if (!resolvedKpi) continue;
    const parsed = parseLegalComplianceFields(target.formFields);
    if (parsed.length > 0) {
      answerFieldsByKpi.set(resolvedKpi, parsed);
    }
  }

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 overflow-hidden lg:gap-2 xl:gap-3 2xl:gap-4">
      <SectionHeader
        eyebrow="Forms"
        title="Legal & Compliance"
        description="Monthly KPI capture aligned to objective/result/coverage format."
        actions={
          <>
            <InfoChip label="Period" value={formatMonth(periodMonth)} />
            <InfoChip label="Loaded rows" value={String(rows.length)} />
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
        <LegalComplianceForm
          defaultPeriodMonth={periodMonth}
          defaultSourceAsOfMonth={sourceAsOfMonth}
          reportingVersionId={latestVersion.reporting_version_id}
          objectiveByKpi={objectiveByKpi}
          answerFieldsByKpi={Object.fromEntries(
            LEGAL_COMPLIANCE_KPIS.map((kpi) => [kpi, answerFieldsByKpi.get(kpi) ?? LEGAL_COMPLIANCE_KPI_FIELDS[kpi]]),
          )}
          rows={rows}
        />
      </div>
    </section>
  );
}
