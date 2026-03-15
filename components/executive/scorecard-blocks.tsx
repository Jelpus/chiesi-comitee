import type { ReactNode } from 'react';

type ScorecardTone = 'neutral' | 'indigo' | 'emerald' | 'rose';

const TONE_BY_BLOCK: Record<ScorecardTone, string> = {
  neutral: 'border-slate-200/80',
  indigo: 'border-indigo-200/80',
  emerald: 'border-emerald-200/80',
  rose: 'border-rose-200/80',
};

const TONE_BY_TITLE: Record<ScorecardTone, string> = {
  neutral: 'text-slate-600',
  indigo: 'text-indigo-700',
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
};

export function ExecutiveScorecardBlock({
  title,
  tone = 'neutral',
  right,
  children,
}: {
  title: string;
  tone?: ScorecardTone;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article
      className={`rounded-[24px] border bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)] ${TONE_BY_BLOCK[tone]}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs uppercase tracking-[0.16em] ${TONE_BY_TITLE[tone]}`}>{title}</p>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </article>
  );
}

export function ExecutiveScorecardList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2 text-sm text-slate-700">
      {items.map((item) => (
        <p key={item}>- {item}</p>
      ))}
    </div>
  );
}

