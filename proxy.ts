import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_COOKIE = 'admin_access';

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

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
  matcher: ['/admin/:path*'],
};
