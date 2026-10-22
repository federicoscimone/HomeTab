/**
 * @fileoverview API route — /api/obiettivi/[id]/progetto
 * PUT { items?, tasks? } — sostituisce le voci del progetto e/o le cose da fare.
 *
 * Le voci (budget e preventivi) sono una decisione sull'obiettivo: servono i permessi degli
 * obiettivi. Le cose da fare le spunta chiunque possa modificare i movimenti. Una voce o
 * un'attività che arriva con il suo `id` lo conserva, così le spese già collegate restano alla
 * voce anche dopo una modifica.
 */

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Goal from '@/lib/models/Goal';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';

const MAX_ITEMS = 50;
const MAX_TASKS = 100;
const amount = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e8;
const keepId = (id) => (typeof id === 'string' && mongoose.isValidObjectId(id) ? { _id: id } : {});

function parseItems(items) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return null;
  const out = [];
  for (const i of items) {
    if (typeof i?.name !== 'string' || !i.name.trim() || i.name.length > 100 || !amount(i.budget)) return null;
    if (i.quote != null && !amount(i.quote)) return null;
    out.push({ ...keepId(i.id), name: i.name.trim(), budget: i.budget, quote: i.quote ?? null });
  }
  return out;
}

function parseTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length > MAX_TASKS) return null;
  const out = [];
  for (const t of tasks) {
    if (typeof t?.text !== 'string' || !t.text.trim() || t.text.length > 200) return null;
    if (t.due != null && !(typeof t.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due))) return null;
    out.push({ ...keepId(t.id), text: t.text.trim(), due: t.due ?? null, done: t.done === true });
  }
  return out;
}

export async function PUT(req, { params }) {
  const body = (await req.json().catch(() => null)) ?? {};
  const needs = 'items' in body ? 'goals:manage' : 'movements:edit';
  const { session, denied } = await requirePermission(needs);
  if (denied) return denied;

  const { id } = await params;
  const tErrors = await serverTranslator('errors');
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: tErrors('goalNotFound') }, { status: 404 });

  const set = {};
  if ('items' in body) set.items = parseItems(body.items);
  if ('tasks' in body) set.tasks = parseTasks(body.tasks);
  if (!Object.keys(set).length || Object.values(set).includes(null)) {
    return NextResponse.json({ error: tErrors('invalidData') }, { status: 400 });
  }

  await connectDB();
  const goal = await Goal.findByIdAndUpdate(id, { $set: set }, { returnDocument: 'after', runValidators: true });
  if (!goal) return NextResponse.json({ error: tErrors('goalNotFound') }, { status: 404 });
  if (set.items) {
    await writeAudit(session, req, {
      action: 'UPDATE', resource: 'goal', resourceId: id,
      description: `Voci del progetto "${goal.name}": ${set.items.length} (budget ${set.items.reduce((s, i) => s + i.budget, 0).toFixed(2)} €)`,
    });
  }
  return NextResponse.json({ ok: true });
}
