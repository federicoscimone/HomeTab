import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import ImportTemplate from '@/lib/models/ImportTemplate';
import { writeAudit } from '@/lib/utils/audit';
import { TEMPLATE_FIELDS, pick, isInputError } from '@/lib/utils/apiInput';
import { serverTranslator } from '@/lib/i18n/server';

export async function GET() {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;
  await connectDB();
  const templates = await ImportTemplate.find().sort({ name: 1 }).lean();
  return NextResponse.json(templates);
}

export async function POST(req) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  await connectDB();
  try {
    const template = await ImportTemplate.create(pick(await req.json().catch(() => null), TEMPLATE_FIELDS));
    await writeAudit(session, req, {
      action: 'CREATE',
      resource: 'template',
      resourceId: template._id,
      description: `Creato template di import "${template.name}"`,
      meta: { fileType: template.fileType },
    });
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    if (!isInputError(err)) throw err;
    return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });
  }
}
