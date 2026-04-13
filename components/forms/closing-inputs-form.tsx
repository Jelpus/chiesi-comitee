'use client';

import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { submitClosingInputForm } from '@/app/closing-inputs/[area]/actions';

type ClosingInputFormRow = {
  reportedBy: string;
  messages: string[];
  additionalComment: string;
};

type ClosingInputsFormProps = {
  areaSlug: string;
  areaLabel: string;
  reportingVersionId: string;
  defaultPeriodMonth: string;
  defaultSourceAsOfMonth: string;
  row: ClosingInputFormRow | null;
};

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
          Saving...
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

export function ClosingInputsForm({
  areaSlug,
  areaLabel,
  reportingVersionId,
  defaultPeriodMonth,
  defaultSourceAsOfMonth,
  row,
}: ClosingInputsFormProps) {
  const messages = Array.from({ length: 5 }, (_, index) => row?.messages[index] ?? '');

  return (
    <form action={submitClosingInputForm} className="space-y-4">
      <input type="hidden" name="areaSlug" value={areaSlug} />
      <input type="hidden" name="reportingVersionId" value={reportingVersionId} />
      <PendingOverlay />

      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Period Month</span>
            <input
              name="periodMonth"
              type="month"
              required
              defaultValue={toMonthValue(defaultPeriodMonth)}
              className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Source As Of</span>
            <input
              name="sourceAsOfMonth"
              type="month"
              required
              defaultValue={toMonthValue(defaultSourceAsOfMonth)}
              className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Reported By</span>
            <input
              name="reportedBy"
              type="text"
              required
              defaultValue={row?.reportedBy ?? ''}
              placeholder="Name or team"
              className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </article>

      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
          Key Messages - {areaLabel}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          En 5 bullets, describe los 5 mensajes clave para el comité relacionados al desempeño del periodo.
        </p>
        <div className="mt-4 space-y-3">
          {messages.map((message, index) => (
            <label key={`message-${index + 1}`} className="block space-y-1">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                Message {index + 1}
              </span>
              <textarea
                name={`message${index + 1}`}
                defaultValue={message}
                required
                rows={2}
                className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
      </article>

      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
            Additional Comment (optional)
          </span>
          <textarea
            name="additionalComment"
            defaultValue={row?.additionalComment ?? ''}
            rows={4}
            className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </article>

      <div className="flex items-center gap-3">
        <SubmitButton />
      </div>
    </form>
  );
}
