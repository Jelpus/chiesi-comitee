import Link from 'next/link';
import { SectionHeader } from '@/components/ui/section-header';

export const dynamic = 'force-dynamic';

export default function FormsHomePage() {
  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 overflow-hidden lg:gap-2 xl:gap-3 2xl:gap-4">
      <SectionHeader
        eyebrow="Forms"
        title="Data Collection Hub"
        description="Shareable input forms for modules without structured source feeds."
      />

      <div className="space-y-3 overflow-auto pr-1">
        <article className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Regulatory Affairs</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">RA - Quality - FV Monthly Input</h2>
          <p className="mt-2 text-sm text-slate-700">
            Capture monthly topic-level results against target statements. The same link can be shared with contributors.
          </p>
          <Link
            href="/forms/regulatory-affairs"
            className="mt-4 inline-flex rounded-full border border-slate-300 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white"
          >
            Open form
          </Link>
        </article>

        <article className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Legal & Compliance</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Legal KPI Monthly Input</h2>
          <p className="mt-2 text-sm text-slate-700">
            Capture objective/result/coverage plus detail lines for legal and compliance executive tracking.
          </p>
          <Link
            href="/forms/legal-compliance"
            className="mt-4 inline-flex rounded-full border border-slate-300 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white"
          >
            Open form
          </Link>
        </article>

        <article className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Medical</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Medical KPI Monthly Input</h2>
          <p className="mt-2 text-sm text-slate-700">
            Capture monthly Medical KPI results against centrally governed targets and add execution comments.
          </p>
          <Link
            href="/forms/medical"
            className="mt-4 inline-flex rounded-full border border-slate-300 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white"
          >
            Open form
          </Link>
        </article>
      </div>
    </section>
  );
}
