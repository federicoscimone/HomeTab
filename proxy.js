import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { loadSessionUser } from '@/lib/auth/sessionUser';
import { pageRedirectFor } from '@/lib/auth/permissions';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/setup', '/offline'];
const FIRST_ACCESS = '/primo-accesso';
const SESSION_COOKIES = ['next-auth.session-token', '__Secure-next-auth.session-token'];

/**
 * Protezione delle pagine. Le API non passano da qui oltre al controllo del token: ognuna verifica
 * da sé il proprio permesso con requirePermission (lib/auth/guard.js), che è la protezione vera.
 * Qui si evita solo di mostrare pagine che poi non funzionerebbero.
 */
export async function proxy(req) {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const redirect = (path) => NextResponse.redirect(new URL(path, nextUrl));

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) return isPublic ? NextResponse.next() : redirect('/login');
  if (pathname.startsWith('/api/')) return NextResponse.next();

  // Il token dice solo chi sei: ruolo, attivazione e password provvisoria si leggono dal database,
  // così un cambio fatto da un admin vale subito e non alla scadenza del JWT (30 giorni).
  const user = await loadSessionUser(token.id, token.sv);
  if (!user) {
    // Sessione revocata: si cancella il cookie, altrimenti /login rimanderebbe di nuovo a /.
    const res = redirect('/login');
    for (const name of SESSION_COOKIES) res.cookies.delete(name);
    return res;
  }

  if (user.mustChangePassword) return pathname === FIRST_ACCESS ? NextResponse.next() : redirect(FIRST_ACCESS);
  if (pathname === FIRST_ACCESS || pathname === '/login') return redirect('/');

  const fallback = pageRedirectFor(pathname, user.role);
  if (fallback) return redirect(fallback);

  return NextResponse.next();
}

export const config = {
  // Esclusi anche i file statici di /public: prima manifest.json veniva rediretto al login e il
  // browser riceveva HTML al posto del JSON (errore "Manifest: Syntax error" in console).
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)'],
};
