import type { CapacityStatus, RecommendationAction } from '@/lib/air/types';

export const actionLabel: Record<RecommendationAction, string> = {
  increase_frequency: 'Increase frequency',
  maintain_frequency: 'Maintain frequency',
  decrease_frequency: 'Decrease frequency',
  remove_or_deprioritize: 'Remove / deprioritize',
  add_to_call_plan: 'Add to Call Plan',
  review_manually: 'Review manually',
};

export const capacityStatusLabel: Record<CapacityStatus, string> = {
  underutilized: 'Underutilized',
  balanced: 'Balanced',
  moderately_overloaded: 'Moderately overloaded',
  critically_overloaded: 'Critically overloaded',
};

export function ActionBadge({ action }: { action: RecommendationAction }) {
  const className: Record<RecommendationAction, string> = {
    increase_frequency: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    maintain_frequency: 'border-slate-200 bg-slate-50 text-slate-700',
    decrease_frequency: 'border-amber-200 bg-amber-50 text-amber-800',
    remove_or_deprioritize: 'border-rose-200 bg-rose-50 text-rose-700',
    add_to_call_plan: 'border-sky-200 bg-sky-50 text-sky-700',
    review_manually: 'border-violet-200 bg-violet-50 text-violet-700',
  };

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${className[action]}`}>
      {actionLabel[action]}
    </span>
  );
}

export function CapacityBadge({ status }: { status: CapacityStatus }) {
  const className: Record<CapacityStatus, string> = {
    underutilized: 'border-sky-200 bg-sky-50 text-sky-700',
    balanced: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    moderately_overloaded: 'border-amber-200 bg-amber-50 text-amber-800',
    critically_overloaded: 'border-rose-200 bg-rose-50 text-rose-700',
  };

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${className[status]}`}>
      {capacityStatusLabel[status]}
    </span>
  );
}
