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
  if (!session) {
    return { denied: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }) };
  }
  if (session.user.mustChangePassword && !allowPendingPassword) {
    return {
      denied: NextResponse.json({ error: 'Devi prima sostituire la password provvisoria' }, { status: 403 }),
    };
  }
  if (!can(session.user.role, permission)) {
    return {
      denied: NextResponse.json({ error: 'Non hai i permessi per questa operazione' }, { status: 403 }),
    };
  }
  return { session };
}
