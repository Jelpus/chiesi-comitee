'use client';

import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import type { RaCountMetric, RaMonthlyInputRow, RaTopicName } from '@/lib/data/ra-forms-schema';
import { RA_TOPICS, RA_TOPIC_COUNT_FIELDS } from '@/lib/data/ra-forms-schema';
import { submitRegulatoryAffairsForm } from '@/app/forms/regulatory-affairs/actions';

type RegulatoryAffairsFormProps = {
  defaultPeriodMonth: string;
  defaultSourceAsOfMonth: string;
  reportingVersionId: string;
  objectivesByTopic: Record<string, string>;
  countFieldsByTopic?: Partial<Record<RaTopicName, ReadonlyArray<RaCountMetric>>>;
  rows: RaMonthlyInputRow[];
};

function topicKey(topic: string) {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function toInputValue(value: number | null | undefined) {
  return value == null ? '' : String(value);
}

function toMonthValue(value: string) {
  return value?.slice(0, 7) ?? '';
}

const COUNT_FIELD_META: Record<
  RaCountMetric,
  { label: string; suffix: string; read: (row: RaMonthlyInputRow | undefined) => number | null | undefined }
> = {
  on_time: { label: 'On-time', suffix: 'on_time', read: (row) => row?.onTimeCount },
  late: { label: 'Late', suffix: 'late', read: (row) => row?.lateCount },
  pending: { label: 'Pending', suffix: 'pending', read: (row) => row?.pendingCount },
  active: { label: 'Active', suffix: 'active', read: (row) => row?.activeCount },
  overdue: { label: 'Overdue', suffix: 'overdue', read: (row) => row?.overdueCount },
  ytd: { label: 'YTD total', suffix: 'ytd', read: (row) => row?.ytdCount },
};

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

export function RegulatoryAffairsForm({
  defaultPeriodMonth,
  defaultSourceAsOfMonth,
  reportingVersionId,
  objectivesByTopic,
  countFieldsByTopic = {},
  rows,
}: RegulatoryAffairsFormProps) {
  const byTopic = new Map(rows.map((row) => [row.topic.toLowerCase().trim(), row]));

  return (
    <form action={submitRegulatoryAffairsForm} className="space-y-4">
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

      {RA_TOPICS.map((topic) => {
        const key = topicKey(topic);
        const current = byTopic.get(topic.toLowerCase());
        const objectiveText = objectivesByTopic[topic] ?? current?.targetLabel ?? 'Target not configured';
        return (
          <article key={topic} className="rounded-[18px] border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{topic}</p>
            <div className="mt-3 grid gap-3">
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Objective</span>
                <p className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">{objectiveText}</p>
              </div>
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Result</span>
                <textarea
                  name={`${key}_result`}
                  defaultValue={current?.resultSummary ?? ''}
                  placeholder="Monthly result summary"
                  rows={2}
                  required
                  className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {(countFieldsByTopic[topic] ?? RA_TOPIC_COUNT_FIELDS[topic] ?? []).map((field) => {
                const meta = COUNT_FIELD_META[field];
                return (
                  <label key={field} className="space-y-1">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{meta.label}</span>
                    <input
                      name={`${key}_${meta.suffix}`}
                      type="number"
                      defaultValue={toInputValue(meta.read(current))}
                      required
                      className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                );
              })}
            </div>

            <label className="mt-3 block space-y-1">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Comment</span>
              <textarea
                name={`${key}_comment`}
                defaultValue={current?.comment ?? ''}
                placeholder="Optional detail (e.g. COFEPRIS status, area breakdown)"
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
