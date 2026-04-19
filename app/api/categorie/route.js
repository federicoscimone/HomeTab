import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import Category from '@/lib/models/Category';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();
  const categories = await Category.find().sort({ level: 1, name: 1 }).lean();
  return NextResponse.json(categories);
}

export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();
  const body = await req.json();
  const category = await Category.create(body);
  return NextResponse.json(category, { status: 201 });
}
