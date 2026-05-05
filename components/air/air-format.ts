export function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, style: 'percent' }).format(value);
}

export function formatMonth(value: string | null | undefined) {
  if (!value) return 'No period';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
}
