/**
 * @fileoverview API route — /api/scadenze
 * GET  — tutte le scadenze, con quote da accantonare, pagamenti riconosciuti e totali.
 * POST — nuova scadenza. Vedi lib/services/deadlines.js.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Deadline from '@/lib/models/Deadline';
import { listDeadlines, parseDeadline } from '@/lib/services/deadlines';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';

export async function GET() {
  const { denied } = await requirePermission('data:read');
  if (denied) return denied;
  await connectDB();
  return NextResponse.json(await listDeadlines());
}

export async function POST(req) {
  const { session, denied } = await requirePermission('movements:edit');
  if (denied) return denied;
  const { data, error } = parseDeadline(await req.json().catch(() => null));
  if (error) return NextResponse.json({ error: (await serverTranslator('errors'))(error) }, { status: 400 });

  await connectDB();
  const deadline = await Deadline.create(data);
  await writeAudit(session, req, {
    action: 'CREATE',
    resource: 'deadline',
    resourceId: deadline._id,
    description: `Creata scadenza "${deadline.title}" il ${deadline.nextDate}`,
  });
  return NextResponse.json(deadline, { status: 201 });
}
