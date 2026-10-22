/**
 * @fileoverview API route — /api/impostazioni/detrazioni
 * PUT { mappings } — { [categoryId]: tipo | null }: il tipo di detrazione delle categorie.
 * PUT { applyDefaults: true } — i tipi predefiniti per le categorie del seed che non ne hanno.
 */

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Category from '@/lib/models/Category';
import { defaultDeductionsForUnmapped } from '@/lib/services/deductions';
import { DEDUCTION_TYPES } from '@/lib/utils/deductions';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';

export async function PUT(req) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  let mappings = body?.applyDefaults === true ? null : Object.entries(body?.mappings ?? {});
  if (mappings && (mappings.length === 0 || mappings.length > 500
    || mappings.some(([id, type]) => !mongoose.isValidObjectId(id) || (type !== null && !DEDUCTION_TYPES.includes(type))))) {
    return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });
  }
  await connectDB();
  if (!mappings) mappings = await defaultDeductionsForUnmapped();
  if (mappings.length) {
    await Category.bulkWrite(mappings.map(([id, type]) => ({
      updateOne: { filter: { _id: new mongoose.Types.ObjectId(id) }, update: { $set: { deduction: type } } },
    })));
    await writeAudit(session, req, {
      action: 'UPDATE', resource: 'category', resourceId: null,
      description: `Spese detraibili: ${mappings.length} categorie ${body?.applyDefaults ? 'con i tipi predefiniti' : 'modificate'}`,
    });
  }
  return NextResponse.json({ ok: true, applied: mappings.length });
}
