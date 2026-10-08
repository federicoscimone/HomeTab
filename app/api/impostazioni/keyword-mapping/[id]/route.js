import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import KeywordMapping from '@/lib/models/KeywordMapping';
import { writeAudit } from '@/lib/utils/audit';
import { KEYWORD_FIELDS, pick, isInputError } from '@/lib/utils/apiInput';
import { serverTranslator } from '@/lib/i18n/server';

/** @param {string} key - Chiave del namespace "errors". */
const fail = async (key, status) =>
  NextResponse.json({ error: (await serverTranslator('errors'))(key) }, { status });

export async function PUT(req, { params }) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return fail('keywordNotFound', 404);
  await connectDB();
  const fields = pick(await req.json().catch(() => null), KEYWORD_FIELDS);
  if (!fields.subCategory1Id) fields.subCategory1Id = null;
  let m;
  try {
    m = await KeywordMapping.findByIdAndUpdate(id, fields, { returnDocument: 'after', runValidators: true });
  } catch (err) {
    if (!isInputError(err)) throw err;
    return fail('invalidData', 400);
  }
  if (!m) return fail('keywordNotFound', 404);
  await writeAudit(session, req, {
    action: 'UPDATE',
    resource: 'keyword',
    resourceId: id,
    description: `Modificata keyword "${m.keyword}"`,
    meta: { categoryId: m.categoryId, priority: m.priority },
  });
  return NextResponse.json(m);
}

export async function DELETE(req, { params }) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return fail('keywordNotFound', 404);
  await connectDB();
  const m = await KeywordMapping.findByIdAndDelete(id);
  if (!m) return fail('keywordNotFound', 404);
  await writeAudit(session, req, {
    action: 'DELETE',
    resource: 'keyword',
    resourceId: id,
    description: `Eliminata keyword "${m.keyword}"`,
  });
  return NextResponse.json({ message: (await serverTranslator('apiMessages'))('keywordDeleted') });
}
