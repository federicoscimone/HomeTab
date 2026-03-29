import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import ImportTemplate from '@/lib/models/ImportTemplate';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  await connectDB();
  const templates = await ImportTemplate.find().sort({ name: 1 }).lean();
  return NextResponse.json(templates);
}

export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  await connectDB();
  const body = await req.json();
  const template = await ImportTemplate.create(body);
  return NextResponse.json(template, { status: 201 });
}
