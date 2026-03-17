import 'server-only';

import { getBigQueryClient } from '@/lib/bigquery/client';

const SNAPSHOT_TABLE = 'chiesi-committee.chiesi_committee_mart.mart_executive_insights_preread_snapshot';

export type ExecutivePreReadSection = {
  title: string;
  lines: string[];
};

export type ExecutivePreReadSnapshotRow = {
  period: string;
  version: string;
  area: string;
  areaCode: string;
  areaOrder: number;
  landingUrl: string | null;
  headline: string;
  summary: string;
  preReadText: string;
  sections: ExecutivePreReadSection[];
  updatedAt: string | null;
};

function toSections(value: unknown): ExecutivePreReadSection[] {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const rawTitle = (item as Record<string, unknown>).title;
        const rawLines = (item as Record<string, unknown>).lines;
        const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
        if (!title) return null;
        const lines = Array.isArray(rawLines)
          ? rawLines.map((line) => String(line ?? '').trim()).filter(Boolean)
          : [];
        return { title, lines };
      })
      .filter((item): item is ExecutivePreReadSection => item != null);
  } catch {
    return [];
  }
}

export async function getExecutiveInsightsPreReadSnapshot(
  reportingVersionId: string,
): Promise<ExecutivePreReadSnapshotRow[]> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        CAST(period AS STRING) AS period,
        version,
        area,
        area_code,
        area_order,
        landing_url,
        headline,
        summary,
        pre_read_text,
        TO_JSON_STRING(sections_json) AS sections_json,
        CAST(updated_at AS STRING) AS updated_at
      FROM \`${SNAPSHOT_TABLE}\`
      WHERE version = @version
      ORDER BY area_order ASC, area ASC
    `,
    params: {
      version: reportingVersionId,
    },
  });

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    period: String(row.period ?? ''),
    version: String(row.version ?? ''),
    area: String(row.area ?? ''),
    areaCode: String(row.area_code ?? ''),
    areaOrder: Number(row.area_order ?? 0),
    landingUrl: row.landing_url == null ? null : String(row.landing_url),
    headline: String(row.headline ?? ''),
    summary: String(row.summary ?? ''),
    preReadText: String(row.pre_read_text ?? ''),
    sections: toSections(row.sections_json),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
  }));
}
