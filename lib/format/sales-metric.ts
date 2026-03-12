import type { SalesMetricMode } from '@/types/sales-internal';

function normalizeSalesGroup(value: string | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveSalesMetricMode(salesGroup: string | undefined): SalesMetricMode {
  const normalized = normalizeSalesGroup(salesGroup);
  if (normalized.includes('unit')) return 'units';
  return 'currency';
}

type FormatMetricOptions = {
  compactUnits?: boolean;
};

export function formatSalesMetric(
  value: number,
  mode: SalesMetricMode,
  options: FormatMetricOptions = {},
) {
  if (mode === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  const compactUnits = options.compactUnits ?? true;
  if (compactUnits && Math.abs(value) >= 10000) {
    const compact = value / 1000;
    const decimals = Math.abs(compact) >= 100 ? 0 : 1;
    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(compact)}K`;
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
