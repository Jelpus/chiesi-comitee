import 'server-only';
import { getAdminTargets } from '@/lib/data/targets';
import { getMedicalMonthlyInputs } from '@/lib/data/medical-forms';

export type MedicalKpiStatus = 'on_track' | 'watch' | 'off_track';

export type MedicalKpiScore = {
  kpiName: string;
  kpiLabel: string;
  qtyUnit: string;
  targetText: string;
  targetValue: number | null;
  resultNumeric: number | null;
  resultText: string;
  comment: string;
  status: MedicalKpiStatus;
  statusLabel: string;
  coveragePct: number | null;
};

export type MedicalData = {
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  scores: MedicalKpiScore[];
  summary: {
    totalKpis: number;
    onTrack: number;
    watch: number;
    offTrack: number;
    healthScorePct: number | null;
  };
};

function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function parseLooseNumber(value: string | null | undefined) {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  const parsed = Number(normalized.replace(/[$,%\s]/g, '').replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveStatus(coveragePct: number | null): MedicalKpiStatus {
  if (coveragePct == null || !Number.isFinite(coveragePct)) return 'watch';
  if (coveragePct >= 100) return 'on_track';
  if (coveragePct >= 85) return 'watch';
  return 'off_track';
}

export async function getMedicalData(
  reportingVersionId: string,
  periodMonth: string,
): Promise<MedicalData> {
  const [targets, inputs] = await Promise.all([
    getAdminTargets('medical', reportingVersionId, periodMonth),
    getMedicalMonthlyInputs(periodMonth),
  ]);

  const activeTargets = targets
    .filter((item) => item.isActive)
    .sort((a, b) => (a.kpiLabel?.trim() || a.kpiName).localeCompare(b.kpiLabel?.trim() || b.kpiName));

  const inputByKpi = new Map(inputs.map((item) => [normalize(item.kpiName), item]));

  const scores: MedicalKpiScore[] = activeTargets.map((target) => {
    const kpiKey = normalize(target.kpiName);
    const input = inputByKpi.get(kpiKey);

    const targetValue = target.targetValueNumeric ?? parseLooseNumber(target.targetValueText);
    const resultNumeric =
      input?.resultValueNumeric ??
      parseLooseNumber(input?.resultValueText) ??
      0;
    const resultText = input?.resultValueText?.trim() || '';
    const comment = input?.comment?.trim() || '';

    const coveragePct =
      targetValue == null
        ? null
        : targetValue === 0
          ? resultNumeric <= 0
            ? 100
            : 0
          : (resultNumeric / targetValue) * 100;
    const status = deriveStatus(coveragePct);
    const statusLabel = status === 'on_track' ? 'On Track' : status === 'watch' ? 'Watch' : 'Off Track';

    return {
      kpiName: target.kpiName,
      kpiLabel: target.kpiLabel?.trim() || target.kpiName,
      qtyUnit: target.qtyUnit,
      targetText: target.targetValueText?.trim() || 'N/A',
      targetValue,
      resultNumeric,
      resultText,
      comment,
      status,
      statusLabel,
      coveragePct,
    };
  });

  const onTrack = scores.filter((item) => item.status === 'on_track').length;
  const watch = scores.filter((item) => item.status === 'watch').length;
  const offTrack = scores.filter((item) => item.status === 'off_track').length;
  const healthScorePct =
    scores.length > 0
      ? ((onTrack * 1 + watch * 0.5) / scores.length) * 100
      : null;

  return {
    reportPeriodMonth: inputs[0]?.periodMonth ?? periodMonth,
    sourceAsOfMonth: inputs[0]?.sourceAsOfMonth ?? periodMonth,
    scores,
    summary: {
      totalKpis: scores.length,
      onTrack,
      watch,
      offTrack,
      healthScorePct,
    },
  };
}
