import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import Category from '@/lib/models/Category';
import Expense from '@/lib/models/Expense';

export async function PUT(req, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const category = await Category.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!category) return NextResponse.json({ error: 'Non trovata' }, { status: 404 });
  return NextResponse.json(category);
}

export async function DELETE(req, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();
  const { id } = await params;

  // Verifica se ci sono spese associate
  const usageCount = await Expense.countDocuments({
    $or: [{ categoryId: id }, { subCategory1Id: id }, { subCategory2Id: id }],
  });
  if (usageCount > 0)
    return NextResponse.json(
      { error: `Impossibile eliminare: ${usageCount} spese usano questa categoria` },
      { status: 409 }
    );

  // Elimina anche i figli
  const children = await Category.find({ parentId: id }).lean();
  for (const child of children) {
    const grandchildren = await Category.find({ parentId: child._id }).lean();
    for (const gc of grandchildren) await Category.findByIdAndDelete(gc._id);
    await Category.findByIdAndDelete(child._id);
  }
  await Category.findByIdAndDelete(id);

  return NextResponse.json({ message: 'Eliminata' });
}
