type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  extras?: React.ReactNode;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  extras,
}: SectionHeaderProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
      <div className="h-1.5 w-full bg-gradient-to-r from-[var(--brand-chiesi)] via-slate-700 to-slate-400" />

      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between lg:p-7">
        <div className="max-w-4xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">
            {eyebrow}
          </p>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
              {title}
            </h1>

            {description ? (
              <div className="flex items-baseline gap-3">
                <span className="text-lg font-light text-slate-300 lg:text-xl">/</span>
                <p className="text-sm font-medium text-slate-500 lg:text-[15px]">
                  {description}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {(actions || extras) ? (
          <div className="flex flex-col items-start gap-2 lg:items-end">
            {actions ? (
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {actions}
              </div>
            ) : null}

            {extras ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 lg:justify-end">
                {extras}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}