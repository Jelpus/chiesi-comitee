import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { saveAdminHomeStatusSnapshot } from '@/lib/data/admin-home-status';
import { syncExecutiveHomeQuerySnapshot } from '@/lib/data/excecutive/sync-executive-home-query-snapshot';

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

    const reportingVersionId =
      asNonEmptyString(body.reportingVersionId) || asNonEmptyString(searchParams.get('reportingVersionId'));
    const periodMonth =
      asNonEmptyString(body.periodMonth) || asNonEmptyString(searchParams.get('periodMonth'));
    const createdBy =
      asNonEmptyString(body.createdBy) || asNonEmptyString(searchParams.get('createdBy')) || 'admin_api';

    if (!reportingVersionId || !periodMonth) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing reportingVersionId or periodMonth.',
        },
        { status: 400 },
      );
    }

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
