type ModuleIconProps = {
  module: string;
  className?: string;
};

export function ModuleIcon({ module, className = 'h-5 w-5' }: ModuleIconProps) {
  const normalized = module.toLowerCase();

  if (normalized.includes('internal sales') || normalized.includes('sales internal')) {
    return (
      <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3.5 14.5h13" />
        <path d="M5.5 14.5V9.5h2v5m2-8h2v8m2-5h2v5" />
      </svg>
    );
  }
  if (normalized.includes('business excellence')) {
    return (
      <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="10" cy="10" r="6.5" />
        <path d="m10 6.5 1.2 2.5 2.8.4-2 2 0.5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4z" />
      </svg>
    );
  }
  if (normalized.includes('commercial operations')) {
    return (
      <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3.5" y="4" width="13" height="12" rx="2" />
        <path d="M7 8h6M7 11h6" />
      </svg>
    );
  }
  if (normalized.includes('medical')) {
    return (
      <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10 4.5v11M4.5 10h11" />
        <rect x="3.5" y="3.5" width="13" height="13" rx="2.5" />
      </svg>
    );
  }
  if (normalized.includes('legal') || normalized.includes('compliance')) {
    return (
      <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10 4v12M6 7h8" />
        <path d="M6 7 4.5 10h3zM14 7l-1.5 3h3z" />
      </svg>
    );
  }
  if (normalized.includes('human resources')) {
    return (
      <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="7" cy="8" r="2" />
        <circle cx="13" cy="8" r="2" />
        <path d="M4.5 14a2.5 2.5 0 0 1 5 0M10.5 14a2.5 2.5 0 0 1 5 0" />
      </svg>
    );
  }
  if (normalized.includes('opex')) {
    return (
      <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="10" cy="10" r="5.5" />
        <path d="M10 6.5v3.5l2.3 1.4" />
      </svg>
    );
  }
  if (normalized.includes('quality') || normalized.includes('fv') || normalized.includes('ra')) {
    return (
      <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10 3.5 15.5 6v4c0 3.3-2 5.2-5.5 6.5C6.5 15.2 4.5 13.3 4.5 10V6z" />
        <path d="m7.5 10 1.7 1.7L12.8 8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="10" cy="10" r="6.5" />
    </svg>
  );
}
