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
 *   action:      'CREATE'|'UPDATE'|'DELETE'|'IMPORT'|'LOGIN'|'PASSWORD_CHANGE'|'BACKUP_CONNECT'|'BACKUP_RUN'|'BACKUP_FAIL'|'BACKUP_DISCONNECT',
 *   resource:    'movement'|'category'|'template'|'keyword'|'user'|'system'|'backup'|'goal',
 *   resourceId?: string|null,
 *   description: string,
 *   meta?:       object|null,
 * }} entry
 */
export async function writeAudit(session, req, { action, resource, resourceId = null, description, meta = null }) {
  return writeAuditRecord({
    userId: session?.user?.id,
    userEmail: session?.user?.email,
    req,
    action,
    resource,
    resourceId,
    description,
    meta,
  });
}

export async function writeAuditRecord({ userId, userEmail, req, action, resource, resourceId = null, description, meta = null }) {
  try {
    await connectDB();

    if (!userId || !userEmail) {
      throw new Error('Audit requires userId and userEmail');
    }

    const ip =
      req?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req?.headers?.get('x-real-ip') ||
      null;

    await AuditLog.create({
      userId,
      userEmail,
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
