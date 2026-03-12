type ExecutiveSummaryCardProps = {
  label: string;
  value: string;
  helper: string;
};

export function ExecutiveSummaryCard({
  label,
  value,
  helper,
}: ExecutiveSummaryCardProps) {
  return (
    <article className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{helper}</p>
    </article>
  );
}