export const SOURCE_PERIOD_OFFSETS = [0, 1, 2] as const;

export type SourcePeriodOffsetMonths = (typeof SOURCE_PERIOD_OFFSETS)[number];

export function normalizeSourcePeriodOffset(value: unknown): SourcePeriodOffsetMonths {
  const parsed = Number(value);
  return SOURCE_PERIOD_OFFSETS.includes(parsed as SourcePeriodOffsetMonths)
    ? (parsed as SourcePeriodOffsetMonths)
    : 0;
}

export function sourcePeriodPolicyLabel(offset: number) {
  const normalized = normalizeSourcePeriodOffset(offset);
  return normalized === 0 ? 'M' : `M-${normalized}`;
}

export function expectedSourceAsOfMonth(periodMonth: string, offset: number) {
  const match = /^(\d{4})-(\d{2})-01$/.exec(periodMonth);
  if (!match) return '';

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - normalizeSourcePeriodOffset(offset));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function formatMonthYear(value: string, locale = 'es-ES') {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return value;
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)),
  );
}
