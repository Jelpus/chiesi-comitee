import 'server-only';
import { getAdminTargets } from '@/lib/data/targets';
import { getLegalComplianceMonthlyInputs } from '@/lib/data/legal-compliance-forms';
import { LEGAL_COMPLIANCE_KPIS } from '@/lib/data/legal-compliance-forms-schema';

export type LegalComplianceStatus = 'on_track' | 'watch' | 'off_track';

export type LegalComplianceScore = {
  kpiName: string;
  kpiLabel: string;
  objectiveCount: number | null;
  currentCount: number | null;
  activeCount: number | null;
  additionalAmountMxn: number | null;
  comment: string;
  coveragePct: number | null;
  status: LegalComplianceStatus;
  statusLabel: string;
};

export type LegalComplianceData = {
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  scores: LegalComplianceScore[];
  summary: {
    totalKpis: number;
    onTrack: number;
    watch: number;
    offTrack: number;
    openPending: number;
    weightedHealthPct: number | null;
  };
};

function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function statusLabel(status: LegalComplianceStatus) {
  if (status === 'on_track') return 'On Track';
  if (status === 'watch') return 'Watch';
  return 'Off Track';
}

function resolveStatus(row: {
  kpiName: string;
  objectiveCount: number | null;
  currentCount: number | null;
  activeCount: number | null;
  coveragePct: number | null;
}): LegalComplianceStatus {
  const kpi = normalize(row.kpiName);
  const objective = row.objectiveCount ?? 0;
  const current = row.currentCount ?? 0;
  const active = row.activeCount ?? 0;

  if (kpi.includes('juicios')) {
    if (current + active <= objective) return 'on_track';
    if (current === 0 && active > 0) return 'watch';
    return 'off_track';
  }

  const coveragePct = row.coveragePct;
  const progressWithActive = objective > 0 ? ((current + active) / objective) * 100 : null;
  if (coveragePct != null && coveragePct >= 100) return 'on_track';
  if (progressWithActive != null && progressWithActive >= 100) return 'watch';
  if (coveragePct != null && coveragePct >= 90) return 'watch';
  return 'off_track';
}

export async function getLegalComplianceData(
  reportingVersionId: string,
  periodMonth: string,
): Promise<LegalComplianceData> {
  const [rows, targets] = await Promise.all([
    getLegalComplianceMonthlyInputs(periodMonth),
    getAdminTargets('legal_compliance', reportingVersionId, periodMonth),
  ]);

  const targetByKpi = new Map(
    targets.map((target) => [
      normalize(target.kpiName),
      {
        objectiveCount: target.targetValueNumeric,
        label: target.kpiLabel?.trim() || target.kpiName,
      },
    ]),
  );

  const rowByKpi = new Map(rows.map((row) => [normalize(row.kpiName), row]));
  const scores: LegalComplianceScore[] = LEGAL_COMPLIANCE_KPIS.map((kpiName) => {
    const key = normalize(kpiName);
    const row = rowByKpi.get(key);
    const target = targetByKpi.get(key);

    const objectiveCount = row?.objectiveCount ?? target?.objectiveCount ?? null;
    const currentCount = row?.currentCount ?? null;
    const activeCount = row?.activeCount ?? null;
    const coveragePct =
      objectiveCount != null && objectiveCount > 0 && currentCount != null
        ? (currentCount / objectiveCount) * 100
        : objectiveCount === 0 && (currentCount ?? 0) + (activeCount ?? 0) === 0
          ? 100
          : null;
    const status = resolveStatus({
      kpiName,
      objectiveCount,
      currentCount,
      activeCount,
      coveragePct,
    });

    return {
      kpiName,
      kpiLabel: target?.label || kpiName,
      objectiveCount,
      currentCount,
      activeCount,
      additionalAmountMxn: row?.additionalAmountMxn ?? null,
      comment: row?.comment?.trim() || '',
      coveragePct,
      status,
      statusLabel: statusLabel(status),
    };
  });

  const onTrack = scores.filter((item) => item.status === 'on_track').length;
  const watch = scores.filter((item) => item.status === 'watch').length;
  const offTrack = scores.filter((item) => item.status === 'off_track').length;
  const openPending = scores.reduce((sum, item) => sum + (item.activeCount ?? 0), 0);
  const weightedHealthPct =
    scores.length === 0
      ? null
      : (scores.reduce((sum, item) => {
          if (item.status === 'on_track') return sum + 1;
          if (item.status === 'watch') return sum + 0.5;
          return sum;
        }, 0) /
          scores.length) *
        100;

  return {
    reportPeriodMonth: rows[0]?.periodMonth ?? periodMonth,
    sourceAsOfMonth: rows[0]?.sourceAsOfMonth ?? periodMonth,
    scores,
    summary: {
      totalKpis: scores.length,
      onTrack,
      watch,
      offTrack,
      openPending,
      weightedHealthPct,
    },
  };
}
