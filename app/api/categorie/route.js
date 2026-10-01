import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Category from '@/lib/models/Category';

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
  const body = await req.json();
  const category = await Category.create(body);
  return NextResponse.json(category, { status: 201 });
}
