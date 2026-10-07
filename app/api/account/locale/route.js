/**
 * @fileoverview API route — /api/account/locale
 * PUT — salva la lingua scelta dall'utente collegato ({ locale: 'it' | 'en' }).
 *
 * L'interfaccia legge la lingua dal cookie; quella salvata qui serve dove il cookie non c'è:
 * un'email di reset, una notifica, un nuovo browser dopo il login.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { isLocale, LOCALE_COOKIE } from '@/lib/i18n/locale';
import { serverTranslator } from '@/lib/i18n/server';

export async function PUT(req) {
  // Anche con la password provvisoria da cambiare: la lingua serve proprio in quella pagina.
  const { session, denied } = await requirePermission('data:read', { allowPendingPassword: true });
  if (denied) return denied;

  const { locale } = await req.json().catch(() => ({}));
  if (!isLocale(locale)) {
    return NextResponse.json({ error: (await serverTranslator('errors'))('invalidLocale') }, { status: 400 });
  }

  await connectDB();
  await User.updateOne({ _id: session.user.id }, { locale });

  const res = NextResponse.json({ locale });
  res.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  return res;
}
