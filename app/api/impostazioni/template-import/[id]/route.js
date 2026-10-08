import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import ImportTemplate from '@/lib/models/ImportTemplate';
import { writeAudit } from '@/lib/utils/audit';
import { TEMPLATE_FIELDS, pick, isInputError } from '@/lib/utils/apiInput';
import { serverTranslator } from '@/lib/i18n/server';

/** @param {string} key - Chiave del namespace "errors". */
const fail = async (key, status) =>
  NextResponse.json({ error: (await serverTranslator('errors'))(key) }, { status });

export async function GET(req, { params }) {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return fail('templateNotFound', 404);
  await connectDB();
  const t = await ImportTemplate.findById(id).lean();
  if (!t) return fail('templateNotFound', 404);
  return NextResponse.json(t);
}

export async function PUT(req, { params }) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return fail('templateNotFound', 404);
  await connectDB();
  let t;
  try {
    t = await ImportTemplate.findByIdAndUpdate(
      id, pick(await req.json().catch(() => null), TEMPLATE_FIELDS), { new: true, runValidators: true },
    );
  } catch (err) {
    if (!isInputError(err)) throw err;
    return fail('invalidData', 400);
  }
  if (!t) return fail('templateNotFound', 404);
  await writeAudit(session, req, {
    action: 'UPDATE',
    resource: 'template',
    resourceId: id,
    description: `Modificato template di import "${t.name}"`,
  });
  return NextResponse.json(t);
}

export async function DELETE(req, { params }) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return fail('templateNotFound', 404);
  await connectDB();
  const t = await ImportTemplate.findByIdAndDelete(id);
  if (!t) return fail('templateNotFound', 404);
  await writeAudit(session, req, {
    action: 'DELETE',
    resource: 'template',
    resourceId: id,
    description: `Eliminato template di import "${t.name}"`,
  });
  return NextResponse.json({ message: (await serverTranslator('apiMessages'))('templateDeleted') });
}
