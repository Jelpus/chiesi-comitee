import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { saveAdminHomeStatusSnapshot } from '@/lib/data/admin-home-status';
import { syncExecutiveHomeQuerySnapshot } from '@/lib/data/excecutive/sync-executive-home-query-snapshot';
import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';

type SyncHomeStatusRequestBody = {
  reportingVersionId?: string;
  periodMonth?: string;
  createdBy?: string;
};

function asNonEmptyString(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let body: SyncHomeStatusRequestBody = {};
    try {
      body = (await request.json()) as SyncHomeStatusRequestBody;
    } catch {
      body = {};
    }

    const inputReportingVersionId =
      asNonEmptyString(body.reportingVersionId) || asNonEmptyString(searchParams.get('reportingVersionId'));
    const inputPeriodMonth =
      asNonEmptyString(body.periodMonth) || asNonEmptyString(searchParams.get('periodMonth'));
    const createdBy =
      asNonEmptyString(body.createdBy) || asNonEmptyString(searchParams.get('createdBy')) || 'admin_api';

    const versions = await getReportingVersions();
    if (versions.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No reporting versions available.',
        },
        { status: 404 },
      );
    }

    const latest = versions[0];
    const versionById = inputReportingVersionId
      ? versions.find((item) => item.reportingVersionId === inputReportingVersionId) ?? null
      : null;
    const versionByPeriod = inputPeriodMonth
      ? versions.find((item) => item.periodMonth === inputPeriodMonth) ?? null
      : null;

    const resolvedVersion = versionById ?? versionByPeriod ?? latest;
    const reportingVersionId = resolvedVersion.reportingVersionId;
    const periodMonth = inputPeriodMonth || resolvedVersion.periodMonth;

    const homeStatusResult = await saveAdminHomeStatusSnapshot({
      reportingVersionId,
      periodMonth,
      createdBy,
    });
    const homeQueryResult = await syncExecutiveHomeQuerySnapshot(reportingVersionId);

    revalidatePath('/admin');
    revalidatePath('/executive');

    return NextResponse.json({
      ok: true,
      reportingVersionId,
      periodMonth,
      usedLatestVersionFallback: !inputReportingVersionId && !inputPeriodMonth,
      homeStatus: homeStatusResult,
      homeQuery: homeQueryResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error while syncing home status.';
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
