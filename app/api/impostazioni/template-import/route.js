import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import ImportTemplate from '@/lib/models/ImportTemplate';

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
  const body = await req.json();
  const template = await ImportTemplate.create(body);
  return NextResponse.json(template, { status: 201 });
}
