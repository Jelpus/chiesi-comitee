import { NextResponse } from 'next/server';
import { getExecutiveHomeQueryRows } from '@/lib/data/excecutive/get-executive-home-query';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const version = searchParams.get('version') ?? undefined;
  const area = searchParams.get('area') ?? undefined;

  const rows = await getExecutiveHomeQueryRows({
    reportingVersionId: version,
    area,
  });

  return NextResponse.json({
    count: rows.length,
    rows,
  });
}

