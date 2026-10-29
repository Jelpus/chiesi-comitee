import { refreshGob360Mirror } from '@/lib/bigquery/refresh-gob360-mirror';

export const runtime = 'nodejs';
export const maxDuration = 800;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return Response.json(await refreshGob360Mirror());
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown GOB360 mirror error' },
      { status: 500 },
    );
  }
}
