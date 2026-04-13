'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { deleteAdminTarget, getAdminTargets, upsertAdminTarget } from '@/lib/data/targets';

function parseNumericTarget(rawValue: string): number | null {
  const raw = rawValue.trim();
  if (!raw) return null;
  const sanitized = raw.replace(/[%,$\s]/g, '').replace(/,/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

const DEFAULT_TARGET_SEED: Array<{
  area: string;
  kpiName: string;
  qtyUnit: string;
  targetValue: string;
}> = [
  { area: 'commercial_operations', kpiName: 'DOH Total Chiesi', qtyUnit: 'Days', targetValue: '60' },
  { area: 'commercial_operations', kpiName: 'DOH Privado', qtyUnit: 'Days', targetValue: '45' },
  { area: 'commercial_operations', kpiName: 'MOH Gobierno', qtyUnit: 'Months', targetValue: '2.17' },
  { area: 'commercial_operations', kpiName: 'DSO Privado', qtyUnit: 'Days', targetValue: '120' },
  { area: 'commercial_operations', kpiName: 'DSO Gobierno 40 (Vanguardia)', qtyUnit: 'Days', targetValue: '200' },
  { area: 'commercial_operations', kpiName: 'DSO Gobierno 70 (BAU)', qtyUnit: 'Days', targetValue: '70' },
  { area: 'commercial_operations', kpiName: 'Fill rate Gobierno', qtyUnit: '%', targetValue: '85%' },
  { area: 'commercial_operations', kpiName: 'Lead time Gobierno', qtyUnit: 'Days', targetValue: '15' },
  { area: 'commercial_operations', kpiName: 'Incidencias Gobierno', qtyUnit: '%', targetValue: '10%' },
  {
    area: 'commercial_operations',
    kpiName: 'Avance de contratos / Extensión de Contratos',
    qtyUnit: 'Units',
    targetValue: '475,675',
  },
  { area: 'commercial_operations', kpiName: 'Canjes', qtyUnit: '%', targetValue: '9.6%' },
  { area: 'commercial_operations', kpiName: 'Sanciones', qtyUnit: '%', targetValue: '5%' },
  { area: 'commercial_operations', kpiName: 'Devoluciones', qtyUnit: '%', targetValue: '3%' },
  { area: 'commercial_operations', kpiName: 'Fill rate Privado', qtyUnit: '%', targetValue: '90%' },
  { area: 'commercial_operations', kpiName: 'Lead time Privado', qtyUnit: 'Days', targetValue: '7' },
  { area: 'commercial_operations', kpiName: 'Incidencias / Rechazos Privado', qtyUnit: '%', targetValue: '5%' },
  { area: 'medical', kpiName: 'MSLs Aire interacciones', qtyUnit: 'Count', targetValue: '64' },
  { area: 'medical', kpiName: 'MSLs CARE interacciones', qtyUnit: 'Count', targetValue: '20' },
  { area: 'medical', kpiName: 'Avance documentos Contratos Speakers AIR', qtyUnit: '%', targetValue: '20%' },
  {
    area: 'medical',
    kpiName: '% cruce medicos MSL vs FV Privado y Gobierno',
    qtyUnit: '%',
    targetValue: '20%',
  },
  {
    area: 'medical',
    kpiName: '# de solicitudes de información medica y conocer medico que solicitó, tema y cuando se atendio',
    qtyUnit: 'Count',
    targetValue: '10',
  },
  { area: 'medical', kpiName: 'Actualización de slide kits Speakers Air', qtyUnit: 'Count', targetValue: '2' },
  {
    area: 'medical',
    kpiName: 'Interacciones Gerente médico con líderes opinión TOP 15',
    qtyUnit: 'Count',
    targetValue: '15',
  },
  { area: 'medical', kpiName: 'Entrenamientos medicos a FV AIR', qtyUnit: 'Count', targetValue: '3' },
  {
    area: 'medical',
    kpiName: 'Reporte de highlights asistencia Congresos Nacionales e Internacionales',
    qtyUnit: 'Count',
    targetValue: '0',
  },
  { area: 'medical', kpiName: 'Respuesta a objeciones médicas CARE', qtyUnit: 'Count', targetValue: '3' },
  { area: 'medical', kpiName: 'Respuesta a objeciones médicas AIR', qtyUnit: 'Count', targetValue: '8' },
  {
    area: 'medical',
    kpiName: 'Benchmark área medica de otros Paises como Brasil, Australia, tema y que podemos aplicar',
    qtyUnit: 'Count',
    targetValue: '2',
  },
  {
    area: 'medical',
    kpiName: 'Revision de mensajes promocionales y materiales con medicos Speakers para mejorar, cambiar, continuar',
    qtyUnit: 'Count',
    targetValue: '2',
  },
  { area: 'medical', kpiName: 'Gestión y Desarrollo del Panel de Speakers Air', qtyUnit: 'Count', targetValue: '5' },
  { area: 'medical', kpiName: 'Gestión y Desarrollo del Panel de Speakers Care', qtyUnit: 'Count', targetValue: '17' },
  { area: 'medical', kpiName: 'Certificación de Mensajes Clave CARE', qtyUnit: '%', targetValue: '80%' },
  { area: 'medical', kpiName: 'Índice de Inteligencia de Campo (Insights) Air', qtyUnit: 'Index', targetValue: '5' },
  { area: 'medical', kpiName: 'Índice de Inteligencia de Campo (Insights) Care', qtyUnit: 'Index', targetValue: '4' },
  { area: 'medical', kpiName: 'Tasa de Ejecución de Evidencia Local AIR', qtyUnit: '%', targetValue: '5%' },
  { area: 'medical', kpiName: 'Tasa de Ejecución de Evidencia Local CARE', qtyUnit: '%', targetValue: '5%' },
  { area: 'medical', kpiName: 'Pláticas hospitales CC', qtyUnit: 'Count', targetValue: '2' },
  { area: 'medical', kpiName: 'Efectividad de Soporte MIRs', qtyUnit: '%', targetValue: '80%' },
];

export async function saveAdminTarget(formData: FormData) {
  const targetId = String(formData.get('targetId') ?? '').trim();
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const periodMonth = String(formData.get('periodMonth') ?? '').trim();
  const area = String(formData.get('area') ?? '').trim().toLowerCase();
  const kpiName = String(formData.get('kpiName') ?? '').trim();
  const kpiLabel = String(formData.get('kpiLabel') ?? '').trim();
  const qtyUnit = String(formData.get('qtyUnit') ?? '').trim();
  const targetValueText = String(formData.get('targetValue') ?? '').trim();
  const formFields = String(formData.get('formFields') ?? '').trim();
  const isActive = String(formData.get('isActive') ?? 'true') === 'true';

  if (!reportingVersionId) throw new Error('Reporting version is required.');
  if (!periodMonth) throw new Error('Period month is required.');
  if (!area) throw new Error('Area is required.');
  if (!kpiName) throw new Error('KPI name is required.');

  const result = await upsertAdminTarget({
    targetId: targetId || undefined,
    reportingVersionId,
    periodMonth,
    area,
    kpiName,
    kpiLabel: kpiLabel || null,
    qtyUnit,
    targetValueText,
    targetValueNumeric: parseNumericTarget(targetValueText),
    formFields: formFields || null,
    isActive,
    updatedBy: 'system',
  });

  revalidatePath('/admin/targets');
  revalidatePath('/executive');
  return result;
}

export async function seedDefaultAdminTargets(formData: FormData) {
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const periodMonth = String(formData.get('periodMonth') ?? '').trim();
  if (!reportingVersionId) throw new Error('Reporting version is required.');
  if (!periodMonth) throw new Error('Period month is required.');

  for (const item of DEFAULT_TARGET_SEED) {
    await upsertAdminTarget({
      reportingVersionId,
      periodMonth,
      area: item.area,
      kpiName: item.kpiName,
      kpiLabel: item.kpiName,
      qtyUnit: item.qtyUnit,
      targetValueText: item.targetValue,
      targetValueNumeric: parseNumericTarget(item.targetValue),
      isActive: true,
      updatedBy: 'seed',
    });
  }

  revalidatePath('/admin/targets');
  revalidatePath('/executive');
  return { ok: true as const, seeded: DEFAULT_TARGET_SEED.length };
}

export async function removeAdminTarget(formData: FormData) {
  const targetId = String(formData.get('targetId') ?? '').trim();
  if (!targetId) throw new Error('targetId is required.');

  const result = await deleteAdminTarget(targetId);
  revalidatePath('/admin/targets');
  revalidatePath('/executive');
  return result;
}

export async function cloneAdminTargetsFromVersion(formData: FormData) {
  const sourceReportingVersionId = String(formData.get('sourceReportingVersionId') ?? '').trim();
  const sourcePeriodMonth = String(formData.get('sourcePeriodMonth') ?? '').trim();
  const targetReportingVersionId = String(formData.get('targetReportingVersionId') ?? '').trim();
  const targetPeriodMonth = String(formData.get('targetPeriodMonth') ?? '').trim();

  if (!sourceReportingVersionId) throw new Error('Source reporting version is required.');
  if (!sourcePeriodMonth) throw new Error('Source period month is required.');
  if (!targetReportingVersionId) throw new Error('Target reporting version is required.');
  if (!targetPeriodMonth) throw new Error('Target period month is required.');
  if (sourceReportingVersionId === targetReportingVersionId) {
    throw new Error('Source and target versions must be different.');
  }

  const sourceRows = await getAdminTargets(undefined, sourceReportingVersionId, sourcePeriodMonth);
  if (sourceRows.length === 0) {
    return { ok: true as const, copied: 0 };
  }

  for (const row of sourceRows) {
    await upsertAdminTarget({
      targetId: row.targetId,
      reportingVersionId: targetReportingVersionId,
      periodMonth: targetPeriodMonth,
      area: row.area,
      kpiName: row.kpiName,
      kpiLabel: row.kpiLabel ?? row.kpiName,
      qtyUnit: row.qtyUnit,
      targetValueText: row.targetValueText,
      targetValueNumeric: row.targetValueNumeric,
      formFields: row.formFields,
      isActive: row.isActive,
      updatedBy: 'clone',
    });
  }

  revalidatePath('/admin/targets');
  revalidatePath('/executive');
  return { ok: true as const, copied: sourceRows.length };
}
