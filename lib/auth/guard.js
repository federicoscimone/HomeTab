/**
 * @fileoverview Controllo di accesso per le route API.
 * @module lib/auth/guard
 *
 * @example
 * const { session, denied } = await requirePermission('movements:create');
 * if (denied) return denied;
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { can } from '@/lib/auth/permissions';
import { serverTranslator } from '@/lib/i18n/server';

/**
 * @param {string} [permission='data:read'] - Vedi PERMISSIONS in lib/auth/permissions.js.
 * @param {{ allowPendingPassword?: boolean }} [options]
 *   allowPendingPassword — true solo per la rotta di cambio password: chi ha una password
 *   provvisoria non può fare nient'altro finché non la sostituisce.
 * @returns {Promise<{ session: import('next-auth').Session, denied?: undefined }
 *   | { session?: undefined, denied: NextResponse }>}
 */
export async function requirePermission(permission = 'data:read', { allowPendingPassword = false } = {}) {
  const session = await auth();
  // Il testo dell'errore arriva all'interfaccia così com'è: si traduce nella lingua della richiesta.
  const deny = async (key, status) =>
    ({ denied: NextResponse.json({ error: (await serverTranslator('errors'))(key) }, { status }) });

  if (!session) return deny('notAuthenticated', 401);
  if (session.user.mustChangePassword && !allowPendingPassword) return deny('pendingPassword', 403);
  if (!can(session.user.role, permission)) return deny('forbidden', 403);
  return { session };
}
