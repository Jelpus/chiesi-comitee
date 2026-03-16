import { InfoChip } from '@/components/ui/info-chip';
import { RegulatoryAffairsForm } from '@/components/forms/regulatory-affairs-form';
import { SectionHeader } from '@/components/ui/section-header';
import { getLatestReportingVersion } from '@/lib/data/versions/get-latest-version';
import { getRaMonthlyInputs } from '@/lib/data/ra-forms';
import { getAdminTargets } from '@/lib/data/targets';

export const dynamic = 'force-dynamic';

function formatMonth(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

type RegulatoryAffairsFormPageProps = {
  searchParams: Promise<{
    period?: string;
  }>;
};

export default async function RegulatoryAffairsFormPage({ searchParams }: RegulatoryAffairsFormPageProps) {
  const params = await searchParams;
  const latestVersion = await getLatestReportingVersion();
  const periodMonth = (params.period ?? '').trim() || latestVersion.period_month;
  const rows = await getRaMonthlyInputs(periodMonth);
  const sourceAsOfMonth = rows[0]?.sourceAsOfMonth || periodMonth;
  const targets = await getAdminTargets('ra_quality_fv', latestVersion.reporting_version_id, periodMonth);
  const targetByTopic = new Map<string, string>();
  for (const target of targets) {
    const key = (target.kpiName ?? '').toLowerCase();
    if (key.includes('liberaciones')) targetByTopic.set('Liberaciones', target.kpiLabel || target.kpiName);
    if (key.includes('registros')) targetByTopic.set('Registros Sanitarios', target.kpiLabel || target.kpiName);
    if (key.includes('modificaciones')) targetByTopic.set('Modificaciones Regulatorias', target.kpiLabel || target.kpiName);
    if (key.includes('importacion')) targetByTopic.set('Permisos de Importacion', target.kpiLabel || target.kpiName);
    if (key.includes('procedimientos')) targetByTopic.set('Procedimientos', target.kpiLabel || target.kpiName);
    if (key.includes('auditorias')) targetByTopic.set('Auditorias Externas', target.kpiLabel || target.kpiName);
  }

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 overflow-hidden lg:gap-2 xl:gap-3 2xl:gap-4">
      <SectionHeader
        eyebrow="Forms"
        title="RA - Quality - FV"
        description="Monthly target-vs-result input sheet for executive narrative and scorecard."
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
        <RegulatoryAffairsForm
          defaultPeriodMonth={periodMonth}
          defaultSourceAsOfMonth={sourceAsOfMonth}
          reportingVersionId={latestVersion.reporting_version_id}
          objectivesByTopic={Object.fromEntries(targetByTopic)}
          rows={rows}
        />
      </div>
    </section>
  );
}
