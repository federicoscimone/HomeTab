import { getServerSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { loadSessionUser } from '@/lib/auth/sessionUser';

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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const user = await User.findOne({ email: credentials.email.toLowerCase() });
        if (!user || user.active === false) return null;

        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) return null;

        await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          sv: user.sessionVersion ?? 0,
        };
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
