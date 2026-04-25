import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/setup', '/offline'];

export default withAuth(
  function middleware(req) {
    // Utente autenticato che visita /login → redirect alla home
    if (req.nextUrl.pathname === '/login') {
      return NextResponse.redirect(new URL('/', req.nextUrl));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const isPublic = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
        return isPublic || !!token;
      },
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
