import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Category from '@/lib/models/Category';
import Movement from '@/lib/models/Movement';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';

const MAX_UPDATES = 1000;
const isId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);

/**
 * Applica le categorie confermate nella revisione dei movimenti incompleti.
 *
 * Tocca solo i movimenti ancora senza categoria: se nel frattempo qualcuno ne ha categorizzato
 * uno a mano, quella scelta resta. Le categorie devono esistere, e la sottocategoria deve essere
 * figlia della categoria.
 *
 * Body: { updates: [{ id, categoryId, subCategory1Id? }] } · Risposta: { updated, skipped }
 */
export async function POST(req) {
  const { session, denied } = await requirePermission('movements:edit');
  if (denied) return denied;
  const tErrors = await serverTranslator('errors');

  const body = await req.json().catch(() => null);
  const updates = Array.isArray(body?.updates) ? body.updates : null;
  if (!updates || updates.length === 0 || updates.length > MAX_UPDATES
    || updates.some((u) => !isId(u?.id) || !isId(u?.categoryId) || (u.subCategory1Id != null && !isId(u.subCategory1Id)))) {
    return NextResponse.json({ error: tErrors('invalidData') }, { status: 400 });
  }

  await connectDB();
  const catIds = [...new Set(updates.flatMap((u) => [u.categoryId, u.subCategory1Id].filter(Boolean)))];
  const cats = new Map((await Category.find({ _id: { $in: catIds } }).select('level parentId').lean()).map((c) => [String(c._id), c]));
  const valid = updates.filter((u) => {
    const c = cats.get(u.categoryId);
    if (!c || c.level !== 1) return false;
    if (!u.subCategory1Id) return true;
    const s = cats.get(u.subCategory1Id);
    return s && s.level === 2 && String(s.parentId) === u.categoryId;
  });

  const result = valid.length
    ? await Movement.bulkWrite(valid.map((u) => ({
      updateOne: {
        filter: { _id: u.id, categoryId: null },
        update: { $set: { categoryId: u.categoryId, subCategory1Id: u.subCategory1Id || null } },
      },
    })))
    : { modifiedCount: 0 };
  const updated = result.modifiedCount ?? 0;

  await writeAudit(session, req, {
    action: 'BULK_UPDATE',
    resource: 'movement',
    resourceId: null,
    description: `Completate le categorie di ${updated} movimenti incompleti`,
    meta: { requested: updates.length, valid: valid.length, updated },
  });
  return NextResponse.json({ updated, skipped: updates.length - updated });
}
