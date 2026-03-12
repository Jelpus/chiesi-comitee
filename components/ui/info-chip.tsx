type InfoChipProps = {
  label: string;
  value: string;
};

export function InfoChip({ label, value }: InfoChipProps) {
  return (
    <div className="min-w-[132px] rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}