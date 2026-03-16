'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { saveRaMonthlyInputs } from '@/lib/data/ra-forms';
import { RA_TOPICS } from '@/lib/data/ra-forms-schema';
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

export async function submitRegulatoryAffairsForm(formData: FormData) {
  const periodMonth = normalizeMonthToDate(String(formData.get('periodMonth') ?? ''));
  const sourceAsOfMonth = normalizeMonthToDate(String(formData.get('sourceAsOfMonth') ?? '')) || periodMonth;
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const reportedBy = String(formData.get('reportedBy') ?? '').trim();
  if (!reportedBy) {
    throw new Error('Reported by is required.');
  }
  const targets = reportingVersionId
    ? await getAdminTargets('ra_quality_fv', reportingVersionId, periodMonth)
    : [];
  const objectiveByTopic = new Map<string, string>();
  for (const target of targets) {
    const key = (target.kpiName ?? '').toLowerCase();
    const label = target.kpiLabel?.trim() || target.kpiName;
    if (key.includes('liberaciones')) objectiveByTopic.set('Liberaciones', label);
    if (key.includes('registros')) objectiveByTopic.set('Registros Sanitarios', label);
    if (key.includes('modificaciones')) objectiveByTopic.set('Modificaciones Regulatorias', label);
    if (key.includes('importacion')) objectiveByTopic.set('Permisos de Importacion', label);
    if (key.includes('procedimientos')) objectiveByTopic.set('Procedimientos', label);
    if (key.includes('auditorias')) objectiveByTopic.set('Auditorias Externas', label);
  }

  const topics = RA_TOPICS.map((topic) => {
    const key = topic.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return {
      topic,
      targetLabel: objectiveByTopic.get(topic) ?? '',
      resultSummary: String(formData.get(`${key}_result`) ?? '').trim(),
      onTimeCount: normalizeCount(formData.get(`${key}_on_time`)),
      lateCount: normalizeCount(formData.get(`${key}_late`)),
      pendingCount: normalizeCount(formData.get(`${key}_pending`)),
      activeCount: normalizeCount(formData.get(`${key}_active`)),
      overdueCount: normalizeCount(formData.get(`${key}_overdue`)),
      ytdCount: normalizeCount(formData.get(`${key}_ytd`)),
      comment: String(formData.get(`${key}_comment`) ?? '').trim(),
    };
  });

  const invalidTopics = topics.filter(
    (topic) =>
      topic.resultSummary.trim().length === 0 ||
      topic.onTimeCount == null ||
      topic.lateCount == null ||
      topic.pendingCount == null ||
      topic.activeCount == null ||
      topic.overdueCount == null ||
      topic.ytdCount == null,
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
        resultSummary: 'En febrero se aprobaron 3 permisos y todos tomaron menos de 3.5 meses.',
        onTimeCount: 3,
        lateCount: 0,
        pendingCount: 0,
        activeCount: null,
        overdueCount: null,
        ytdCount: null,
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
        resultSummary: 'En febrero se realizo 1 auditoria externa; total YTD: 1.',
        onTimeCount: null,
        lateCount: null,
        pendingCount: null,
        activeCount: null,
        overdueCount: null,
        ytdCount: 1,
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
