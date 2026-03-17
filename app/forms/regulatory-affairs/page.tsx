import { InfoChip } from '@/components/ui/info-chip';
import { RegulatoryAffairsForm } from '@/components/forms/regulatory-affairs-form';
import { SectionHeader } from '@/components/ui/section-header';
import { getLatestReportingVersion } from '@/lib/data/versions/get-latest-version';
import { getRaMonthlyInputs } from '@/lib/data/ra-forms';
import { getAdminTargets } from '@/lib/data/targets';
import type { RaCountMetric, RaTopicName } from '@/lib/data/ra-forms-schema';
import { parseRaCountFields, RA_TOPICS, RA_TOPIC_COUNT_FIELDS } from '@/lib/data/ra-forms-schema';

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

function resolveTopicFromText(value: string | null | undefined) {
  const key = normalizeText(value);
  if (!key) return null;
  if (key.includes('liberaciones')) return 'Liberaciones';
  if (key.includes('registros')) return 'Registros Sanitarios';
  if (key.includes('modificaciones')) return 'Modificaciones Regulatorias';
  if (key.includes('importacion')) return 'Permisos de Importacion';
  if (key.includes('procedimientos')) return 'Procedimientos';
  if (key.includes('auditorias')) return 'Auditorias Externas';
  return null;
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
  const countFieldsByTopic = new Map<RaTopicName, ReadonlyArray<RaCountMetric>>();
  const topicByExistingTargetLabel = new Map<string, string>();
  for (const row of rows) {
    const labelKey = normalizeText(row.targetLabel);
    if (!labelKey) continue;
    if (!RA_TOPICS.includes(row.topic as (typeof RA_TOPICS)[number])) continue;
    topicByExistingTargetLabel.set(labelKey, row.topic);
  }

  for (const target of targets) {
    const label = target.kpiLabel || target.kpiName;
    const topicFromExistingLabel = topicByExistingTargetLabel.get(normalizeText(label));
    const resolvedTopic = topicFromExistingLabel ?? resolveTopicFromText(target.kpiName) ?? resolveTopicFromText(target.kpiLabel);
    if (resolvedTopic) {
      targetByTopic.set(resolvedTopic, label);
      const parsedFields = parseRaCountFields(target.formFields);
      if (parsedFields.length > 0) {
        countFieldsByTopic.set(resolvedTopic as RaTopicName, parsedFields);
      }
    }
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
          countFieldsByTopic={Object.fromEntries(
            RA_TOPICS.map((topic) => [topic, countFieldsByTopic.get(topic) ?? RA_TOPIC_COUNT_FIELDS[topic]]),
          )}
          rows={rows}
        />
      </div>
    </section>
  );
}
