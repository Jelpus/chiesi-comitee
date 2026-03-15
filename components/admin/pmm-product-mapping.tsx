'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { savePmmProductMapping } from '@/app/admin/products/actions';
import type {
  PmmProductMappingRow,
  PmmUnmappedProductRow,
  DimProductOption,
} from '@/lib/data/products/product-metadata';

type PmmProductMappingProps = {
  unmappedRows: PmmUnmappedProductRow[];
  mappedRows: PmmProductMappingRow[];
  productOptions: DimProductOption[];
  marketGroupOptions: string[];
};

export function PmmProductMapping({
  unmappedRows,
  mappedRows,
  productOptions,
  marketGroupOptions,
}: PmmProductMappingProps) {
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
  const [showMapped, setShowMapped] = useState(true);
  const [showUnmapped, setShowUnmapped] = useState(false);
  const [selectedUnmappedSources, setSelectedUnmappedSources] = useState<Record<string, boolean>>({});
  const [batchMarketGroup, setBatchMarketGroup] = useState('');
  const [showBatchMarketInput, setShowBatchMarketInput] = useState(false);
  const [newBatchMarketGroup, setNewBatchMarketGroup] = useState('');
  const [mappedMarketFilter, setMappedMarketFilter] = useState('');
  const totalOptions = mappedRows.length + unmappedRows.length;
  const filteredMappedRows = mappedRows.filter((row) =>
    mappedMarketFilter ? (row.marketGroup ?? '') === mappedMarketFilter : true,
  );

  const selectedUnmappedCount = unmappedRows.filter(
    (row) => selectedUnmappedSources[row.sourceProductName],
  ).length;
  const allVisibleUnmappedSelected =
    unmappedRows.length > 0 &&
    unmappedRows.every((row) => selectedUnmappedSources[row.sourceProductName]);

  function toggleUnmappedSelection(sourceProductName: string) {
    setSelectedUnmappedSources((prev) => ({
      ...prev,
      [sourceProductName]: !prev[sourceProductName],
    }));
  }

  function toggleAllVisibleUnmapped() {
    const nextValue = !allVisibleUnmappedSelected;
    setSelectedUnmappedSources((prev) => {
      const next = { ...prev };
      for (const row of unmappedRows) {
        next[row.sourceProductName] = nextValue;
      }
      return next;
    });
  }

  if (unmappedRows.length === 0 && mappedRows.length === 0) {
    return (
      <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <p className="text-sm text-slate-600">No DDD/Weekly products detected yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">DDD + Weekly Mapping Process</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-[18px] border border-emerald-200 bg-emerald-50/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-700">Mapped</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {mappedRows.length} <span className="text-base font-medium text-slate-500">from {totalOptions} total options</span>
            </p>
          </div>
          <div className="rounded-[18px] border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-amber-700">Remaining unmapped</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{unmappedRows.length}</p>
          </div>
        </div>

        {feedback ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {feedback}
          </p>
        ) : null}
      </div>

      <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <button
          type="button"
          onClick={() => setShowMapped((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-slate-200 bg-slate-50/70 px-3 py-2 text-left"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Mapped</p>
            <p className="mt-1 text-sm font-medium text-slate-900">Mapped DDD + Weekly Products ({mappedRows.length})</p>
          </div>
          <span className="text-slate-600">
            {showMapped ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </button>

        {showMapped ? (
          <div className="mt-4 space-y-4">
            <div className="flex max-w-[320px] flex-col gap-2">
              <label className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                Filter by market group
              </label>
              <select
                value={mappedMarketFilter}
                onChange={(e) => setMappedMarketFilter(e.target.value)}
                className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">All market groups</option>
                {localMarketGroups.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  Source product (PACK_DES)
                </th>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  product_id
                </th>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  Canonical name
                </th>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  Market group
                </th>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMappedRows.slice(0, 120).map((row) => {
                const key = row.sourceProductNameNormalized;
                const editing = Boolean(editMappedBySource[key]);
                const selectedProduct = mappedProductBySource[key] ?? (row.productId ?? '');
                const selectedMarket = mappedMarketBySource[key] ?? (row.marketGroup ?? '');

                return (
                  <tr
                    key={`${row.sourceProductNameNormalized}-${row.productId ?? 'no-product'}-${row.marketGroup ?? 'no-market'}`}
                    className="border-b border-slate-100"
                  >
                    <td className="px-3 py-2 text-sm text-slate-800">{row.sourceProductName}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {editing ? (
                        <select
                          value={selectedProduct}
                          onChange={(e) =>
                            setMappedProductBySource((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className="w-full min-w-[260px] rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                        >
                          <option value="">No product_id</option>
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
                            setMappedMarketBySource((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
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
                          onClick={() =>
                            setEditMappedBySource((prev) => ({
                              ...prev,
                              [key]: true,
                            }))
                          }
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
                                  payload.set('sourcePackDes', row.sourceProductName);
                                  payload.set('productId', selectedProduct);
                                  payload.set('marketGroup', selectedMarket);
                                  payload.set('isActive', 'true');
                                  payload.set('createdBy', 'system');
                                  payload.set('updatedBy', 'system');
                                  await savePmmProductMapping(payload);
                                  setFeedback(`Mapping updated: "${row.sourceProductName}".`);
                                  setEditMappedBySource((prev) => ({ ...prev, [key]: false }));
                                  router.refresh();
                                } catch (error) {
                                  setFeedback(
                                    error instanceof Error
                                      ? error.message
                                      : 'Unable to update DDD/Weekly mapping.',
                                  );
                                }
                              });
                            }}
                            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {isPending ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditMappedBySource((prev) => ({
                                ...prev,
                                [key]: false,
                              }))
                            }
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
              {filteredMappedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-sm text-slate-600">
                    {mappedRows.length === 0
                      ? 'No mappings registered yet.'
                      : 'No mapped DDD/Weekly products match the selected market group.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <button
          type="button"
          onClick={() => setShowUnmapped((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-slate-200 bg-slate-50/70 px-3 py-2 text-left"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">DDD + Weekly Mapping</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              Unmapped DDD + Weekly Products ({unmappedRows.length})
            </p>
          </div>
          <span className="text-slate-600">
            {showUnmapped ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </button>

        {showUnmapped ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Batch mapping</p>
                  <p className="mt-1 text-sm text-slate-700">
                    Select multiple unmapped DDD/Weekly products and assign the same market group in one step.
                  </p>
                </div>
                <div className="text-sm font-medium text-slate-800">
                  Selected: {selectedUnmappedCount}
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={allVisibleUnmappedSelected}
                    onChange={toggleAllVisibleUnmapped}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                  Select all visible
                </label>

                <div className="flex min-w-[280px] flex-1 items-center gap-2">
                  <select
                    value={batchMarketGroup}
                    onChange={(e) => setBatchMarketGroup(e.target.value)}
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
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
                    onClick={() => setShowBatchMarketInput((prev) => !prev)}
                    className="rounded-full border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  disabled={selectedUnmappedCount === 0 || !batchMarketGroup}
                  onClick={() => {
                    setSelectedMarketBySource((prev) => {
                      const next = { ...prev };
                      for (const row of unmappedRows) {
                        if (selectedUnmappedSources[row.sourceProductName]) {
                          next[row.sourceProductName] = batchMarketGroup;
                        }
                      }
                      return next;
                    });
                    setFeedback(
                      `Assigned market group "${batchMarketGroup}" to ${selectedUnmappedCount} selected DDD/Weekly products in the form.`,
                    );
                  }}
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Apply market to selected
                </button>

                <button
                  type="button"
                  disabled={isPending || selectedUnmappedCount === 0 || !batchMarketGroup}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        const selectedRows = unmappedRows.filter(
                          (row) => selectedUnmappedSources[row.sourceProductName],
                        );

                        await Promise.all(
                          selectedRows.map(async (row) => {
                            const payload = new FormData();
                            payload.set('sourcePackDes', row.sourceProductName);
                            payload.set(
                              'productId',
                              selectedBySource[row.sourceProductName] ?? '',
                            );
                            payload.set(
                              'marketGroup',
                              selectedMarketBySource[row.sourceProductName] || batchMarketGroup,
                            );
                            payload.set('isActive', 'true');
                            payload.set('createdBy', 'system');
                            payload.set('updatedBy', 'system');
                            await savePmmProductMapping(payload);
                          }),
                        );

                        setFeedback(
                          `Batch mapping saved for ${selectedRows.length} DDD/Weekly products with market group "${batchMarketGroup}".`,
                        );
                        setSelectedUnmappedSources({});
                        router.refresh();
                      } catch (error) {
                        setFeedback(
                          error instanceof Error
                            ? error.message
                            : 'Unable to save batch DDD/Weekly mapping.',
                        );
                      }
                    });
                  }}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                >
                  {isPending ? 'Saving batch...' : 'Save selected'}
                </button>
              </div>

              {showBatchMarketInput ? (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={newBatchMarketGroup}
                    onChange={(e) => setNewBatchMarketGroup(e.target.value)}
                    placeholder="New market group..."
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newMarket = newBatchMarketGroup.trim();
                      if (!newMarket) return;
                      setLocalMarketGroups((prev) =>
                        [...new Set([...prev, newMarket])].sort((a, b) =>
                          a.localeCompare(b, 'en', { sensitivity: 'base' }),
                        ),
                      );
                      setBatchMarketGroup(newMarket);
                      setShowBatchMarketInput(false);
                      setNewBatchMarketGroup('');
                    }}
                    className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Add
                  </button>
                </div>
              ) : null}
            </div>

            <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    Select
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    Source product (PACK_DES)
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    Occurrences
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    Map to product_id
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    Market group
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {unmappedRows.map((row) => {
                  const selected = selectedBySource[row.sourceProductName] ?? '';
                  const selectedMarket = selectedMarketBySource[row.sourceProductName] ?? '';
                  const canSave = Boolean(selected || selectedMarket);
                  return (
                    <tr key={`${row.sourceProductNameNormalized}-${row.sourceProductName}`} className="border-b border-slate-100">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedUnmappedSources[row.sourceProductName])}
                          onChange={() => toggleUnmappedSelection(row.sourceProductName)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                        />
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-800">{row.sourceProductName}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.occurrences.toLocaleString('en-US')}</td>
                      <td className="px-3 py-2">
                        <select
                          value={selected}
                          onChange={(e) =>
                            setSelectedBySource((prev) => ({
                              ...prev,
                              [row.sourceProductName]: e.target.value,
                            }))
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
                              setSelectedMarketBySource((prev) => ({
                                ...prev,
                                [row.sourceProductName]: e.target.value,
                              }))
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
                              setAddingMarketBySource((prev) => ({
                                ...prev,
                                [row.sourceProductName]: !prev[row.sourceProductName],
                              }))
                            }
                            className="rounded-full border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            +
                          </button>
                        </div>
                        {addingMarketBySource[row.sourceProductName] ? (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              value={newMarketBySource[row.sourceProductName] ?? ''}
                              onChange={(e) =>
                                setNewMarketBySource((prev) => ({
                                  ...prev,
                                  [row.sourceProductName]: e.target.value,
                                }))
                              }
                              placeholder="New market group..."
                              className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newMarket = (newMarketBySource[row.sourceProductName] ?? '').trim();
                                if (!newMarket) return;
                                setLocalMarketGroups((prev) =>
                                  [...new Set([...prev, newMarket])].sort((a, b) =>
                                    a.localeCompare(b, 'en', { sensitivity: 'base' }),
                                  ),
                                );
                                setSelectedMarketBySource((prev) => ({
                                  ...prev,
                                  [row.sourceProductName]: newMarket,
                                }));
                                setAddingMarketBySource((prev) => ({
                                  ...prev,
                                  [row.sourceProductName]: false,
                                }));
                                setNewMarketBySource((prev) => ({
                                  ...prev,
                                  [row.sourceProductName]: '',
                                }));
                              }}
                              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
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
                                payload.set('sourcePackDes', row.sourceProductName);
                                payload.set('productId', selected);
                                payload.set('marketGroup', selectedMarket);
                                payload.set('isActive', 'true');
                                payload.set('createdBy', 'system');
                                payload.set('updatedBy', 'system');
                                await savePmmProductMapping(payload);
                                setFeedback(
                                  `Mapping saved: "${row.sourceProductName}" -> ${selected || 'no product_id'} (${selectedMarket || 'no market group'}).`,
                                );
                                router.refresh();
                              } catch (error) {
                                setFeedback(
                                  error instanceof Error
                                    ? error.message
                                    : 'Unable to save DDD/Weekly mapping.',
                                );
                              }
                            });
                          }}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          {isPending ? 'Saving...' : 'Save mapping'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {unmappedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-sm text-slate-600">
                      All detected DDD/Weekly products are already mapped.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}




