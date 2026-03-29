import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import KeywordMapping from '@/lib/models/KeywordMapping';

export async function PUT(req, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  await connectDB();
  const { id } = await params;
  const body = await req.json();
  if (!body.subCategory1Id) body.subCategory1Id = null;
  const m = await KeywordMapping.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!m) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
  return NextResponse.json(m);
}

export async function DELETE(req, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  await connectDB();
  const { id } = await params;
  const m = await KeywordMapping.findByIdAndDelete(id);
  if (!m) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
  return NextResponse.json({ message: 'Eliminato' });
}
