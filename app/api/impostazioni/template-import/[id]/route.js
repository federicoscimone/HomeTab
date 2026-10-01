import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import ImportTemplate from '@/lib/models/ImportTemplate';

export async function GET(req, { params }) {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;
  await connectDB();
  const { id } = await params;
  const t = await ImportTemplate.findById(id).lean();
  if (!t) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
  return NextResponse.json(t);
}

export async function PUT(req, { params }) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const t = await ImportTemplate.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!t) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
  return NextResponse.json(t);
}

export async function DELETE(req, { params }) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  await connectDB();
  const { id } = await params;
  const t = await ImportTemplate.findByIdAndDelete(id);
  if (!t) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
  return NextResponse.json({ message: 'Eliminato' });
}
