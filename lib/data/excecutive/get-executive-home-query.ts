import 'server-only';

import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';
import { getExecutiveCardsFromBigQuery } from './get-executive-from-bigquery';

export type ExecutiveHomeQueryRow = {
  period: string;
  version: string;
  area: string;
  main_kpi_value: string;
  target_value: string;
  variance_value: string;
  landing_url: string | null;
};

function normalizeAreaLabel(moduleName: string) {
  return moduleName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function cleanBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function toAbsoluteLandingUrl(href: string | null): string | null {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  const baseUrl =
    cleanBaseUrl(process.env.PUBLIC_URL) ??
    cleanBaseUrl(process.env.NEXT_PUBLIC_URL) ??
    cleanBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    cleanBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (!baseUrl) return href;
  return `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
}

export async function getExecutiveHomeQueryRows(params?: {
  reportingVersionId?: string;
  area?: string;
}): Promise<ExecutiveHomeQueryRow[]> {
  const availableVersions = await getReportingVersions();
  if (availableVersions.length === 0) return [];

  const selectedVersion =
    availableVersions.find((item) => item.reportingVersionId === params?.reportingVersionId) ??
    availableVersions[0];

  const cards = await getExecutiveCardsFromBigQuery(
    selectedVersion.reportingVersionId,
    selectedVersion.periodMonth,
  );

  const rows: ExecutiveHomeQueryRow[] = cards.map((card) => ({
    period: selectedVersion.periodMonth,
    version: selectedVersion.reportingVersionId,
    area: normalizeAreaLabel(card.module),
    main_kpi_value: card.actual,
    target_value: card.target,
    variance_value: card.variance,
    landing_url: toAbsoluteLandingUrl(card.detailHref),
  }));

  const areaFilter = (params?.area ?? '').toLowerCase().trim();
  if (!areaFilter) return rows;
  return rows.filter((row) => row.area === areaFilter);
}
