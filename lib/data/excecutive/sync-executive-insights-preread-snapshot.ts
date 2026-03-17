import 'server-only';

import { getBigQueryClient } from '@/lib/bigquery/client';
import { getExecutiveHomeQueryRows } from './get-executive-home-query';
import { getMedicalData } from '@/lib/data/medical';
import { getLegalComplianceData } from '@/lib/data/legal-compliance';
import { getRaQualityFvData } from '@/lib/data/ra-quality-fv';

const SNAPSHOT_TABLE = 'chiesi-committee.chiesi_committee_mart.mart_executive_insights_preread_snapshot';

const AREA_LABELS: Record<string, string> = {
  internal_sales: 'Internal Sales',
  commercial_operations: 'Commercial Operations',
  business_excellence: 'Business Excellence',
  medical: 'Medical',
  opex: 'Opex',
  human_resources: 'Human Resources',
  ra_quality_fv: 'RA - Quality - FV',
  legal_compliance: 'Legal & Compliance',
};

const AREA_ORDER = [
  'internal_sales',
  'commercial_operations',
  'business_excellence',
  'medical',
  'opex',
  'human_resources',
  'ra_quality_fv',
  'legal_compliance',
] as const;

type PreReadRow = {
  period: string;
  version: string;
  area: string;
  area_code: string;
  area_order: number;
  landing_url: string | null;
  headline: string;
  summary: string;
  pre_read_text: string;
  sections_json: string;
};

function formatPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(1)}%`;
}

function formatGap(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 'at target';
  return `+${Math.ceil(value)}`;
}

function isBigQueryUpdateRateLimitError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('job exceeded rate limits') ||
    message.includes('table exceeded quota for table update operations') ||
    message.includes('exceeded quota for table update operations')
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryWithRetry<T>(run: () => Promise<T>, maxAttempts = 6): Promise<T> {
  let attempt = 0;
  let delayMs = 1200;
  while (true) {
    try {
      return await run();
    } catch (error) {
      attempt += 1;
      if (!isBigQueryUpdateRateLimitError(error) || attempt >= maxAttempts) {
        throw error;
      }
      await sleep(delayMs);
      delayMs *= 2;
    }
  }
}

let ensurePromise: Promise<void> | null = null;
async function ensureSnapshotTable() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const client = getBigQueryClient();
      await queryWithRetry(() =>
        client.query({
          query: `
            CREATE TABLE IF NOT EXISTS \`${SNAPSHOT_TABLE}\` (
              period DATE,
              version STRING,
              area STRING,
              area_code STRING,
              area_order INT64,
              landing_url STRING,
              headline STRING,
              summary STRING,
              pre_read_text STRING,
              sections_json JSON,
              updated_at TIMESTAMP
            )
          `,
        }),
      );
      await queryWithRetry(() =>
        client.query({
          query: `ALTER TABLE \`${SNAPSHOT_TABLE}\` ADD COLUMN IF NOT EXISTS area_code STRING`,
        }),
      );
      await queryWithRetry(() =>
        client.query({
          query: `ALTER TABLE \`${SNAPSHOT_TABLE}\` ADD COLUMN IF NOT EXISTS area_order INT64`,
        }),
      );
    })();
  }
  await ensurePromise;
}

function buildGenericPreRead(input: {
  areaCode: string;
  areaLabel: string;
  mainKpi: string;
  target: string;
  variance: string;
}): Pick<PreReadRow, 'headline' | 'summary' | 'pre_read_text' | 'sections_json'> {
  const headline = `${input.areaLabel}: current KPI ${input.mainKpi}`;
  const summary = `Target ${input.target} with variance ${input.variance}.`;
  const bullets = [
    `Current KPI: ${input.mainKpi}.`,
    `Target: ${input.target}.`,
    `Variance: ${input.variance}.`,
  ];
  const sections = [
    { title: 'Cut Summary', lines: bullets },
    {
      title: 'Focus',
      lines: ['Validate detailed insight blocks directly in the module insights view for execution follow-up.'],
    },
  ];
  return {
    headline,
    summary,
    pre_read_text: [headline, summary, ...bullets].join('\n'),
    sections_json: JSON.stringify(sections),
  };
}

async function buildMedicalPreRead(reportingVersionId: string, periodMonth: string) {
  const data = await getMedicalData(reportingVersionId, periodMonth);
  const topRisks = data.scores
    .filter((item) => item.status === 'off_track')
    .sort((a, b) => (a.coveragePct ?? -Infinity) - (b.coveragePct ?? -Infinity))
    .slice(0, 3);
  const quickWins = data.scores
    .filter((item) => item.status === 'watch' && item.coveragePct != null)
    .sort((a, b) => (b.coveragePct ?? 0) - (a.coveragePct ?? 0))
    .slice(0, 3);
  const projectedOnTrack = data.summary.onTrack + data.summary.watch;
  const projectedHealthScorePct =
    data.summary.totalKpis > 0 ? (projectedOnTrack / data.summary.totalKpis) * 100 : null;

  const riskLines =
    topRisks.length > 0
      ? topRisks.map((item) => {
          const gap =
            item.targetValue != null && item.resultNumeric != null
              ? item.targetValue - item.resultNumeric
              : Number.NaN;
          return `${item.kpiLabel}: coverage ${formatPercent(item.coveragePct)}, gap ${formatGap(gap)}.`;
        })
      : ['No critical KPI in this cut.'];
  const quickWinLines =
    quickWins.length > 0
      ? quickWins.map((item) => {
          const gap =
            item.targetValue != null && item.resultNumeric != null
              ? item.targetValue - item.resultNumeric
              : Number.NaN;
          return `${item.kpiLabel}: needs ${formatGap(gap)} to move on-track.`;
        })
      : ['No watch KPI close to threshold.'];

  const headline = `Medical health score ${formatPercent(data.summary.healthScorePct)} (${data.summary.onTrack}/${data.summary.totalKpis} on-track).`;
  const summary = `Watch ${data.summary.watch}, off-track ${data.summary.offTrack}.`;
  const sections = [
    { title: 'Top Risks This Cut', lines: riskLines },
    { title: 'Quick Wins', lines: quickWinLines },
    {
      title: 'Projection',
      lines: [
        `If all watch KPIs move on-track, health improves from ${formatPercent(data.summary.healthScorePct)} to ${formatPercent(projectedHealthScorePct)}.`,
      ],
    },
  ];

  return {
    headline,
    summary,
    pre_read_text: [
      headline,
      summary,
      ...sections.flatMap((section) => [`${section.title}:`, ...section.lines]),
    ].join('\n'),
    sections_json: JSON.stringify(sections),
  };
}

async function buildLegalPreRead(reportingVersionId: string, periodMonth: string) {
  const data = await getLegalComplianceData(reportingVersionId, periodMonth);
  const topRisks = data.scores
    .filter((item) => item.status === 'off_track')
    .sort((a, b) => (a.coveragePct ?? -Infinity) - (b.coveragePct ?? -Infinity))
    .slice(0, 3);
  const quickWins = data.scores
    .filter((item) => item.status === 'watch' && item.coveragePct != null)
    .sort((a, b) => (b.coveragePct ?? 0) - (a.coveragePct ?? 0))
    .slice(0, 3);

  const riskLines =
    topRisks.length > 0
      ? topRisks.map((item) => {
          const gap = (item.objectiveCount ?? 0) - (item.currentCount ?? 0);
          return `${item.kpiLabel}: coverage ${formatPercent(item.coveragePct)}, gap ${formatGap(gap)}.`;
        })
      : ['No critical KPI in this cut.'];
  const quickWinLines =
    quickWins.length > 0
      ? quickWins.map((item) => {
          const gap = (item.objectiveCount ?? 0) - (item.currentCount ?? 0);
          return `${item.kpiLabel}: needs ${formatGap(gap)} to move on-track.`;
        })
      : ['No watch KPI close to threshold.'];

  const headline = `Legal & Compliance health ${formatPercent(data.summary.weightedHealthPct)} (${data.summary.onTrack}/${data.summary.totalKpis} on-track).`;
  const summary = `Watch ${data.summary.watch}, off-track ${data.summary.offTrack}, open pending ${data.summary.openPending}.`;
  const sections = [
    { title: 'Top Risks This Cut', lines: riskLines },
    { title: 'Quick Wins', lines: quickWinLines },
    {
      title: 'Management Focus (Next 30 Days)',
      lines: [
        `Prioritize highest gaps and reduce open pending items (${data.summary.openPending}) with weekly owner follow-up.`,
      ],
    },
  ];

  return {
    headline,
    summary,
    pre_read_text: [
      headline,
      summary,
      ...sections.flatMap((section) => [`${section.title}:`, ...section.lines]),
    ].join('\n'),
    sections_json: JSON.stringify(sections),
  };
}

async function buildRaPreRead(reportingVersionId: string, periodMonth: string) {
  const data = await getRaQualityFvData(reportingVersionId, periodMonth);
  const topicCompletionPct = (item: (typeof data.scores)[number]) => {
    const topic = item.topic.toLowerCase();
    if (topic.includes('procedimientos')) {
      const active = item.activeCount ?? 0;
      const overdue = item.overdueCount ?? 0;
      if (active <= 0) return 100;
      return Math.max(0, ((active - overdue) / active) * 100);
    }
    if (topic.includes('auditorias')) {
      if (item.targetValue == null || item.targetValue <= 0) return null;
      return ((item.ytdCount ?? 0) / item.targetValue) * 100;
    }
    const onTime = item.onTimeCount ?? 0;
    const late = item.lateCount ?? 0;
    const pending = item.pendingCount ?? 0;
    const total = onTime + late + pending;
    if (total <= 0) return null;
    return (onTime / total) * 100;
  };

  const topRisks = data.scores
    .filter((item) => item.status === 'off_track')
    .sort((a, b) => (topicCompletionPct(a) ?? -Infinity) - (topicCompletionPct(b) ?? -Infinity))
    .slice(0, 3);

  const quickWins = data.scores
    .filter((item) => item.status === 'watch')
    .sort((a, b) => (topicCompletionPct(b) ?? 0) - (topicCompletionPct(a) ?? 0))
    .slice(0, 3);

  const riskLines =
    topRisks.length > 0
      ? topRisks.map(
          (item) =>
            `${item.targetText && item.targetText !== 'Target not configured' ? item.targetText : item.topic}: completion ${formatPercent(topicCompletionPct(item))}.`,
        )
      : ['No critical topics in this cut.'];
  const quickWinLines =
    quickWins.length > 0
      ? quickWins.map(
          (item) =>
            `${item.targetText && item.targetText !== 'Target not configured' ? item.targetText : item.topic}: closest to threshold and requires execution follow-up.`,
        )
      : ['No near-threshold topics in this cut.'];

  const headline = `RA - Quality - FV health ${formatPercent(data.summary.weightedHealthPct)} (${data.summary.onTrack}/${data.summary.totalTopics} on-track).`;
  const summary = `Watch ${data.summary.watch}, off-track ${data.summary.offTrack}, pending ${data.summary.openPending}.`;
  const sections = [
    { title: 'Top Risks This Cut', lines: riskLines },
    { title: 'Quick Wins', lines: quickWinLines },
    {
      title: 'Management Focus (Next 30 Days)',
      lines: [
        `Prioritize off-track topics and reduce pending workload (${data.summary.openPending}) with weekly owner cadence.`,
      ],
    },
  ];

  return {
    headline,
    summary,
    pre_read_text: [
      headline,
      summary,
      ...sections.flatMap((section) => [`${section.title}:`, ...section.lines]),
    ].join('\n'),
    sections_json: JSON.stringify(sections),
  };
}

export async function syncExecutiveInsightsPreReadSnapshot(params: {
  reportingVersionId: string;
  periodMonth: string;
}) {
  await ensureSnapshotTable();
  const rows = await getExecutiveHomeQueryRows({ reportingVersionId: params.reportingVersionId });
  const client = getBigQueryClient();

  if (rows.length === 0) {
    return { ok: true as const, upserted: 0 };
  }

  const enrichedByArea = new Map<
    string,
    Awaited<ReturnType<typeof buildMedicalPreRead> | ReturnType<typeof buildLegalPreRead> | ReturnType<typeof buildRaPreRead>>
  >();

  const [medical, legal, ra] = await Promise.all([
    buildMedicalPreRead(params.reportingVersionId, params.periodMonth).catch(() => null),
    buildLegalPreRead(params.reportingVersionId, params.periodMonth).catch(() => null),
    buildRaPreRead(params.reportingVersionId, params.periodMonth).catch(() => null),
  ]);
  if (medical) enrichedByArea.set('medical', medical);
  if (legal) enrichedByArea.set('legal_compliance', legal);
  if (ra) enrichedByArea.set('ra_quality_fv', ra);

  const snapshotRows: PreReadRow[] = rows.map((row) => {
    const areaCode = row.area;
    const areaLabel = AREA_LABELS[areaCode] ?? areaCode;
    const areaOrder = AREA_ORDER.indexOf(areaCode as (typeof AREA_ORDER)[number]) + 1;
    const enriched = enrichedByArea.get(areaCode);
    if (enriched) {
      return {
        period: row.period,
        version: row.version,
        area: areaLabel,
        area_code: areaCode,
        area_order: areaOrder > 0 ? areaOrder : 999,
        landing_url: row.landing_url,
        headline: enriched.headline,
        summary: enriched.summary,
        pre_read_text: enriched.pre_read_text,
        sections_json: enriched.sections_json,
      };
    }
    const generic = buildGenericPreRead({
      areaCode,
      areaLabel,
      mainKpi: row.main_kpi_value,
      target: row.target_value,
      variance: row.variance_value,
    });
    return {
      period: row.period,
      version: row.version,
      area: areaLabel,
      area_code: areaCode,
      area_order: areaOrder > 0 ? areaOrder : 999,
      landing_url: row.landing_url,
      ...generic,
    };
  });

  const versions = [...new Set(snapshotRows.map((row) => row.version))];
  await queryWithRetry(() =>
    client.query({
      query: `
        DELETE FROM \`${SNAPSHOT_TABLE}\`
        WHERE version IN UNNEST(@versions)
      `,
      params: { versions },
    }),
  );

  await queryWithRetry(() =>
    client.query({
      query: `
        INSERT INTO \`${SNAPSHOT_TABLE}\`
        (period, version, area, area_code, area_order, landing_url, headline, summary, pre_read_text, sections_json, updated_at)
        SELECT
          DATE(row.period),
          row.version,
          row.area,
          row.area_code,
          row.area_order,
          row.landing_url,
          row.headline,
          row.summary,
          row.pre_read_text,
          PARSE_JSON(row.sections_json),
          CURRENT_TIMESTAMP()
        FROM UNNEST(@rows) AS row
      `,
      params: {
        rows: snapshotRows,
      },
    }),
  );

  return { ok: true as const, upserted: snapshotRows.length };
}
