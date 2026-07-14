'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { seedDefaultModules, setModuleActive, upsertModule } from '@/lib/data/modules';

function revalidateModulePaths() {
  revalidatePath('/admin/modules');
  revalidatePath('/admin/uploads');
  revalidatePath('/admin');
}

export async function saveModule(formData: FormData) {
  const displayOrderRaw = String(formData.get('displayOrder') ?? '').trim();
  const displayOrder = displayOrderRaw ? Number(displayOrderRaw) : undefined;

  await upsertModule({
    moduleCode: String(formData.get('moduleCode') ?? ''),
    moduleName: String(formData.get('moduleName') ?? ''),
    areaCode: String(formData.get('areaCode') ?? ''),
    moduleType: String(formData.get('moduleType') ?? ''),
    sourcePeriodOffsetMonths: Number(formData.get('sourcePeriodOffsetMonths') ?? 0),
    ownerName: String(formData.get('ownerName') ?? ''),
    emailOwner: String(formData.get('emailOwner') ?? ''),
    displayOrder: Number.isFinite(displayOrder) ? displayOrder : undefined,
    isActive: String(formData.get('isActive') ?? 'true') === 'true',
    notes: String(formData.get('notes') ?? ''),
    updatedBy: String(formData.get('updatedBy') ?? 'admin_panel'),
  });

  revalidateModulePaths();
  return { ok: true as const };
}

export async function disableModule(formData: FormData) {
  await setModuleActive(String(formData.get('moduleCode') ?? ''), false);
  revalidateModulePaths();
  return { ok: true as const };
}

export async function enableModule(formData: FormData) {
  await setModuleActive(String(formData.get('moduleCode') ?? ''), true);
  revalidateModulePaths();
  return { ok: true as const };
}

export async function syncDefaultModules() {
  const result = await seedDefaultModules();
  revalidateModulePaths();
  return result;
}
