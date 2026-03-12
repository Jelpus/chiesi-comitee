import { semanticStatusClasses, type SemanticStatus } from '@/lib/status/status-styles';

type StatusBadgeProps = {
  status: SemanticStatus;
  label?: string;
};

const semanticStatusLabels: Record<SemanticStatus, string> = {
  green: 'Above Plan',
  yellow: 'Watch',
  red: 'Recovery',
  neutral: 'No Signal',
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.12em] uppercase ${semanticStatusClasses[status]}`}
    >
      {label ?? semanticStatusLabels[status]}
    </span>
  );
}
