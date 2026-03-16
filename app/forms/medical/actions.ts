'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminTargets } from '@/lib/data/targets';
import { saveMedicalMonthlyInputs } from '@/lib/data/medical-forms';

function normalizeMonthToDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return trimmed;
}

function parseNumeric(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const parsed = Number(text.replace(/[$,%\s]/g, '').replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(raw: FormDataEntryValue | null) {
  return String(raw ?? '').trim();
}

function qtyUnitSupportsNumeric(qtyUnit: string) {
  const unit = qtyUnit.toLowerCase().trim();
  return (
    unit === 'count' ||
    unit === '%' ||
    unit === 'index' ||
    unit === 'days' ||
    unit === 'months' ||
    unit === 'units' ||
    unit === 'mxn'
  );
}

export async function submitMedicalForm(formData: FormData) {
  const periodMonth = normalizeMonthToDate(String(formData.get('periodMonth') ?? ''));
  const sourceAsOfMonth = normalizeMonthToDate(String(formData.get('sourceAsOfMonth') ?? '')) || periodMonth;
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const reportedBy = String(formData.get('reportedBy') ?? '').trim();

  if (!reportingVersionId) {
    throw new Error('Reporting version is required.');
  }
  if (!reportedBy) {
    throw new Error('Reported by is required.');
  }

  const targets = await getAdminTargets('medical', reportingVersionId, periodMonth);
  const rows = targets.map((target) => {
    const key = target.kpiName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const rawResult = formData.get(`${key}_result`);
    const resultValueNumeric = qtyUnitSupportsNumeric(target.qtyUnit) ? parseNumeric(rawResult) : null;
    const resultValueText = qtyUnitSupportsNumeric(target.qtyUnit) ? '' : normalizeText(rawResult);
    return {
      kpiName: target.kpiName,
      resultValueNumeric,
      resultValueText,
      comment: normalizeText(formData.get(`${key}_comment`)),
    };
  });

  const missingResults = rows.filter((row) => {
    const target = targets.find((item) => item.kpiName === row.kpiName);
    if (!target) return true;
    return qtyUnitSupportsNumeric(target.qtyUnit)
      ? row.resultValueNumeric == null
      : row.resultValueText.trim().length === 0;
  });
  if (missingResults.length > 0) {
    throw new Error(`Missing required results for ${missingResults.length} KPI(s).`);
  }

  await saveMedicalMonthlyInputs({
    periodMonth,
    sourceAsOfMonth,
    reportedBy,
    rows,
  });

  revalidatePath('/forms/medical');
  revalidatePath('/executive/medical');
  const params = new URLSearchParams();
  params.set('period', periodMonth);
  params.set('saved', String(rows.length));
  redirect(`/forms/medical/thank-you?${params.toString()}`);
}
