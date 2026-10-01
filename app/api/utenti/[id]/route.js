/**
 * @fileoverview API route — /api/utenti/[id] (solo amministratori)
 * PATCH  — modifica { name, role, active } oppure { action: 'reset-password', password }.
 * DELETE — solo per utenti che non sono mai entrati (es. creati per errore): chi ha usato l'app
 *          compare nell'audit log e va disattivato, non cancellato.
 *
 * Vincoli: un admin non può cambiare il proprio ruolo né disattivarsi (si chiuderebbe fuori), deve
 * sempre restare almeno un admin attivo, e in DEMO_MODE gli account della vetrina non si toccano.
 */

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { ROLE_INFO } from '@/lib/auth/permissions';
import { isProtectedDemoAccount } from '@/lib/demoAccounts';
import { isLastActiveAdmin, parseUserFields, passwordError, toPublicUser } from '@/lib/services/users';
import { writeAudit } from '@/lib/utils/audit';

const notFound = () => NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
const forbidden = (error) => NextResponse.json({ error }, { status: 403 });

/** Carica l'utente bersaglio e applica i vincoli comuni a modifica ed eliminazione. */
async function loadTarget(id) {
  if (!mongoose.isValidObjectId(id)) return { response: notFound() };
  await connectDB();
  const user = await User.findById(id);
  if (!user) return { response: notFound() };
  if (isProtectedDemoAccount(user.email)) {
    return { response: forbidden('Gli account della demo non si possono modificare') };
  }
  return { user };
}

export async function PATCH(req, { params }) {
  const { session, denied } = await requirePermission('users:manage');
  if (denied) return denied;

  const { id } = await params;
  const { user, response } = await loadTarget(id);
  if (response) return response;

  const isSelf = String(user._id) === session.user.id;
  const body = await req.json();
  let description;

  if (body.action === 'reset-password') {
    if (isSelf) return forbidden('Per la tua password usa la pagina "Il mio account"');
    const pwdError = passwordError(body.password);
    if (pwdError) return NextResponse.json({ error: pwdError }, { status: 400 });

    user.hashedPassword = await bcrypt.hash(body.password, 12);
    user.mustChangePassword = true;
    // Le sessioni aperte decadono: chi ha la vecchia password non deve restare dentro.
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    description = `Reimpostata la password provvisoria di ${user.name}`;
  } else if (body.action) {
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
  } else {
    const { data, error } = parseUserFields(body, true);
    if (error) return NextResponse.json({ error }, { status: 400 });
    if (data.email && data.email !== user.email && await User.exists({ email: data.email })) {
      return NextResponse.json({ error: 'Esiste già un utente con questa email' }, { status: 409 });
    }

    const losesAdmin = user.role === 'admin' && user.active !== false
      && ((data.role && data.role !== 'admin') || data.active === false);
    if (isSelf && (data.role && data.role !== user.role)) return forbidden('Non puoi cambiare il tuo ruolo');
    if (isSelf && data.active === false) return forbidden('Non puoi disattivare te stesso');
    if (losesAdmin && await isLastActiveAdmin(user._id)) {
      return forbidden('Deve restare almeno un amministratore attivo');
    }

    const changes = [];
    if (data.role && data.role !== user.role) changes.push(`ruolo ${ROLE_INFO[user.role].label} → ${ROLE_INFO[data.role].label}`);
    if (data.active !== undefined && data.active !== (user.active !== false)) changes.push(data.active ? 'riattivato' : 'disattivato');
    if (data.name && data.name !== user.name) changes.push(`nome "${data.name}"`);
    if (data.email && data.email !== user.email) changes.push(`email ${data.email}`);
    Object.assign(user, data);
    description = `Modificato utente ${user.name}${changes.length ? `: ${changes.join(', ')}` : ''}`;
  }

  await user.save();
  await writeAudit(session, req, {
    action: 'UPDATE',
    resource: 'user',
    resourceId: id,
    description,
    meta: { action: body.action ?? 'edit' },
  });
  return NextResponse.json(toPublicUser(user.toObject(), session.user.id));
}

export async function DELETE(req, { params }) {
  const { session, denied } = await requirePermission('users:manage');
  if (denied) return denied;

  const { id } = await params;
  const { user, response } = await loadTarget(id);
  if (response) return response;

  if (String(user._id) === session.user.id) return forbidden('Non puoi eliminare te stesso');
  if (user.lastLoginAt) {
    return NextResponse.json(
      { error: 'L\'utente ha già effettuato accessi: disattivalo invece di eliminarlo' },
      { status: 409 },
    );
  }
  if (user.role === 'admin' && await isLastActiveAdmin(user._id)) {
    return forbidden('Deve restare almeno un amministratore attivo');
  }

  await User.deleteOne({ _id: user._id });
  await writeAudit(session, req, {
    action: 'DELETE',
    resource: 'user',
    resourceId: id,
    description: `Eliminato utente ${user.name} (${user.email})`,
  });
  return NextResponse.json({ message: 'Eliminato' });
}
