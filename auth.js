import { getServerSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { loadSessionUser } from '@/lib/auth/sessionUser';
import { passwordAloneAllowed } from '@/lib/auth/otp';
import { verifyLoginCode } from '@/lib/services/otp';
import { allowAttempt, clientIp } from '@/lib/rateLimit';
import { isDemoMode } from '@/lib/demoAccounts';

/** Errore che il login mostra come "troppi tentativi" invece che come credenziali sbagliate. */
export const RATE_LIMITED = 'RateLimited';

/** Utente autenticato: si registra l'accesso e si passa a NextAuth solo identità e versione. */
async function signedIn(user) {
  await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });
  return { id: user._id.toString(), name: user.name, email: user.email, sv: user.sessionVersion ?? 0 };
}

export const authOptions = {
  session: {
    strategy: 'jwt',   // JWT + cookie HTTP-only
    maxAge: 30 * 24 * 60 * 60, // 30 giorni
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        // Secondo passo della verifica in due passaggi (vedi /api/auth/login/start).
        ticket: { label: 'Ticket', type: 'text' },
        code: { label: 'Code', type: 'text' },
      },
      async authorize(credentials, req) {
        await connectDB();
        const ip = clientIp(req?.headers);

        // Codice ricevuto su Telegram o via email, con il ticket rilasciato dopo la password.
        if (credentials?.ticket) {
          if (!(await allowAttempt('code', ip))) throw new Error(RATE_LIMITED);
          const user = await verifyLoginCode(credentials.ticket, credentials.code);
          return user ? signedIn(user) : null;
        }

        if (!credentials?.email || !credentials?.password) return null;
        if (!(await allowAttempt('login', ip))) throw new Error(RATE_LIMITED);

        const user = await User.findOne({ email: credentials.email.toLowerCase() });
        if (!user || user.active === false) return null;

        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) return null;

        // Con la 2FA attiva la password da sola non basta, anche chiamando questo endpoint
        // direttamente invece di passare dalla pagina di login: serve il ticket con il codice.
        if (!passwordAloneAllowed(user, isDemoMode())) return null;

        return signedIn(user);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sv = user.sv;
      }
      // Ruolo e stato si rileggono dal database a ogni uso della sessione (vedi
      // lib/auth/sessionUser.js): nel token restano solo identità e versione.
      // Sessione revocata (utente disattivato, eliminato, o password cambiata altrove): lanciare
      // qui fa sì che NextAuth cancelli il cookie e restituisca una sessione vuota, così anche
      // useSession() nel browser vede l'utente come disconnesso.
      const current = await loadSessionUser(token.id, token.sv);
      if (!current) throw new Error('Sessione revocata');
      token.name = current.name;
      token.role = current.role;
      token.mustChangePassword = current.mustChangePassword;
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.role = token.role;
        session.user.mustChangePassword = !!token.mustChangePassword;
      }
      return session;
    },
  },
};

/**
 * Sessione corrente per server components e route handlers; null se assente o revocata
 * (utente disattivato, eliminato, o password cambiata da un'altra sessione).
 */
export const auth = () => getServerSession(authOptions);
