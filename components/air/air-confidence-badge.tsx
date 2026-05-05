import type { AirMatchConfidence } from '@/lib/air/types';

type Props = {
  confidence: AirMatchConfidence;
};

export function AirConfidenceBadge({ confidence }: Props) {
  const labelByConfidence: Record<AirMatchConfidence, string> = {
    high: 'High confidence',
    medium: 'Medium confidence',
    low: 'Review needed',
    unmatched: 'Unmatched',
  };
  const classByConfidence: Record<AirMatchConfidence, string> = {
    high: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    medium: 'border-sky-200 bg-sky-50 text-sky-700',
    low: 'border-amber-200 bg-amber-50 text-amber-800',
    unmatched: 'border-slate-200 bg-slate-100 text-slate-600',
  };

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${classByConfidence[confidence]}`}>
      {labelByConfidence[confidence]}
    </span>
  );
}
