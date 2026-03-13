'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { saveGob360ProductMapping } from '@/app/admin/products/actions';
import type {
  DimProductOption,
  Gob360ProductMappingRow,
  Gob360UnmappedClaveRow,
} from '@/lib/data/products/product-metadata';

type Gob360ProductMappingProps = {
  unmappedRows: Gob360UnmappedClaveRow[];
  mappedRows: Gob360ProductMappingRow[];
  productOptions: DimProductOption[];
  marketGroupOptions: string[];
};

export function Gob360ProductMapping({
  unmappedRows,
  mappedRows,
  productOptions,
  marketGroupOptions,
}: Gob360ProductMappingProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState('');
  const [selectedBySource, setSelectedBySource] = useState<Record<string, string>>({});
  const [selectedMarketBySource, setSelectedMarketBySource] = useState<Record<string, string>>({});
  const [addingMarketBySource, setAddingMarketBySource] = useState<Record<string, boolean>>({});
  const [newMarketBySource, setNewMarketBySource] = useState<Record<string, string>>({});
  const [localMarketGroups, setLocalMarketGroups] = useState<string[]>(marketGroupOptions);
  const [editMappedBySource, setEditMappedBySource] = useState<Record<string, boolean>>({});
  const [mappedProductBySource, setMappedProductBySource] = useState<Record<string, string>>({});
  const [mappedMarketBySource, setMappedMarketBySource] = useState<Record<string, string>>({});
  const [showUnmapped, setShowUnmapped] = useState(false);

  if (unmappedRows.length === 0 && mappedRows.length === 0) {
    return (
      <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <p className="text-sm text-slate-600">No GOB360 keys detected yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Current mappings</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">GOB360 CLAVE</th>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">product_id</th>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">Canonical name</th>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">Market group</th>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {mappedRows.slice(0, 180).map((row) => {
                const key = row.sourceClaveNormalized;
                const editing = Boolean(editMappedBySource[key]);
                const selectedProduct = mappedProductBySource[key] ?? (row.productId ?? '');
                const selectedMarket = mappedMarketBySource[key] ?? (row.marketGroup ?? '');
                return (
                  <tr key={`${row.sourceClaveNormalized}-${row.productId ?? 'no-product'}`} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-sm text-slate-800">{row.sourceClave}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {editing ? (
                        <select
                          value={selectedProduct}
                          onChange={(e) =>
                            setMappedProductBySource((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          className="w-full min-w-[260px] rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                        >
                          <option value="">Select product...</option>
                          {productOptions.map((option) => (
                            <option key={option.productId} value={option.productId}>
                              {option.canonicalProductName} ({option.canonicalProductCode}) [{option.productId}]
                            </option>
                          ))}
                        </select>
                      ) : (
                        row.productId ?? '-'
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">{row.canonicalProductName ?? '-'}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      {editing ? (
                        <select
                          value={selectedMarket}
                          onChange={(e) =>
                            setMappedMarketBySource((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          className="w-full min-w-[180px] rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                        >
                          <option value="">No market group</option>
                          {localMarketGroups.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        row.marketGroup ?? '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {!editing ? (
                        <button
                          type="button"
                          onClick={() => setEditMappedBySource((prev) => ({ ...prev, [key]: true }))}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              startTransition(async () => {
                                try {
                                  const payload = new FormData();
                                  payload.set('sourceClave', row.sourceClave);
                                  payload.set('productId', selectedProduct);
                                  payload.set('marketGroup', selectedMarket);
                                  payload.set('isActive', 'true');
                                  payload.set('createdBy', 'system');
                                  payload.set('updatedBy', 'system');
                                  await saveGob360ProductMapping(payload);
                                  setFeedback(`Mapping updated: "${row.sourceClave}".`);
                                  setEditMappedBySource((prev) => ({ ...prev, [key]: false }));
                                  router.refresh();
                                } catch (error) {
                                  setFeedback(error instanceof Error ? error.message : 'Unable to update GOB360 mapping.');
                                }
                              });
                            }}
                            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {isPending ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditMappedBySource((prev) => ({ ...prev, [key]: false }))}
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {mappedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-sm text-slate-600">No mappings registered yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <button
          type="button"
          onClick={() => setShowUnmapped((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-slate-200 bg-slate-50/70 px-3 py-2 text-left"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">GOB360 Mapping</p>
            <p className="mt-1 text-sm font-medium text-slate-900">Unmapped GOB360 CLAVEs ({unmappedRows.length})</p>
          </div>
          <span className="text-slate-600">
            {showUnmapped ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </button>

        {feedback ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{feedback}</p>
        ) : null}

        {showUnmapped ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">GOB360 CLAVE</th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">Occurrences</th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">Map to product_id</th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">Market group</th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {unmappedRows.map((row) => {
                  const selected = selectedBySource[row.sourceClave] ?? '';
                  const selectedMarket = selectedMarketBySource[row.sourceClave] ?? '';
                  const canSave = Boolean(selected || selectedMarket);
                  return (
                    <tr key={`${row.sourceClaveNormalized}-${row.sourceClave}`} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-sm text-slate-800">{row.sourceClave}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.occurrences.toLocaleString('en-US')}</td>
                      <td className="px-3 py-2">
                        <select
                          value={selected}
                          onChange={(e) =>
                            setSelectedBySource((prev) => ({ ...prev, [row.sourceClave]: e.target.value }))
                          }
                          className="w-full min-w-[320px] rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                        >
                          <option value="">Select product...</option>
                          {productOptions.map((option) => (
                            <option key={option.productId} value={option.productId}>
                              {option.canonicalProductName} ({option.canonicalProductCode}) [{option.productId}]
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex min-w-[250px] items-center gap-2">
                          <select
                            value={selectedMarket}
                            onChange={(e) =>
                              setSelectedMarketBySource((prev) => ({ ...prev, [row.sourceClave]: e.target.value }))
                            }
                            className="w-full rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                          >
                            <option value="">Select market group...</option>
                            {localMarketGroups.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setAddingMarketBySource((prev) => ({ ...prev, [row.sourceClave]: !prev[row.sourceClave] }))
                            }
                            className="rounded-full border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            +
                          </button>
                        </div>
                        {addingMarketBySource[row.sourceClave] ? (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              value={newMarketBySource[row.sourceClave] ?? ''}
                              onChange={(e) =>
                                setNewMarketBySource((prev) => ({ ...prev, [row.sourceClave]: e.target.value }))
                              }
                              placeholder="New market group..."
                              className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newMarket = (newMarketBySource[row.sourceClave] ?? '').trim();
                                if (!newMarket) return;
                                if (!localMarketGroups.includes(newMarket)) {
                                  setLocalMarketGroups((prev) => [...prev, newMarket].sort((a, b) => a.localeCompare(b)));
                                }
                                setSelectedMarketBySource((prev) => ({ ...prev, [row.sourceClave]: newMarket }));
                                setAddingMarketBySource((prev) => ({ ...prev, [row.sourceClave]: false }));
                                setNewMarketBySource((prev) => ({ ...prev, [row.sourceClave]: '' }));
                              }}
                              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Add
                            </button>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={isPending || !canSave}
                          onClick={() => {
                            startTransition(async () => {
                              try {
                                const payload = new FormData();
                                payload.set('sourceClave', row.sourceClave);
                                payload.set('productId', selected);
                                payload.set('marketGroup', selectedMarket);
                                payload.set('isActive', 'true');
                                payload.set('createdBy', 'system');
                                payload.set('updatedBy', 'system');
                                await saveGob360ProductMapping(payload);
                                setFeedback(`Mapping saved: "${row.sourceClave}" -> ${selected}.`);
                                router.refresh();
                              } catch (error) {
                                setFeedback(error instanceof Error ? error.message : 'Unable to save GOB360 mapping.');
                              }
                            });
                          }}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {isPending ? 'Saving...' : 'Save mapping'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {unmappedRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-sm text-slate-600">All detected GOB360 keys are already mapped.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
