'use client';

import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import type { MedicalInputRow, MedicalTargetRow } from '@/lib/data/medical-forms-schema';
import { submitMedicalForm } from '@/app/forms/medical/actions';

type MedicalFormProps = {
  defaultPeriodMonth: string;
  defaultSourceAsOfMonth: string;
  reportingVersionId: string;
  targets: MedicalTargetRow[];
  rows: MedicalInputRow[];
};

function toMonthValue(value: string) {
  return value?.slice(0, 7) ?? '';
}

function toInputValue(value: number | null | undefined) {
  return value == null ? '' : String(value);
}

function qtyUnitSupportsNumeric(qtyUnit: string) {
  const unit = qtyUnit.toLowerCase().trim();
  return (
    unit === 'count' ||
    unit === '%' ||
    unit === 'index' ||
    unit === 'days' ||
    unit === 'months' ||
    unit === 'units' ||
    unit === 'mxn'
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-60"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving, please wait...
        </span>
      ) : (
        'Save Submission'
      )}
    </button>
  );
}

function PendingOverlay() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="sticky top-2 z-20 mb-3 rounded-[12px] border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-sm">
      Saving submission... do not close this page.
    </div>
  );
}

export function MedicalForm({
  defaultPeriodMonth,
  defaultSourceAsOfMonth,
  reportingVersionId,
  targets,
  rows,
}: MedicalFormProps) {
  const byKpi = new Map(rows.map((row) => [row.kpiName.toLowerCase().trim(), row]));

  return (
    <form action={submitMedicalForm} className="space-y-4">
      <input type="hidden" name="reportingVersionId" value={reportingVersionId} />
      <PendingOverlay />
      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Period Month</span>
            <input
              name="periodMonth"
              type="month"
              defaultValue={toMonthValue(defaultPeriodMonth)}
              required
              className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Source As Of</span>
            <input
              name="sourceAsOfMonth"
              type="month"
              defaultValue={toMonthValue(defaultSourceAsOfMonth)}
              required
              className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Reported By</span>
            <input
              name="reportedBy"
              type="text"
              placeholder="Name or team"
              required
              className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </article>

      {targets.map((target) => {
        const row = byKpi.get(target.kpiName.toLowerCase().trim());
        const key = target.kpiName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const numeric = qtyUnitSupportsNumeric(target.qtyUnit);
        return (
          <article key={target.targetId} className="rounded-[18px] border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{target.kpiLabel}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Objective</span>
                <p className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  {target.objectiveValueText || 'N/A'}
                </p>
              </div>
              <label className="space-y-1 md:col-span-2">
                <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Result ({target.qtyUnit})</span>
                {numeric ? (
                  <input
                    name={`${key}_result`}
                    type="number"
                    step={target.qtyUnit === '%' || target.qtyUnit.toLowerCase() === 'index' ? '0.1' : '1'}
                    defaultValue={toInputValue(row?.resultValueNumeric)}
                    required
                    className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
                  />
                ) : (
                  <input
                    name={`${key}_result`}
                    type="text"
                    defaultValue={row?.resultValueText ?? ''}
                    required
                    className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
                  />
                )}
              </label>
            </div>
            <label className="mt-3 block space-y-1">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Comment</span>
              <textarea
                name={`${key}_comment`}
                defaultValue={row?.comment ?? ''}
                rows={2}
                className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </article>
        );
      })}

      <div className="flex items-center gap-3">
        <SubmitButton />
      </div>
    </form>
  );
}
