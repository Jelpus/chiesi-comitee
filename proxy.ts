import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  createExecutiveAccessCookieValue,
  EXECUTIVE_COOKIE,
  EXECUTIVE_COOKIE_MAX_AGE_SECONDS,
  verifyExecutiveAccessCookieValue,
} from '@/lib/security/executive-access';

const ADMIN_COOKIE = 'admin_access';

function isPowerBiReferer(request: NextRequest) {
  const referer = request.headers.get('referer') ?? '';
  return referer.toLowerCase().includes('app.powerbi.com');
}

function hasValidEmbedToken(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('embed_token');
  const expected = process.env.EMBEDED_TOKEN_MODEL ?? '';
  return Boolean(token && expected && token === expected);
}

function buildAccessRedirect(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const accessUrl = new URL('/access', request.url);
  accessUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(accessUrl);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/executive')) {
    const hasExecutiveCookie = await verifyExecutiveAccessCookieValue(
      request.cookies.get(EXECUTIVE_COOKIE)?.value,
    );

    if (hasExecutiveCookie) {
      return NextResponse.next();
    }

    if (isPowerBiReferer(request) && hasValidEmbedToken(request)) {
      const response = NextResponse.next();
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
    }

    return buildAccessRedirect(request);
  }

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const hasAccess = request.cookies.get(ADMIN_COOKIE)?.value === '1';

  if (pathname === '/admin/unlock') {
    if (hasAccess) {
      const nextPath = request.nextUrl.searchParams.get('next') || '/admin';
      const target = new URL(nextPath, request.url);
      return NextResponse.redirect(target);
    }
    return NextResponse.next();
  }

  if (hasAccess) {
    return NextResponse.next();
  }

  const unlockUrl = new URL('/admin/unlock', request.url);
  unlockUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(unlockUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/executive/:path*'],
};
