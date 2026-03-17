'use server';

import { revalidatePath } from 'next/cache';
import { saveAdminHomeStatusSnapshot } from '@/lib/data/admin-home-status';
import { syncExecutiveHomeQuerySnapshot } from '@/lib/data/excecutive/sync-executive-home-query-snapshot';
import { syncExecutiveInsightsPreReadSnapshot } from '@/lib/data/excecutive/sync-executive-insights-preread-snapshot';

export type AdminActionState = {
  ok: boolean;
  message: string;
  completedAt: string | null;
};

export async function saveHomeStatusAction(formData: FormData) {
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const periodMonth = String(formData.get('periodMonth') ?? '').trim();
  if (!reportingVersionId || !periodMonth) {
    throw new Error('Missing reportingVersionId or periodMonth.');
  }

  await saveAdminHomeStatusSnapshot({
    reportingVersionId,
    periodMonth,
    createdBy: 'admin_panel',
  });
  await syncExecutiveHomeQuerySnapshot(reportingVersionId);

  revalidatePath('/admin');
}

export async function saveExecutivePreReadAction(formData: FormData) {
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const periodMonth = String(formData.get('periodMonth') ?? '').trim();
  if (!reportingVersionId || !periodMonth) {
    throw new Error('Missing reportingVersionId or periodMonth.');
  }

  await syncExecutiveInsightsPreReadSnapshot({
    reportingVersionId,
    periodMonth,
  });

  revalidatePath('/admin');
}

export async function saveHomeStatusActionState(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await saveHomeStatusAction(formData);
  return {
    ok: true,
    message: 'Ready',
    completedAt: new Date().toISOString(),
  };
}

export async function saveExecutivePreReadActionState(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await saveExecutivePreReadAction(formData);
  return {
    ok: true,
    message: 'Ready',
    completedAt: new Date().toISOString(),
  };
}
