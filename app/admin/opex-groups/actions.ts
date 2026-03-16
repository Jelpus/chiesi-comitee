'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import {
  disableOpexCecoGroupMapping,
  seedDefaultOpexCecoGroupMappings,
  upsertOpexCecoGroupMapping,
} from '@/lib/data/opex-group-mapping';

export async function saveOpexCecoGroupMapping(formData: FormData) {
  const cecoName = String(formData.get('cecoName') ?? '').trim();
  const cecoNameGroup = String(formData.get('cecoNameGroup') ?? '').trim();

  await upsertOpexCecoGroupMapping({
    cecoName,
    cecoNameGroup,
    updatedBy: 'system',
  });

  revalidatePath('/admin/opex-groups');
  revalidatePath('/executive/opex');
  return { ok: true as const };
}

export async function removeOpexCecoGroupMapping(formData: FormData) {
  const cecoName = String(formData.get('cecoName') ?? '').trim();
  await disableOpexCecoGroupMapping({
    cecoName,
    updatedBy: 'system',
  });
  revalidatePath('/admin/opex-groups');
  revalidatePath('/executive/opex');
  return { ok: true as const };
}

export async function seedOpexCecoGroupMapping() {
  const result = await seedDefaultOpexCecoGroupMappings();
  revalidatePath('/admin/opex-groups');
  revalidatePath('/executive/opex');
  return result;
}
