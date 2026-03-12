export type SemanticStatus = 'green' | 'yellow' | 'red' | 'neutral';

export const semanticStatusClasses: Record<SemanticStatus, string> = {
  green: 'border border-emerald-200/80 bg-emerald-50 text-emerald-700',
  yellow: 'border border-amber-200/80 bg-amber-50 text-amber-700',
  red: 'border border-rose-200/80 bg-rose-50 text-rose-700',
  neutral: 'border border-slate-200 bg-slate-50 text-slate-600',
};