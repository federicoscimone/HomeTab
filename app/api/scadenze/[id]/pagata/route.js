/**
 * @fileoverview API route — /api/scadenze/[id]/pagata
 * POST — segna pagata la scadenza corrente: avanza di un periodo (o si chiude se era una
 * tantum) e azzera i promemoria mandati. Vedi advance() in lib/utils/deadlines.js.
 */

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Deadline from '@/lib/models/Deadline';
import { advance } from '@/lib/utils/deadlines';
import { dayOf } from '@/lib/utils/goalMath';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';

export async function POST(req, { params }) {
  const { session, denied } = await requirePermission('movements:edit');
  if (denied) return denied;
  const { id } = await params;
  const tErrors = await serverTranslator('errors');
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: tErrors('invalidData') }, { status: 400 });

  await connectDB();
  const current = await Deadline.findById(id).lean();
  if (!current) return NextResponse.json({ error: tErrors('deadlineNotFound') }, { status: 404 });
  const next = advance(current, dayOf(new Date()));
  // Condizionale sulla data: due clic ravvicinati non fanno avanzare di due periodi.
  const updated = await Deadline.findOneAndUpdate(
    { _id: id, nextDate: current.nextDate },
    { $set: { ...next, notified: [] } },
    { returnDocument: 'after' },
  );
  if (updated) {
    await writeAudit(session, req, {
      action: 'UPDATE', resource: 'deadline', resourceId: id,
      description: `Scadenza "${current.title}" del ${current.nextDate} segnata pagata${next.active ? `, prossima il ${next.nextDate}` : ''}`,
    });
  }
  return NextResponse.json(updated ?? await Deadline.findById(id).lean());
}
