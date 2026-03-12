'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveProductMetadata } from '@/app/admin/products/actions';

export function ProductMetadataForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState('');

  function handleSubmit(formData: FormData) {
    setMessage('');
    startTransition(async () => {
      try {
        const result = await saveProductMetadata(formData);
        setMessage(`Metadata saved for product_id ${result.productId}.`);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Unable to save metadata.');
      }
    });
  }

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
      <form action={handleSubmit} className="grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Product ID</span>
          <input
            name="productId"
            required
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Brand Name</span>
          <input
            name="brandName"
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Subbrand or Device</span>
          <input
            name="subbrandOrDevice"
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Product Group</span>
          <input
            name="productGroup"
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">BU Code</span>
          <input
            name="businessUnitCode"
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">BU Name</span>
          <input
            name="businessUnitName"
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Portfolio</span>
          <input
            name="portfolioName"
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Lifecycle Status</span>
          <input
            name="lifecycleStatus"
            placeholder="active / discontinued / launch"
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Display Order</span>
          <input
            name="displayOrder"
            type="number"
            min={0}
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          />
        </label>

        <label className="flex flex-col gap-2 lg:col-span-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Notes</span>
          <textarea
            name="notes"
            rows={3}
            className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input name="isActive" type="checkbox" value="true" defaultChecked className="h-4 w-4" />
          Is Active
        </label>

        <input type="hidden" name="createdBy" value="system" />
        <input type="hidden" name="updatedBy" value="system" />

        <div className="lg:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save metadata'}
          </button>

          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </div>
      </form>
    </div>
  );
}
