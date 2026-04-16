import 'server-only';
import { getAdminTargets } from '@/lib/data/targets';
import { getRaMonthlyInputs } from '@/lib/data/ra-forms';

export type RaTopicStatus = 'on_track' | 'watch' | 'off_track';

export type RaTopicScore = {
  topic: string;
  targetText: string;
  resultText: string;
  status: RaTopicStatus;
  statusLabel: string;
  targetValue: number | null;
  onTimeCount: number | null;
  lateCount: number | null;
  pendingCount: number | null;
  activeCount: number | null;
  overdueCount: number | null;
  ytdCount: number | null;
  comment: string;
};

export type RaQualityFvData = {
  reportPeriodMonth: string | null;
  sourceAsOfMonth: string | null;
  scores: RaTopicScore[];
  summary: {
    totalTopics: number;
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

function parseTopicTargetValue(targetText: string | null | undefined) {
  const text = String(targetText ?? '').trim();
  if (!text) return null;
  const numeric = Number(text.replace(/[%,$]/g, '').replace(/\s+/g, '').replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : null;
}

function monthNumber(periodMonth: string | null | undefined) {
  if (!periodMonth) return null;
  const date = new Date(`${periodMonth}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCMonth() + 1;
}

function deriveEffectiveYtdCount(row: {
  topic: string;
  ytdCount: number | null;
  onTimeCount: number | null;
  lateCount: number | null;
  pendingCount: number | null;
  activeCount: number | null;
  overdueCount: number | null;
}) {
  if (row.ytdCount != null) return row.ytdCount;
  const topicKey = normalize(row.topic);
  if (topicKey.includes('procedimientos')) {
    const hasProcedureInputs = row.activeCount != null || row.overdueCount != null;
    if (!hasProcedureInputs) return null;
    return (row.activeCount ?? 0) + (row.overdueCount ?? 0);
  }
  const hasExecutionMixInput =
    row.onTimeCount != null || row.lateCount != null || row.pendingCount != null;
  if (!hasExecutionMixInput) return null;
  return (row.onTimeCount ?? 0) + (row.lateCount ?? 0) + (row.pendingCount ?? 0);
}

function deriveTopicStatus(
  topic: string,
  targetValue: number | null,
  periodMonth: string | null,
  row: {
    onTimeCount: number | null;
    lateCount: number | null;
    pendingCount: number | null;
    activeCount: number | null;
    overdueCount: number | null;
    ytdCount: number | null;
    resultText: string;
  },
): RaTopicStatus {
  const topicKey = normalize(topic);

  if (topicKey.includes('procedimientos')) {
    const active = row.activeCount ?? 0;
    const ytd = row.ytdCount ?? 0;
    if (ytd > 0) {
      const activeRate = active / ytd;
      if (activeRate >= 0.8) return 'on_track';
      return 'off_track';
    }
    const overdue = row.overdueCount ?? 0;
    if (overdue <= 0) return 'on_track';
    if (overdue <= 2) return 'watch';
    return 'off_track';
  }

  if (topicKey.includes('auditorias')) {
    const ytd = row.ytdCount ?? 0;
    const month = monthNumber(periodMonth);
    if (targetValue == null || month == null || month <= 0) {
      return ytd > 0 ? 'watch' : 'off_track';
    }
    const expected = (targetValue * month) / 12;
    if (ytd >= expected) return 'on_track';
    if (ytd >= expected * 0.8) return 'watch';
    return 'off_track';
  }

  const onTime = row.onTimeCount ?? 0;
  const late = row.lateCount ?? 0;
  const pending = row.pendingCount ?? 0;
  const totalTracked = onTime + late + pending;
  if (totalTracked > 0) {
    const onTimeRate = onTime / totalTracked;
    if (late === 0 && pending <= 2) return 'on_track';
    if (onTimeRate >= 0.8) return 'watch';
    return 'off_track';
  }

  const resultText = normalize(row.resultText);
  if (resultText.includes('ninguna supero') || resultText.includes('less than') || resultText.includes('menos de')) {
    return 'on_track';
  }
  return 'watch';
}

export async function getRaQualityFvData(
  reportingVersionId: string,
  periodMonth: string,
): Promise<RaQualityFvData> {
  const [inputs, targets] = await Promise.all([
    getRaMonthlyInputs(periodMonth),
    getAdminTargets('ra_quality_fv', reportingVersionId, periodMonth),
  ]);

  const targetByTopic = new Map<string, { text: string; value: number | null }>();
  for (const target of targets) {
    const key = normalize(target.kpiName);
    const text = target.kpiLabel?.trim() || target.kpiName;
    const value = target.targetValueNumeric ?? parseTopicTargetValue(target.targetValueText);

    if (key.includes('liberaciones')) targetByTopic.set('liberaciones', { text, value });
    if (key.includes('registros')) targetByTopic.set('registros sanitarios', { text, value });
    if (key.includes('modificaciones')) targetByTopic.set('modificaciones regulatorias', { text, value });
    if (key.includes('importacion')) targetByTopic.set('permisos de importacion', { text, value });
    if (key.includes('procedimientos')) targetByTopic.set('procedimientos', { text, value });
    if (key.includes('auditorias')) targetByTopic.set('auditorias externas', { text, value });
  }

  const scores: RaTopicScore[] = inputs.map((row) => {
    const topicKey = normalize(row.topic);
    const targetMatch =
      targetByTopic.get(topicKey) ||
      [...targetByTopic.entries()].find(([key]) => topicKey.includes(key))?.[1] ||
      null;
    const targetText = targetMatch?.text || row.targetLabel || 'Target not configured';
    const targetValue = targetMatch?.value ?? parseTopicTargetValue(row.targetLabel);
    const effectiveYtdCount = deriveEffectiveYtdCount({
      topic: row.topic,
      ytdCount: row.ytdCount,
      onTimeCount: row.onTimeCount,
      lateCount: row.lateCount,
      pendingCount: row.pendingCount,
      activeCount: row.activeCount,
      overdueCount: row.overdueCount,
    });
    const status = deriveTopicStatus(row.topic, targetValue, row.periodMonth, {
      onTimeCount: row.onTimeCount,
      lateCount: row.lateCount,
      pendingCount: row.pendingCount,
      activeCount: row.activeCount,
      overdueCount: row.overdueCount,
      ytdCount: effectiveYtdCount,
      resultText: row.resultSummary,
    });

    const statusLabel =
      status === 'on_track' ? 'On Track' : status === 'watch' ? 'Watch' : 'Off Track';

    return {
      topic: row.topic,
      targetText,
      resultText: row.resultSummary,
      status,
      statusLabel,
      targetValue,
      onTimeCount: row.onTimeCount,
      lateCount: row.lateCount,
      pendingCount: row.pendingCount,
      activeCount: row.activeCount,
      overdueCount: row.overdueCount,
      ytdCount: effectiveYtdCount,
      comment: row.comment,
    };
  });

  const onTrack = scores.filter((item) => item.status === 'on_track').length;
  const watch = scores.filter((item) => item.status === 'watch').length;
  const offTrack = scores.filter((item) => item.status === 'off_track').length;
  const openPending = scores.reduce((sum, item) => sum + (item.pendingCount ?? 0), 0);
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
    reportPeriodMonth: inputs[0]?.periodMonth ?? periodMonth,
    sourceAsOfMonth: inputs[0]?.sourceAsOfMonth ?? periodMonth,
    scores,
    summary: {
      totalTopics: scores.length,
      onTrack,
      watch,
      offTrack,
      openPending,
      weightedHealthPct,
    },
  };
}
