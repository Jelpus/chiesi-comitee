'use client';

import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import type {
  LegalComplianceAnswerField,
  LegalComplianceKpiName,
  LegalComplianceMonthlyInputRow,
} from '@/lib/data/legal-compliance-forms-schema';
import { LEGAL_COMPLIANCE_KPIS, LEGAL_COMPLIANCE_KPI_FIELDS } from '@/lib/data/legal-compliance-forms-schema';
import { submitLegalComplianceForm } from '@/app/forms/legal-compliance/actions';

type LegalComplianceFormProps = {
  defaultPeriodMonth: string;
  defaultSourceAsOfMonth: string;
  reportingVersionId: string;
  objectiveByKpi: Record<string, number | null>;
  answerFieldsByKpi?: Partial<Record<LegalComplianceKpiName, ReadonlyArray<LegalComplianceAnswerField>>>;
  rows: LegalComplianceMonthlyInputRow[];
};

function kpiKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function toInputValue(value: number | null | undefined) {
  return value == null ? '' : String(value);
}

function toMonthValue(value: string) {
  return value?.slice(0, 7) ?? '';
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

export function LegalComplianceForm({
  defaultPeriodMonth,
  defaultSourceAsOfMonth,
  reportingVersionId,
  objectiveByKpi,
  answerFieldsByKpi = {},
  rows,
}: LegalComplianceFormProps) {
  const byKpi = new Map(rows.map((row) => [row.kpiName.toLowerCase().trim(), row]));

  return (
    <form action={submitLegalComplianceForm} className="space-y-4">
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

      {LEGAL_COMPLIANCE_KPIS.map((kpiName) => {
        const key = kpiKey(kpiName);
        const row = byKpi.get(kpiName.toLowerCase());
        const isLawsuitKpi = kpiName.toLowerCase().includes('juicios');
        const objectiveCount = objectiveByKpi[kpiName] ?? row?.objectiveCount ?? null;
        const fields = answerFieldsByKpi[kpiName] ?? LEGAL_COMPLIANCE_KPI_FIELDS[kpiName] ?? [];
        const hasCurrent = fields.includes('current_count');
        const hasActive = fields.includes('active_count');
        const hasAdditional = fields.includes('additional_amount_mxn');
        const showAdditional =
          hasAdditional &&
          isLawsuitKpi &&
          (((row?.currentCount ?? 0) + (row?.activeCount ?? 0) > 0) ||
            (row?.additionalAmountMxn ?? 0) > 0);

        return (
          <article key={kpiName} className="rounded-[18px] border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{kpiName}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Objective Count</span>
                <p className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  {toInputValue(objectiveCount) || 'N/A'}
                </p>
              </label>
              {hasCurrent ? (
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Current Count</span>
                  <input
                    name={`${key}_current_count`}
                    type="number"
                    step="1"
                    defaultValue={toInputValue(row?.currentCount)}
                    required
                    className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              ) : (
                <input type="hidden" name={`${key}_current_count`} value="" />
              )}
              {hasActive ? (
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">On Progress Count</span>
                  <input
                    name={`${key}_active_count`}
                    type="number"
                    step="1"
                    defaultValue={toInputValue(row?.activeCount)}
                    required
                    className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              ) : (
                <input type="hidden" name={`${key}_active_count`} value="" />
              )}
            </div>

            {isLawsuitKpi && hasAdditional ? (
              <div className="mt-3 rounded-[10px] border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  Additional (conditional)
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  If `current_count + active_count &gt; 0`, capture the contingent liability amount.
                </p>
                <label className="mt-2 block space-y-1">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Contingent Liability (MXN)</span>
                  <input
                    name={`${key}_additional_amount_mxn`}
                    type="number"
                    step="0.01"
                    defaultValue={toInputValue(row?.additionalAmountMxn)}
                    className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                {!showAdditional ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Current + Active is 0 in loaded row. You can still prefill this field if needed.
                  </p>
                ) : null}
              </div>
            ) : (
              <input type="hidden" name={`${key}_additional_amount_mxn`} value="" />
            )}

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
