import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { refreshAirServingArtifacts } from '@/lib/serving/refresh-air-serving';

export const maxDuration = 300;

type RefreshBody = {
  password?: string;
};

async function hasAdminAccess(request: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get('admin_access')?.value === '1') return true;

  try {
    const body = (await request.clone().json()) as RefreshBody;
    const expected = process.env.ADMIN_ACCESS_PASSWORD ?? 'jelpus';
    return Boolean(body.password && body.password === expected);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await hasAdminAccess(request))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await refreshAirServingArtifacts(getBigQueryClient());
    revalidatePath('/air');
    revalidatePath('/air/workbench');
    revalidatePath('/air/workbench-private');
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to refresh AIR serving artifacts.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
