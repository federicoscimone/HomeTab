import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Category from '@/lib/models/Category';
import Movement from '@/lib/models/Movement';
import { writeAudit } from '@/lib/utils/audit';
import { pick, isInputError } from '@/lib/utils/apiInput';
import { serverTranslator } from '@/lib/i18n/server';

/** @param {string} key - Chiave del namespace "errors". */
const fail = async (key, status, values) =>
  NextResponse.json({ error: (await serverTranslator('errors'))(key, values) }, { status });

export async function PUT(req, { params }) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return fail('categoryNotFound', 404);

  await connectDB();
  // Dalla pagina si cambiano nome e colore: livello e genitore restano quelli della creazione.
  const fields = pick(await req.json().catch(() => null), ['name', 'color']);
  let category;
  try {
    category = await Category.findByIdAndUpdate(id, fields, { new: true, runValidators: true });
  } catch (err) {
    if (!isInputError(err)) throw err;
    return fail('invalidData', 400);
  }
  if (!category) return fail('categoryNotFound', 404);

  await writeAudit(session, req, {
    action: 'UPDATE',
    resource: 'category',
    resourceId: id,
    description: `Modificata categoria "${category.name}"`,
  });
  return NextResponse.json(category);
}

export async function DELETE(req, { params }) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return fail('categoryNotFound', 404);

  await connectDB();

  // Verifica se ci sono spese associate
  const usageCount = await Movement.countDocuments({
    $or: [{ categoryId: id }, { subCategory1Id: id }, { subCategory2Id: id }],
  });
  if (usageCount > 0) return fail('categoryInUse', 409, { count: usageCount });

  // Elimina anche i figli
  const children = await Category.find({ parentId: id }).sort({ name: 1 }).lean();
  for (const child of children) {
    const grandchildren = await Category.find({ parentId: child._id }).sort({ name: 1 }).lean();
    for (const gc of grandchildren) await Category.findByIdAndDelete(gc._id);
    await Category.findByIdAndDelete(child._id);
  }
  const deleted = await Category.findByIdAndDelete(id);
  if (!deleted) return fail('categoryNotFound', 404);

  await writeAudit(session, req, {
    action: 'DELETE',
    resource: 'category',
    resourceId: id,
    description: `Eliminata categoria "${deleted.name}"`,
    meta: { childrenDeleted: children.length },
  });
  return NextResponse.json({ message: (await serverTranslator('apiMessages'))('categoryDeleted') });
}
