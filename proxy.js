import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/setup', '/offline'];

export async function proxy(req) {
  const { nextUrl } = req;
  const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p));

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  if (token && nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
