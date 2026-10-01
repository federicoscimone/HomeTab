import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Category from '@/lib/models/Category';
import Movement from '@/lib/models/Movement';
import { writeAudit } from '@/lib/utils/audit';

export async function PUT(req, { params }) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const category = await Category.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!category) return NextResponse.json({ error: 'Non trovata' }, { status: 404 });

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

  await connectDB();
  const { id } = await params;

  // Verifica se ci sono spese associate
  const usageCount = await Movement.countDocuments({
    $or: [{ categoryId: id }, { subCategory1Id: id }, { subCategory2Id: id }],
  });
  if (usageCount > 0)
    return NextResponse.json(
      { error: `Impossibile eliminare: ${usageCount} spese usano questa categoria` },
      { status: 409 }
    );

  // Elimina anche i figli
  const children = await Category.find({ parentId: id }).sort({ name: 1 }).lean();
  for (const child of children) {
    const grandchildren = await Category.find({ parentId: child._id }).sort({ name: 1 }).lean();
    for (const gc of grandchildren) await Category.findByIdAndDelete(gc._id);
    await Category.findByIdAndDelete(child._id);
  }
  const deleted = await Category.findByIdAndDelete(id);

  await writeAudit(session, req, {
    action: 'DELETE',
    resource: 'category',
    resourceId: id,
    description: `Eliminata categoria "${deleted?.name ?? id}"`,
    meta: { childrenDeleted: children.length },
  });
  return NextResponse.json({ message: 'Eliminata' });
}
