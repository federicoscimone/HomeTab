import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import KeywordMapping from '@/lib/models/KeywordMapping';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  await connectDB();
  const mappings = await KeywordMapping.find()
    .populate('categoryId', 'name color')
    .populate('subCategory1Id', 'name')
    .sort({ priority: -1, keyword: 1 })
    .lean();
  return NextResponse.json(mappings);
}

export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  await connectDB();
  const body = await req.json();
  if (!body.subCategory1Id) body.subCategory1Id = null;
  const mapping = await KeywordMapping.create(body);
  return NextResponse.json(mapping, { status: 201 });
}
