'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import type { OpexCecoGroupMappingRow } from '@/lib/data/opex-group-mapping';
import {
  removeOpexCecoGroupMapping,
  saveOpexCecoGroupMapping,
  seedOpexCecoGroupMapping,
} from '@/app/admin/opex-groups/actions';

type OpexCecoGroupManagerProps = {
  rows: OpexCecoGroupMappingRow[];
};

export function OpexCecoGroupManager({ rows }: OpexCecoGroupManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState('');

  function runAction(task: () => Promise<unknown>, success: string) {
    setMessage('');
    startTransition(async () => {
      try {
        await task();
        setMessage(success);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Action failed.');
      }
    });
  }

  return (
    <div className="space-y-4">
      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-end gap-3">
          <form
            action={(formData) => runAction(() => saveOpexCecoGroupMapping(formData), 'Mapping saved.')}
            className="grid min-w-[640px] flex-1 gap-2 md:grid-cols-[1.5fr_1fr_auto]"
          >
            <input
              name="cecoName"
              placeholder="CeCo Name"
              className="rounded-[12px] border border-slate-200 px-3 py-2 text-sm text-slate-900"
              required
            />
            <input
              name="cecoNameGroup"
              placeholder="CeCo Name Group"
              className="rounded-[12px] border border-slate-200 px-3 py-2 text-sm text-slate-900"
              required
            />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white disabled:opacity-50"
            >
              {isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </span>
              ) : (
                'Save Mapping'
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => runAction(() => seedOpexCecoGroupMapping(), 'Default seed synced.')}
            disabled={isPending}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 disabled:opacity-50"
          >
            Sync Seed
          </button>
        </div>
      </article>

      <article className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <th className="px-4 py-3">CeCo Name</th>
                <th className="px-4 py-3">CeCo Group</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.mappingId || row.cecoName}>
                  <td className="px-4 py-3 align-top">
                    <input
                      name="cecoName"
                      form={`opex-map-edit-${row.mappingId || row.cecoName}`}
                      defaultValue={row.cecoName}
                      className="w-[320px] rounded-[10px] border border-slate-200 px-2 py-1.5 text-xs text-slate-900"
                      required
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      name="cecoNameGroup"
                      form={`opex-map-edit-${row.mappingId || row.cecoName}`}
                      defaultValue={row.cecoNameGroup}
                      className="w-[240px] rounded-[10px] border border-slate-200 px-2 py-1.5 text-xs text-slate-900"
                      required
                    />
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-slate-600">
                    {row.updatedAt ?? 'N/A'}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <form
                        id={`opex-map-edit-${row.mappingId || row.cecoName}`}
                        action={(formData) => runAction(() => saveOpexCecoGroupMapping(formData), 'Mapping updated.')}
                      >
                        <button
                          type="submit"
                          disabled={isPending}
                          className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white disabled:opacity-50"
                        >
                          Save
                        </button>
                      </form>
                      <form
                        action={(formData) => runAction(() => removeOpexCecoGroupMapping(formData), 'Mapping removed.')}
                      >
                        <input type="hidden" name="cecoName" value={row.cecoName} />
                        <button
                          type="submit"
                          disabled={isPending}
                          className="rounded-full border border-rose-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-700 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={4}>
                    No mappings yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      {message ? (
        <p className="text-sm font-medium text-slate-700">{message}</p>
      ) : null}
    </div>
  );
}
