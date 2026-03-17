import { NextResponse } from 'next/server';
import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';
import { syncExecutiveInsightsPreReadSnapshot } from '@/lib/data/excecutive/sync-executive-insights-preread-snapshot';
import { getExecutiveInsightsPreReadSnapshot } from '@/lib/data/excecutive/get-executive-insights-preread-snapshot';
import { renderExecutivePreReadPdf } from '@/lib/pdf/executive-preread-pdf';

function formatMonth(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedVersion =
    searchParams.get('version')?.trim() || searchParams.get('reportversion')?.trim() || '';

  const versions = await getReportingVersions();
  if (versions.length === 0) {
    return NextResponse.json({ ok: false, message: 'No reporting versions found.' }, { status: 404 });
  }

  const selected =
    versions.find((item) => item.reportingVersionId === requestedVersion) ?? versions[0];

  let rows = await getExecutiveInsightsPreReadSnapshot(selected.reportingVersionId);
  if (rows.length === 0) {
    await syncExecutiveInsightsPreReadSnapshot({
      reportingVersionId: selected.reportingVersionId,
      periodMonth: selected.periodMonth,
    });
    rows = await getExecutiveInsightsPreReadSnapshot(selected.reportingVersionId);
  }

  const generatedAt = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  const pdf = renderExecutivePreReadPdf({
    versionLabel: selected.versionName,
    periodLabel: formatMonth(selected.periodMonth),
    generatedAt,
    rows,
  });

  const filename = `executive-preread-${selected.periodMonth}-${selected.versionName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
