'use client';

import { useMemo, useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Edit3, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { moveProductMetadata, saveProductMetadata } from '@/app/admin/products/actions';
import type { ProductMetadataCoverageRow } from '@/lib/data/products/product-metadata';

type ProductMetadataCardsProps = {
  rows: ProductMetadataCoverageRow[];
  options: {
    brandNames: string[];
    subbrandOrDevices: string[];
    productGroups: string[];
    businessUnitCodes: string[];
    businessUnitNames: string[];
    portfolioNames: string[];
  };
};

type EditableFields = {
  productId: string;
  brandName: string;
  subbrandOrDevice: string;
  productGroup: string;
  businessUnitCode: string;
  businessUnitName: string;
  portfolioName: string;
  lifecycleStatus: string;
  isActive: boolean;
  notes: string;
};

type SelectWithAddProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onAdd: (value: string) => void;
};

const LIFECYCLE_OPTIONS = ['launch', 'growth', 'mature', 'phase_out'];

function SelectWithAdd({ label, value, options, onChange, onAdd }: SelectWithAddProps) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-[12px] border border-slate-200 bg-slate-50/90 px-3 py-2 text-sm"
        >
          <option value="">Seleccionar</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAdding((prev) => !prev)}
          className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
          title="Add new option"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {adding ? (
        <div className="flex items-center gap-2">
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="New option..."
            className="min-w-0 flex-1 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              const clean = newValue.trim();
              if (!clean) return;
              onAdd(clean);
              setNewValue('');
              setAdding(false);
            }}
            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            Agregar
          </button>
        </div>
      ) : null}
    </div>
  );
}

function getInitialForm(row: ProductMetadataCoverageRow): EditableFields {
  return {
    productId: row.productId,
    brandName: row.brandName ?? '',
    subbrandOrDevice: row.subbrandOrDevice ?? '',
    productGroup: row.productGroup ?? '',
    businessUnitCode: row.businessUnitCode ?? '',
    businessUnitName: row.businessUnitName ?? '',
    portfolioName: row.portfolioName ?? '',
    lifecycleStatus: row.lifecycleStatus ?? '',
    isActive: row.isActive ?? true,
    notes: row.notes ?? '',
  };
}

export function ProductMetadataCards({ rows, options }: ProductMetadataCardsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'all' | 'complete' | 'pending'>('complete');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [form, setForm] = useState<EditableFields | null>(null);

  const [localOptions, setLocalOptions] = useState(options);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const isComplete = row.completedRequiredFields >= row.requiredFieldsTotal;
      const byMode =
        mode === 'all' ? true : mode === 'complete' ? isComplete : !isComplete;
      if (!byMode) return false;

      if (!normalizedQuery) return true;
      return (
        row.productId.toLowerCase().includes(normalizedQuery) ||
        (row.canonicalProductName ?? '').toLowerCase().includes(normalizedQuery) ||
        (row.canonicalProductCode ?? '').toLowerCase().includes(normalizedQuery)
      );
    });
  }, [rows, mode, query]);

  const editingRow = editingProductId
    ? rows.find((row) => row.productId === editingProductId) ?? null
    : null;

  if (rows.length === 0) {
    return (
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-8 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
        <p className="text-sm text-slate-600">No se encontraron productos en dim_product.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product_id, code, or name..."
            className="min-w-[280px] flex-1 rounded-[14px] border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('pending')}
              className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                mode === 'pending'
                  ? 'bg-amber-100 text-amber-800'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setMode('complete')}
              className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                mode === 'complete'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              Completed
            </button>
            <button
              type="button"
              onClick={() => setMode('all')}
              className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                mode === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {message ? (
        <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        {filteredRows.map((row, index) => {
          const isComplete = row.completedRequiredFields >= row.requiredFieldsTotal;
          return (
            <article
              key={row.productId}
              className={`rounded-[22px] border p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] ${
                isComplete ? 'border-emerald-200/80 bg-emerald-50/30' : 'border-amber-200/80 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{row.productId}</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-950">
                    {row.canonicalProductName || '-'}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                      isComplete
                        ? 'border border-emerald-200/80 bg-emerald-50 text-emerald-700'
                        : 'border border-amber-200/80 bg-amber-50 text-amber-700'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {row.completedRequiredFields}/{row.requiredFieldsTotal}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingProductId(row.productId);
                      setForm(getInitialForm(row));
                    }}
                    className="rounded-full border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-50"
                    title="Editar"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-600">{row.canonicalProductCode || '-'}</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={isPending || index === 0}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await moveProductMetadata(row.productId, 'up');
                          router.refresh();
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : 'No se pudo reordenar.');
                        }
                      });
                    }}
                    className="rounded-full border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    title="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isPending || index === filteredRows.length - 1}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await moveProductMetadata(row.productId, 'down');
                          router.refresh();
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : 'No se pudo reordenar.');
                        }
                      });
                    }}
                    className="rounded-full border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    title="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {editingRow && form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{editingRow.productId}</p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                  {editingRow.canonicalProductName || '-'}
                </h3>
                <p className="mt-1 text-xs text-slate-600">{editingRow.canonicalProductCode || '-'}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingProductId(null);
                  setForm(null);
                }}
                className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <SelectWithAdd
                label="Brand"
                value={form.brandName}
                options={localOptions.brandNames}
                onChange={(value) => setForm((prev) => (prev ? { ...prev, brandName: value } : prev))}
                onAdd={(value) => {
                  setLocalOptions((prev) => ({
                    ...prev,
                    brandNames: [...new Set([...prev.brandNames, value])].sort(),
                  }));
                  setForm((prev) => (prev ? { ...prev, brandName: value } : prev));
                }}
              />

              <SelectWithAdd
                label="Subbrand or Device"
                value={form.subbrandOrDevice}
                options={localOptions.subbrandOrDevices}
                onChange={(value) => setForm((prev) => (prev ? { ...prev, subbrandOrDevice: value } : prev))}
                onAdd={(value) => {
                  setLocalOptions((prev) => ({
                    ...prev,
                    subbrandOrDevices: [...new Set([...prev.subbrandOrDevices, value])].sort(),
                  }));
                  setForm((prev) => (prev ? { ...prev, subbrandOrDevice: value } : prev));
                }}
              />

              <SelectWithAdd
                label="Product Group"
                value={form.productGroup}
                options={localOptions.productGroups}
                onChange={(value) => setForm((prev) => (prev ? { ...prev, productGroup: value } : prev))}
                onAdd={(value) => {
                  setLocalOptions((prev) => ({
                    ...prev,
                    productGroups: [...new Set([...prev.productGroups, value])].sort(),
                  }));
                  setForm((prev) => (prev ? { ...prev, productGroup: value } : prev));
                }}
              />

              <SelectWithAdd
                label="BU Code"
                value={form.businessUnitCode}
                options={localOptions.businessUnitCodes}
                onChange={(value) => setForm((prev) => (prev ? { ...prev, businessUnitCode: value } : prev))}
                onAdd={(value) => {
                  setLocalOptions((prev) => ({
                    ...prev,
                    businessUnitCodes: [...new Set([...prev.businessUnitCodes, value])].sort(),
                  }));
                  setForm((prev) => (prev ? { ...prev, businessUnitCode: value } : prev));
                }}
              />

              <SelectWithAdd
                label="BU Name"
                value={form.businessUnitName}
                options={localOptions.businessUnitNames}
                onChange={(value) => setForm((prev) => (prev ? { ...prev, businessUnitName: value } : prev))}
                onAdd={(value) => {
                  setLocalOptions((prev) => ({
                    ...prev,
                    businessUnitNames: [...new Set([...prev.businessUnitNames, value])].sort(),
                  }));
                  setForm((prev) => (prev ? { ...prev, businessUnitName: value } : prev));
                }}
              />

              <SelectWithAdd
                label="Portfolio"
                value={form.portfolioName}
                options={localOptions.portfolioNames}
                onChange={(value) => setForm((prev) => (prev ? { ...prev, portfolioName: value } : prev))}
                onAdd={(value) => {
                  setLocalOptions((prev) => ({
                    ...prev,
                    portfolioNames: [...new Set([...prev.portfolioNames, value])].sort(),
                  }));
                  setForm((prev) => (prev ? { ...prev, portfolioName: value } : prev));
                }}
              />

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Lifecycle</span>
                <select
                  value={form.lifecycleStatus}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, lifecycleStatus: e.target.value } : prev))}
                  className="rounded-[12px] border border-slate-200 bg-slate-50/90 px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar</option>
                  {LIFECYCLE_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 self-end rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, isActive: e.target.checked } : prev))}
                  className="h-4 w-4"
                />
                Is Active
              </label>

              <label className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                  rows={3}
                  className="rounded-[12px] border border-slate-200 bg-slate-50/90 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingProductId(null);
                  setForm(null);
                }}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const payload = new FormData();
                      payload.set('productId', form.productId);
                      payload.set('brandName', form.brandName);
                      payload.set('subbrandOrDevice', form.subbrandOrDevice);
                      payload.set('productGroup', form.productGroup);
                      payload.set('businessUnitCode', form.businessUnitCode);
                      payload.set('businessUnitName', form.businessUnitName);
                      payload.set('portfolioName', form.portfolioName);
                      payload.set('lifecycleStatus', form.lifecycleStatus);
                      payload.set('notes', form.notes);
                      payload.set('isActive', form.isActive ? 'true' : 'false');
                      payload.set('createdBy', 'system');
                      payload.set('updatedBy', 'system');

                      await saveProductMetadata(payload);
                      setMessage(`Metadata guardada para ${form.productId}.`);
                      setEditingProductId(null);
                      setForm(null);
                      router.refresh();
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : 'No se pudo guardar metadata.');
                    }
                  });
                }}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

