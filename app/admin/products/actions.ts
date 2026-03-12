'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { reorderProductMetadata, upsertProductMetadata } from '@/lib/data/products/product-metadata';

export async function saveProductMetadata(formData: FormData) {
  const productId = String(formData.get('productId') ?? '');
  const brandName = String(formData.get('brandName') ?? '');
  const subbrandOrDevice = String(formData.get('subbrandOrDevice') ?? '');
  const productGroup = String(formData.get('productGroup') ?? '');
  const businessUnitCode = String(formData.get('businessUnitCode') ?? '');
  const businessUnitName = String(formData.get('businessUnitName') ?? '');
  const portfolioName = String(formData.get('portfolioName') ?? '');
  const lifecycleStatus = String(formData.get('lifecycleStatus') ?? '');
  const isActive = String(formData.get('isActive') ?? 'true') === 'true';
  const displayOrderRaw = String(formData.get('displayOrder') ?? '');
  const notes = String(formData.get('notes') ?? '');
  const createdBy = String(formData.get('createdBy') ?? 'system');
  const updatedBy = String(formData.get('updatedBy') ?? 'system');
  const displayOrder = displayOrderRaw ? Number(displayOrderRaw) : undefined;

  const result = await upsertProductMetadata({
    productId,
    brandName,
    subbrandOrDevice,
    productGroup,
    businessUnitCode,
    businessUnitName,
    portfolioName,
    lifecycleStatus,
    isActive,
    displayOrder: Number.isFinite(displayOrder) ? displayOrder : undefined,
    notes,
    createdBy,
    updatedBy,
  });

  revalidatePath('/admin/products');
  revalidatePath('/executive/sales-internal');

  return result;
}

export async function moveProductMetadata(productId: string, direction: 'up' | 'down') {
  if (!productId) {
    throw new Error('productId es obligatorio para reordenar.');
  }

  const result = await reorderProductMetadata(productId, direction);
  revalidatePath('/admin/products');
  revalidatePath('/executive/sales-internal');
  return result;
}
