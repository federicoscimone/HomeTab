import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Category from '@/lib/models/Category';
import { writeAudit } from '@/lib/utils/audit';
import { pick, isInputError } from '@/lib/utils/apiInput';
import { serverTranslator } from '@/lib/i18n/server';

export async function GET() {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;

  await connectDB();
  const categories = await Category.find().sort({ level: 1, name: 1 }).lean();
  return NextResponse.json(categories);
}

export async function POST(req) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;

  await connectDB();
  const body = await req.json().catch(() => null);
  try {
    const category = await Category.create(pick(body, ['name', 'color', 'level', 'parentId']));
    await writeAudit(session, req, {
      action: 'CREATE',
      resource: 'category',
      resourceId: category._id,
      description: `Creata categoria "${category.name}"`,
      meta: { level: category.level, parentId: category.parentId },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    if (!isInputError(err)) throw err;
    return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });
  }
}
