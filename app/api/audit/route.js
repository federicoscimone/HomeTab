import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import AuditLog from '@/lib/models/AuditLog';
import { logApiError } from '@/lib/logger';
import { serverTranslator } from '@/lib/i18n/server';

export async function GET(req) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;

  await connectDB();

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit    = Math.min(100, parseInt(searchParams.get('limit') || '50'));
  const action   = searchParams.get('action');
  const resource = searchParams.get('resource');
  const from     = searchParams.get('from');
  const to       = searchParams.get('to');
  const search   = searchParams.get('search');
  const sortDir  = searchParams.get('sortDir') === 'asc' ? 1 : -1;

  const filter = {};

  if (action)   filter.action   = action;
  if (resource) filter.resource = resource;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = toDate;
    }
  }

  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ description: rx }, { userEmail: rx }];
  }

  try {
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: sortDir })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return NextResponse.json({ logs, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    logApiError('GET /api/audit', err);
    return NextResponse.json({ error: (await serverTranslator('errors'))('auditLoadFailed') }, { status: 500 });
  }
}
