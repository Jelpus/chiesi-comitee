import Link from 'next/link';
import { SectionHeader } from '@/components/ui/section-header';
import { CopyLinkButton } from '@/components/ui/copy-link-button';
import { CLOSING_INPUT_AREAS } from '@/lib/data/closing-inputs-schema';

export const dynamic = 'force-dynamic';

export default function ClosingInputsHomePage() {
  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 overflow-hidden lg:gap-2 xl:gap-3 2xl:gap-4">
      <SectionHeader
        eyebrow="Closing Inputs"
        title="Area Closing Forms"
        description="Mini close form by executive area for committee key messages."
      />

      <div className="space-y-3 overflow-auto pr-1">
        {CLOSING_INPUT_AREAS.map((area) => (
          <article
            key={area.slug}
            className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Executive Area</p>
              <CopyLinkButton href={`/closing-inputs/${area.slug}`} />
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{area.label}</h2>
            <p className="mt-2 text-sm text-slate-700">
              Submit 5 key messages for close plus one optional comment for committee context.
            </p>
            <Link
              href={`/closing-inputs/${area.slug}`}
              className="mt-4 inline-flex rounded-full border border-slate-300 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white"
            >
              Open form
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
