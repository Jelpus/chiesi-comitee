'use server';

import { revalidatePath } from 'next/cache';
import { saveAdminHomeStatusSnapshot } from '@/lib/data/admin-home-status';
import { syncExecutiveHomeQuerySnapshot } from '@/lib/data/excecutive/sync-executive-home-query-snapshot';

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
