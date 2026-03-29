import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import ImportTemplate from '@/lib/models/ImportTemplate';

export async function GET(req, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  await connectDB();
  const { id } = await params;
  const t = await ImportTemplate.findById(id).lean();
  if (!t) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
  return NextResponse.json(t);
}

export async function PUT(req, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const t = await ImportTemplate.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!t) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
  return NextResponse.json(t);
}

export async function DELETE(req, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  await connectDB();
  const { id } = await params;
  const t = await ImportTemplate.findByIdAndDelete(id);
  if (!t) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
  return NextResponse.json({ message: 'Eliminato' });
}
