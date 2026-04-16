import { NextResponse } from 'next/server';
import { syncExecutiveHomeQuerySnapshot } from '@/lib/data/excecutive/sync-executive-home-query-snapshot';
import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);

  const body = await request
    .json()
    .catch(() => ({} as { version?: string; reportingVersionId?: string; periodMonth?: string }));

  const requestedVersion =
    body.reportingVersionId?.trim() ||
    body.version?.trim() ||
    searchParams.get('reportingVersionId')?.trim() ||
    searchParams.get('version')?.trim() ||
    '';
  const requestedPeriodMonth =
    body.periodMonth?.trim() || searchParams.get('periodMonth')?.trim() || '';

  const versions = await getReportingVersions();
  if (versions.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'No reporting versions available.' },
      { status: 404 },
    );
  }

  const versionById = requestedVersion
    ? versions.find((item) => item.reportingVersionId === requestedVersion)
    : undefined;
  const versionByPeriod = requestedPeriodMonth
    ? versions.find((item) => item.periodMonth === requestedPeriodMonth)
    : undefined;

  if (requestedVersion && !versionById) {
    return NextResponse.json(
      { ok: false, error: `Reporting version not found: ${requestedVersion}` },
      { status: 400 },
    );
  }
  if (requestedPeriodMonth && !versionByPeriod) {
    return NextResponse.json(
      { ok: false, error: `Period month not found in reporting versions: ${requestedPeriodMonth}` },
      { status: 400 },
    );
  }

  const resolvedVersion =
    requestedVersion && requestedPeriodMonth
      ? versions.find(
          (item) =>
            item.reportingVersionId === requestedVersion && item.periodMonth === requestedPeriodMonth,
        )
      : versionById ?? versionByPeriod ?? versions[0];

  if (!resolvedVersion) {
    return NextResponse.json(
      {
        ok: false,
        error: `Reporting version-period mismatch: ${requestedVersion} / ${requestedPeriodMonth}`,
      },
      { status: 400 },
    );
  }

  const result = await syncExecutiveHomeQuerySnapshot(resolvedVersion.reportingVersionId);
  return NextResponse.json({
    ...result,
    reportingVersionId: resolvedVersion.reportingVersionId,
    periodMonth: resolvedVersion.periodMonth,
  });
}
