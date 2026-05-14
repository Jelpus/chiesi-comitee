import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getBusinessExcellenceFieldForceDetailData } from '@/lib/data/business-excellence';
import { EXECUTIVE_COOKIE, verifyExecutiveAccessCookieValue } from '@/lib/security/executive-access';

function normalizeView(value: string | null): 'ytd' | 'mth' {
  return value?.toLowerCase() === 'mth' ? 'mth' : 'ytd';
}

function normalizeCoverage(value: string | null): 'base' | 'adjusted' {
  return value?.toLowerCase() === 'adjusted' || value?.toLowerCase() === 'tft' ? 'adjusted' : 'base';
}

function normalizeBu(value: string | null): 'total' | 'air' | 'care' {
  const normalized = value?.toLowerCase();
  if (normalized === 'air' || normalized === 'care') return normalized;
  return 'total';
}

function normalizeDetailMode(value: string | null): 'territory' | 'district' {
  return value?.toLowerCase() === 'district' ? 'district' : 'territory';
}

function parseAccountTypes(searchParams: URLSearchParams) {
  return searchParams
    .getAll('accountTypes')
    .flatMap((value) => value.split('|'))
    .map((value) => value.trim())
    .filter(Boolean);
}

async function hasExecutiveAccess(request: Request) {
  const cookieStore = await cookies();
  const hasCookie = await verifyExecutiveAccessCookieValue(cookieStore.get(EXECUTIVE_COOKIE)?.value);
  if (hasCookie) return true;

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('embed_token');
  const expected = process.env.EMBEDED_TOKEN_MODEL ?? '';
  return Boolean(token && expected && token === expected);
}

export async function GET(request: Request) {
  if (!(await hasExecutiveAccess(request))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const reportingVersionId = searchParams.get('reportingVersionId');
  const reportPeriodMonth = searchParams.get('reportPeriodMonth');

  if (!reportingVersionId || !reportPeriodMonth) {
    return NextResponse.json(
      { ok: false, error: 'reportingVersionId and reportPeriodMonth are required.' },
      { status: 400 },
    );
  }

  try {
    const data = await getBusinessExcellenceFieldForceDetailData({
      reportingVersionId,
      reportPeriodMonth,
      view: normalizeView(searchParams.get('view')),
      coverage: normalizeCoverage(searchParams.get('coverage')),
      bu: normalizeBu(searchParams.get('bu')),
      detailMode: normalizeDetailMode(searchParams.get('detailMode')),
      potential: searchParams.get('potential') || 'all',
      channel: searchParams.get('channel') || 'all',
      accountTypes: parseAccountTypes(searchParams),
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load Field Force detail.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
