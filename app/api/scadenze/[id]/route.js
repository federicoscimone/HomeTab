/**
 * @fileoverview API route — /api/scadenze/[id]
 * PATCH  — modifica i campi presenti nel body.
 * DELETE — elimina la scadenza.
 */

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Deadline from '@/lib/models/Deadline';
import { parseDeadline } from '@/lib/services/deadlines';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';

export async function PATCH(req, { params }) {
  const { session, denied } = await requirePermission('movements:edit');
  if (denied) return denied;
  const { id } = await params;
  const tErrors = await serverTranslator('errors');
  const { data, error } = parseDeadline(await req.json().catch(() => null), true);
  if (error || !mongoose.isValidObjectId(id)) return NextResponse.json({ error: tErrors(error ?? 'invalidData') }, { status: 400 });

  await connectDB();
  const deadline = await Deadline.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', runValidators: true });
  if (!deadline) return NextResponse.json({ error: tErrors('deadlineNotFound') }, { status: 404 });
  await writeAudit(session, req, {
    action: 'UPDATE', resource: 'deadline', resourceId: id,
    description: `Modificata scadenza "${deadline.title}": ${Object.keys(data).filter((k) => k !== 'notified').join(', ')}`,
  });
  return NextResponse.json(deadline);
}

export async function DELETE(req, { params }) {
  const { session, denied } = await requirePermission('movements:edit');
  if (denied) return denied;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });
  await connectDB();
  const deadline = await Deadline.findByIdAndDelete(id);
  if (!deadline) return NextResponse.json({ error: (await serverTranslator('errors'))('deadlineNotFound') }, { status: 404 });
  await writeAudit(session, req, {
    action: 'DELETE', resource: 'deadline', resourceId: id, description: `Eliminata scadenza "${deadline.title}"`,
  });
  return NextResponse.json({ ok: true });
}
