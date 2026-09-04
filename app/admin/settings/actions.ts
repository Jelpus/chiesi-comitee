'use server';

import { revalidatePath } from 'next/cache';
import { updateAppSettings } from '@/lib/data/app-settings';

export async function saveAppSettings(formData: FormData) {
  await updateAppSettings({
    committeeResponsibleName: String(formData.get('committeeResponsibleName') ?? ''),
    committeeResponsibleEmail: String(formData.get('committeeResponsibleEmail') ?? ''),
    reminder1DaysBefore: Number(formData.get('reminder1DaysBefore')),
    reminder2DaysBefore: Number(formData.get('reminder2DaysBefore')),
    validationDaysBefore: Number(formData.get('validationDaysBefore')),
  });
  revalidatePath('/admin/settings');
  revalidatePath('/admin/planning');
  revalidatePath('/access');
  revalidatePath('/forms');
  return { ok: true as const };
}
