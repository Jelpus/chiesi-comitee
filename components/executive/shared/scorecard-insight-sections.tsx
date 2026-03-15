type ScorecardInsightSectionsProps = {
  working: string[];
  improve: string[];
  actions: string[];
  actionsTitle?: string;
};

function parseTaggedMessage(value: string) {
  if (!value.includes('|||')) return { tag: null as string | null, message: value };
  const [tag, ...rest] = value.split('|||');
  return {
    tag: tag.trim() || null,
    message: rest.join('|||').trim(),
  };
}

function MessageRow({ value, tone }: { value: string; tone: 'working' | 'improve' | 'action' }) {
  const { tag, message } = parseTaggedMessage(value);
  const borderClass =
    tone === 'working'
      ? 'border-emerald-200 bg-emerald-50/60'
      : tone === 'improve'
        ? 'border-rose-200 bg-rose-50/60'
        : 'border-slate-200 bg-slate-50/70';

  return (
    <div className={`rounded-[12px] border p-3 ${borderClass}`}>
      <div className="flex items-center gap-2">
        {tag ? (
          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-blue-800">
            {tag}
          </span>
        ) : null}
        <p className="text-xs text-slate-700">{message}</p>
      </div>
    </div>
  );
}

export function ScorecardInsightSections({
  working,
  improve,
  actions,
  actionsTitle = 'Action Plan Priorities',
}: ScorecardInsightSectionsProps) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[24px] border border-emerald-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">What Is Working</p>
          <div className="mt-3 space-y-2">
            {working.map((item) => (
              <MessageRow key={`w-${item}`} value={item} tone="working" />
            ))}
          </div>
        </article>

        <article className="rounded-[24px] border border-rose-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <p className="text-xs uppercase tracking-[0.16em] text-rose-700">What Needs To Improve</p>
          <div className="mt-3 space-y-2">
            {improve.map((item) => (
              <MessageRow key={`i-${item}`} value={item} tone="improve" />
            ))}
          </div>
        </article>
      </div>

      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">{actionsTitle}</p>
        <div className="mt-3 space-y-2">
          {actions.map((item) => (
            <MessageRow key={`a-${item}`} value={item} tone="action" />
          ))}
        </div>
      </article>
    </>
  );
}
