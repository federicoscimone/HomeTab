/**
 * Helper per scrivere voci di audit log.
 * Non lancia mai eccezioni: un fallimento di audit non deve bloccare l'operazione principale.
 *
 * @example
 * import { writeAudit } from '@/lib/utils/audit';
 * await writeAudit(session, req, {
 *   action: 'DELETE',
 *   resource: 'movement',
 *   resourceId: id,
 *   description: `Eliminato movimento €${movement.amount} — ${movement.payee || movement.description}`,
 * });
 */

import connectDB from '@/lib/mongodb';
import AuditLog from '@/lib/models/AuditLog';
import logger from '@/lib/logger';

/**
 * @param {import('next-auth').Session} session  - sessione autenticata
 * @param {Request}                     req      - Next.js request (per estrarre IP)
 * @param {{
 *   action:      'CREATE'|'UPDATE'|'DELETE'|'IMPORT'|'LOGIN'|'PASSWORD_CHANGE',
 *   resource:    'movement'|'category'|'template'|'keyword'|'user'|'system',
 *   resourceId?: string|null,
 *   description: string,
 *   meta?:       object|null,
 * }} entry
 */
export async function writeAudit(session, req, { action, resource, resourceId = null, description, meta = null }) {
  try {
    await connectDB();

    const ip =
      req?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req?.headers?.get('x-real-ip') ||
      null;

    await AuditLog.create({
      userId:    session.user.id,
      userEmail: session.user.email,
      action,
      resource,
      resourceId: resourceId ? String(resourceId) : null,
      description,
      meta,
      ip,
    });
  } catch (err) {
    // L'audit è best-effort: logga l'errore ma non propagare
    logger.error('writeAudit failed', { action, resource, resourceId, error: err?.message });
  }
}
