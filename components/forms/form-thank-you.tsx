import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';

type FormThankYouProps = {
  moduleTitle: string;
  rowLabel: string;
  period: string;
  saved: number;
  editHref: string;
};

function formatMonth(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

export function FormThankYou({
  moduleTitle,
  rowLabel,
  period,
  saved,
  editHref,
}: FormThankYouProps) {
  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 overflow-hidden lg:gap-2 xl:gap-3 2xl:gap-4">
      <SectionHeader eyebrow="Forms" title="Submission Saved" description={`${moduleTitle} input was stored successfully.`} />
      <div className="overflow-auto pr-1">
        <article className="relative overflow-hidden rounded-[20px] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="text-sm text-slate-700">
            Saved <span className="font-semibold text-slate-900">{Number.isFinite(saved) ? saved : 0}</span> {rowLabel}{' '}
            for <span className="font-semibold text-slate-900">{formatMonth(period)}</span>.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={editHref}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-800"
            >
              Edit / Correct
            </Link>
            <Link
              href="/forms"
              className="rounded-full border border-slate-300 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white"
            >
              Back to Forms Home
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
