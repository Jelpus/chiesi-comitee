import { NextResponse } from 'next/server';
import {
  createExecutiveAccessCookieValue,
  EXECUTIVE_COOKIE,
  EXECUTIVE_COOKIE_MAX_AGE_SECONDS,
} from '@/lib/security/executive-access';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };
    const password = String(body.password ?? '');
    const expected = process.env.EXCECUTIVE_ACCESS_PASSWORD ?? '';

    if (!password || !expected || password !== expected) {
      return NextResponse.json({ ok: false, message: 'Invalid password' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: EXECUTIVE_COOKIE,
      value: await createExecutiveAccessCookieValue(),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: EXECUTIVE_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid request' }, { status: 400 });
  }
}
