import Link from 'next/link';
import { ModuleIcon } from '@/components/executive/module-icon';
import { SectionHeader } from '@/components/ui/section-header';

type ComingSoonModulePageProps = {
  moduleName: string;
};

export function ComingSoonModulePage({ moduleName }: ComingSoonModulePageProps) {
  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 overflow-hidden lg:gap-2 xl:gap-3 2xl:gap-4">
      <SectionHeader
        eyebrow="Executive"
        title={moduleName}
        description="Module scaffolding is ready. Detailed insights, scorecard, and dashboard are pending integration."
      />

      <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600">
            <ModuleIcon module={moduleName} className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Coming Soon</p>
            <p className="mt-2 max-w-2xl text-sm text-slate-700">
              This executive module is visible in navigation and ready for phased rollout.
            </p>
            <Link
              href="/executive"
              className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Back to Executive Home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
