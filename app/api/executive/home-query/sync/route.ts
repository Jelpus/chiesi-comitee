import { NextResponse } from 'next/server';
import { syncExecutiveHomeQuerySnapshot } from '@/lib/data/excecutive/sync-executive-home-query-snapshot';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const version = searchParams.get('version') ?? undefined;
  const result = await syncExecutiveHomeQuerySnapshot(version);
  return NextResponse.json(result);
}

