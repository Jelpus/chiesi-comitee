'use server';

import { revalidatePath } from 'next/cache';
import { processCommitteePlanning } from '@/lib/automation/process-committee-planning';
import { saveCommitteePlan, setCommitteePlanActive } from '@/lib/data/committee-planning';

function revalidatePlanning() {
  revalidatePath('/admin/planning');
  revalidatePath('/admin/versions');
}

export async function saveCommitteePlanAction(formData: FormData) {
  const result = await saveCommitteePlan({
    planningId: String(formData.get('planningId') ?? ''),
    periodMonth: String(formData.get('periodMonth') ?? ''),
    committeeDate: String(formData.get('committeeDate') ?? ''),
    reminder1Date: String(formData.get('reminder1Date') ?? ''),
    reminder2Date: String(formData.get('reminder2Date') ?? ''),
    validationDate: String(formData.get('validationDate') ?? ''),
    isActive: String(formData.get('isActive') ?? 'true') === 'true',
    notes: String(formData.get('notes') ?? ''),
  });
  revalidatePlanning();
  return { ok: true as const, ...result };
}

export async function setCommitteePlanActiveAction(formData: FormData) {
  await setCommitteePlanActive(
    String(formData.get('planningId') ?? ''),
    String(formData.get('isActive') ?? 'true') === 'true',
  );
  revalidatePlanning();
  return { ok: true as const };
}

export async function runPlanningAutomationAction() {
  const result = await processCommitteePlanning();
  revalidatePlanning();
  return result;
}
