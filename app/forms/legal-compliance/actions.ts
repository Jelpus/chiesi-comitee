'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminTargets, upsertAdminTarget } from '@/lib/data/targets';
import { LEGAL_COMPLIANCE_KPIS } from '@/lib/data/legal-compliance-forms-schema';
import { saveLegalComplianceMonthlyInputs } from '@/lib/data/legal-compliance-forms';

function parseNumericTarget(rawValue: string): number | null {
  const raw = rawValue.trim();
  if (!raw) return null;
  const sanitized = raw.replace(/[%,$\s]/g, '').replace(/,/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCount(rawValue: FormDataEntryValue | null): number | null {
  if (rawValue == null) return null;
  const raw = String(rawValue).trim();
  if (!raw) return null;
  const parsed = Number(raw.replace(/[$,%\s]/g, '').replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMonthToDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return trimmed;
}

export async function submitLegalComplianceForm(formData: FormData) {
  const periodMonth = normalizeMonthToDate(String(formData.get('periodMonth') ?? ''));
  const sourceAsOfMonth = normalizeMonthToDate(String(formData.get('sourceAsOfMonth') ?? '')) || periodMonth;
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const reportedBy = String(formData.get('reportedBy') ?? '').trim();
  if (!reportedBy) {
    throw new Error('Reported by is required.');
  }
  const targets = reportingVersionId
    ? await getAdminTargets('legal_compliance', reportingVersionId, periodMonth)
    : [];
  const objectiveByKpi = new Map(
    targets.map((target) => [target.kpiName.toLowerCase().trim(), target.targetValueNumeric]),
  );

  const kpis = LEGAL_COMPLIANCE_KPIS.map((kpiName) => {
    const key = kpiName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return {
      kpiName,
      objectiveCount: objectiveByKpi.get(kpiName.toLowerCase().trim()) ?? null,
      currentCount: parseCount(formData.get(`${key}_current_count`)),
      activeCount: parseCount(formData.get(`${key}_active_count`)),
      additionalAmountMxn: parseCount(formData.get(`${key}_additional_amount_mxn`)),
      comment: String(formData.get(`${key}_comment`) ?? '').trim(),
    };
  });

  const missingCore = kpis.filter((item) => item.currentCount == null || item.activeCount == null);
  if (missingCore.length > 0) {
    throw new Error(`Missing required counts for ${missingCore.length} KPI(s).`);
  }

  const lawsuits = kpis.find((item) => item.kpiName.toLowerCase().includes('juicios'));
  if (lawsuits && ((lawsuits.currentCount ?? 0) + (lawsuits.activeCount ?? 0) > 0) && lawsuits.additionalAmountMxn == null) {
    throw new Error('Contingent liability amount is required when lawsuits are active/current.');
  }

  await saveLegalComplianceMonthlyInputs({
    periodMonth,
    sourceAsOfMonth,
    reportedBy,
    kpis,
  });

  revalidatePath('/forms/legal-compliance');
  revalidatePath('/executive/legal-compliance');
  const params = new URLSearchParams();
  params.set('period', periodMonth);
  params.set('saved', String(kpis.length));
  redirect(`/forms/legal-compliance/thank-you?${params.toString()}`);
}

const LEGAL_TARGET_SEED = [
  { kpiName: '# de juicios contra Chiesi', targetValueText: '0', qtyUnit: 'Count' },
  { kpiName: '% Proveedores Contratos firmados con proveedores (80/20)', targetValueText: '51', qtyUnit: 'Count' },
  { kpiName: '# Contratos actualizados Speakers AIR', targetValueText: '25', qtyUnit: 'Count' },
  { kpiName: '# Contratos actualizados Speakers CARE', targetValueText: '17', qtyUnit: 'Count' },
] as const;

export async function seedLegalComplianceBaseline(formData: FormData) {
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const periodMonth = String(formData.get('periodMonth') ?? '').trim();
  const sourceAsOfMonth = String(formData.get('sourceAsOfMonth') ?? '').trim() || periodMonth;
  if (!reportingVersionId) throw new Error('Reporting version is required.');
  if (!periodMonth) throw new Error('Period month is required.');

  const existingTargets = await getAdminTargets('legal_compliance', reportingVersionId, periodMonth);
  const existingByName = new Map(existingTargets.map((item) => [item.kpiName.toLowerCase().trim(), item]));

  for (const item of LEGAL_TARGET_SEED) {
    const key = item.kpiName.toLowerCase().trim();
    const existing = existingByName.get(key);
    const nextNumeric = parseNumericTarget(item.targetValueText);
    const unchanged =
      existing &&
      existing.qtyUnit === item.qtyUnit &&
      existing.targetValueText === item.targetValueText &&
      (existing.targetValueNumeric ?? null) === (nextNumeric ?? null) &&
      existing.isActive;

    if (unchanged) continue;

    await upsertAdminTarget({
      targetId: existing?.targetId,
      reportingVersionId,
      periodMonth,
      area: 'legal_compliance',
      kpiName: item.kpiName,
      kpiLabel: item.kpiName,
      qtyUnit: item.qtyUnit,
      targetValueText: item.targetValueText,
      targetValueNumeric: nextNumeric,
      isActive: true,
      updatedBy: 'seed',
    });
  }

  await saveLegalComplianceMonthlyInputs({
    periodMonth,
    sourceAsOfMonth,
    reportedBy: 'seed',
    kpis: [
      {
        kpiName: '# de juicios contra Chiesi',
        objectiveCount: 0,
        currentCount: 0,
        activeCount: 0,
        additionalAmountMxn: null,
        comment: '',
      },
      {
        kpiName: '% Proveedores Contratos firmados con proveedores (80/20)',
        objectiveCount: 51,
        currentCount: 39,
        activeCount: 0,
        additionalAmountMxn: null,
        comment: '',
      },
      {
        kpiName: '# Contratos actualizados Speakers AIR',
        objectiveCount: 25,
        currentCount: 13,
        activeCount: 1,
        additionalAmountMxn: null,
        comment: '',
      },
      {
        kpiName: '# Contratos actualizados Speakers CARE',
        objectiveCount: 17,
        currentCount: 10,
        activeCount: 2,
        additionalAmountMxn: null,
        comment: '',
      },
    ],
  });

  revalidatePath('/forms/legal-compliance');
  revalidatePath('/admin/targets');
  revalidatePath('/executive/legal-compliance');
  return { ok: true as const, message: 'Legal baseline seed applied.' };
}
