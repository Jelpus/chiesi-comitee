'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getRaMonthlyInputs, saveRaMonthlyInputs } from '@/lib/data/ra-forms';
import { parseRaCountFields, RA_TOPICS, RA_TOPIC_COUNT_FIELDS } from '@/lib/data/ra-forms-schema';
import { getAdminTargets, upsertAdminTarget } from '@/lib/data/targets';

function normalizeCount(value: FormDataEntryValue | null) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function normalizeMonthToDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return trimmed;
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

export async function submitRegulatoryAffairsForm(formData: FormData) {
  const periodMonth = normalizeMonthToDate(String(formData.get('periodMonth') ?? ''));
  const sourceAsOfMonth = normalizeMonthToDate(String(formData.get('sourceAsOfMonth') ?? '')) || periodMonth;
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const reportedBy = String(formData.get('reportedBy') ?? '').trim();
  if (!reportedBy) {
    throw new Error('Reported by is required.');
  }
  const [targets, existingRows] = await Promise.all([
    reportingVersionId
      ? getAdminTargets('ra_quality_fv', reportingVersionId, periodMonth)
      : Promise.resolve([]),
    getRaMonthlyInputs(periodMonth),
  ]);
  const objectiveByTopic = new Map<string, string>();
  const countFieldsByTopic = new Map<string, ReadonlySet<string>>();
  const topicByExistingTargetLabel = new Map<string, string>();
  for (const row of existingRows) {
    const labelKey = normalizeText(row.targetLabel);
    if (!labelKey) continue;
    if (!RA_TOPICS.includes(row.topic as (typeof RA_TOPICS)[number])) continue;
    topicByExistingTargetLabel.set(labelKey, row.topic);
  }

  for (const target of targets) {
    const label = target.kpiLabel?.trim() || target.kpiName;
    const topicFromExistingLabel = topicByExistingTargetLabel.get(normalizeText(label));
    const resolvedTopic = topicFromExistingLabel ?? resolveTopicFromText(target.kpiName) ?? resolveTopicFromText(target.kpiLabel);
    if (resolvedTopic) {
      objectiveByTopic.set(resolvedTopic, label);
      const parsedFields = parseRaCountFields(target.formFields);
      if (parsedFields.length > 0) {
        countFieldsByTopic.set(resolvedTopic, new Set(parsedFields));
      }
    }
  }

  const topics = RA_TOPICS.map((topic) => {
    const key = topic.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const configuredFields = countFieldsByTopic.get(topic) ?? new Set(RA_TOPIC_COUNT_FIELDS[topic] ?? []);
    return {
      topic,
      targetLabel: objectiveByTopic.get(topic) ?? '',
      resultSummary: String(formData.get(`${key}_result`) ?? '').trim(),
      onTimeCount: configuredFields.has('on_time') ? normalizeCount(formData.get(`${key}_on_time`)) : null,
      lateCount: configuredFields.has('late') ? normalizeCount(formData.get(`${key}_late`)) : null,
      pendingCount: configuredFields.has('pending') ? normalizeCount(formData.get(`${key}_pending`)) : null,
      activeCount: configuredFields.has('active') ? normalizeCount(formData.get(`${key}_active`)) : null,
      overdueCount: configuredFields.has('overdue') ? normalizeCount(formData.get(`${key}_overdue`)) : null,
      ytdCount: configuredFields.has('ytd') ? normalizeCount(formData.get(`${key}_ytd`)) : null,
      comment: String(formData.get(`${key}_comment`) ?? '').trim(),
    };
  });

  const invalidTopics = topics.filter(
    (topic) => {
      if (topic.resultSummary.trim().length === 0) return true;
      const configuredFields =
        countFieldsByTopic.get(topic.topic) ??
        new Set(RA_TOPIC_COUNT_FIELDS[topic.topic as (typeof RA_TOPICS)[number]] ?? []);
      if (configuredFields.has('on_time') && topic.onTimeCount == null) return true;
      if (configuredFields.has('late') && topic.lateCount == null) return true;
      if (configuredFields.has('pending') && topic.pendingCount == null) return true;
      if (configuredFields.has('active') && topic.activeCount == null) return true;
      if (configuredFields.has('overdue') && topic.overdueCount == null) return true;
      if (configuredFields.has('ytd') && topic.ytdCount == null) return true;
      return false;
    },
  );
  if (invalidTopics.length > 0) {
    throw new Error(`Missing required fields for ${invalidTopics.length} topic(s).`);
  }

  await saveRaMonthlyInputs({
    periodMonth,
    sourceAsOfMonth,
    reportedBy,
    topics,
  });

  revalidatePath('/forms/regulatory-affairs');
  revalidatePath('/executive/ra-quality-fv');
  const params = new URLSearchParams();
  params.set('period', periodMonth);
  params.set('saved', String(topics.length));
  redirect(`/forms/regulatory-affairs/thank-you?${params.toString()}`);
}

function parseNumericTarget(rawValue: string): number | null {
  const raw = rawValue.trim();
  if (!raw) return null;
  const sanitized = raw.replace(/[%,$\s]/g, '').replace(/,/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

const RA_TARGET_SEED: Array<{
  kpiName: string;
  qtyUnit: string;
  targetValueText: string;
}> = [
  { kpiName: 'Liberaciones <= 30 dias', qtyUnit: 'Days', targetValueText: '30' },
  { kpiName: 'Registros Sanitarios <= 18 meses', qtyUnit: 'Months', targetValueText: '18' },
  { kpiName: 'Modificaciones Regulatorias <= 18 meses', qtyUnit: 'Months', targetValueText: '18' },
  { kpiName: 'Permisos de Importacion <= 3.5 meses', qtyUnit: 'Months', targetValueText: '3.5' },
  { kpiName: 'Procedimientos vencidos', qtyUnit: 'Count', targetValueText: '0' },
  { kpiName: 'Auditorias Externas >= 5 (YTD)', qtyUnit: 'Count', targetValueText: '5' },
];

export async function seedRegulatoryAffairsBaseline(formData: FormData) {
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const periodMonth = String(formData.get('periodMonth') ?? '').trim();
  const sourceAsOfMonth = String(formData.get('sourceAsOfMonth') ?? '').trim() || periodMonth;

  if (!reportingVersionId) throw new Error('Reporting version is required.');
  if (!periodMonth) throw new Error('Period month is required.');

  for (const item of RA_TARGET_SEED) {
    await upsertAdminTarget({
      reportingVersionId,
      periodMonth,
      area: 'ra_quality_fv',
      kpiName: item.kpiName,
      qtyUnit: item.qtyUnit,
      targetValueText: item.targetValueText,
      targetValueNumeric: parseNumericTarget(item.targetValueText),
      isActive: true,
      updatedBy: 'seed',
    });
  }

  await saveRaMonthlyInputs({
    periodMonth,
    sourceAsOfMonth,
    reportedBy: 'seed',
    topics: [
      {
        topic: 'Liberaciones',
        targetLabel: 'Concretar liberaciones en 30 dias o menos.',
        resultSummary:
          'Durante febrero se concretaron 3 en menos de 30 dias; ninguna supero ese tiempo; 2 pendientes en evaluacion de COFEPRIS.',
        onTimeCount: 3,
        lateCount: 0,
        pendingCount: 2,
        activeCount: null,
        overdueCount: null,
        ytdCount: null,
        comment: 'Pendientes en evaluacion por COFEPRIS.',
      },
      {
        topic: 'Registros Sanitarios',
        targetLabel: 'Aprobacion de nuevos registros en menos de 18 meses.',
        resultSummary:
          'Durante este periodo no se obtuvo ningun nuevo registro en menos de 18 meses; se obtuvo 1, pero tomo mas de 18 meses.',
        onTimeCount: 0,
        lateCount: 1,
        pendingCount: 1,
        activeCount: null,
        overdueCount: null,
        ytdCount: null,
        comment: 'En evaluacion por COFEPRIS.',
      },
      {
        topic: 'Modificaciones Regulatorias',
        targetLabel: 'Aprobacion de modificaciones regulatorias en menos de 18 meses.',
        resultSummary:
          'Se obtuvieron 5 aprobaciones en febrero que tomaron menos de 18 meses; ninguna supero 18 meses.',
        onTimeCount: 5,
        lateCount: 0,
        pendingCount: 0,
        activeCount: null,
        overdueCount: null,
        ytdCount: null,
        comment: '',
      },
      {
        topic: 'Permisos de Importacion',
        targetLabel: 'Aprobacion de permisos de importacion en menos de 3.5 meses.',
        resultSummary: 'En febrero se aprobaron 3 permisos; acumulado YTD: 3.',
        onTimeCount: null,
        lateCount: null,
        pendingCount: null,
        activeCount: null,
        overdueCount: null,
        ytdCount: 3,
        comment: '',
      },
      {
        topic: 'Procedimientos',
        targetLabel: '0 procedimientos vencidos.',
        resultSummary:
          'En febrero se cuenta con 81 procedimientos vigentes y 5 vencidos.',
        onTimeCount: null,
        lateCount: null,
        pendingCount: null,
        activeCount: 81,
        overdueCount: 5,
        ytdCount: null,
        comment: 'Vencidos: Logistica 2, Procurement 2, Finanzas 2.',
      },
      {
        topic: 'Auditorias Externas',
        targetLabel: '>= 5 auditorias externas en el anio.',
        resultSummary: 'En febrero se realizo 1 auditoria externa activa en seguimiento.',
        onTimeCount: null,
        lateCount: null,
        pendingCount: null,
        activeCount: 1,
        overdueCount: null,
        ytdCount: null,
        comment: '',
      },
    ],
  });

  revalidatePath('/forms/regulatory-affairs');
  revalidatePath('/admin/targets');
  revalidatePath('/executive/ra-quality-fv');

  return {
    ok: true as const,
    message: 'RA seed applied: targets + February baseline results.',
  };
}
