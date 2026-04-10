import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import { writeAudit } from '@/lib/utils/audit';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * POST /api/movimenti/bulk-categorize
 *
 * Applies a keyword mapping to all existing movements that:
 *  - have no category assigned yet
 *  - match the keyword (word-boundary regex) in payee, description, or place
 *
 * Body: { keyword, caseSensitive, categoryId, subCategory1Id? }
 * Response: { updated: number }
 */
export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();

  const { keyword, caseSensitive, categoryId, subCategory1Id } = await req.json();

  if (!keyword?.trim() || !categoryId) {
    return NextResponse.json({ error: 'keyword e categoryId sono obbligatori' }, { status: 400 });
  }

  const flags = caseSensitive ? '' : 'i';
  const regex = new RegExp(`\\b${escapeRegex(keyword.trim())}`, flags);

  const result = await Movement.updateMany(
    {
      categoryId: null,
      $or: [
        { payee:        regex },
        { description:  regex },
        { place:        regex },
      ],
    },
    {
      $set: {
        categoryId:     categoryId,
        subCategory1Id: subCategory1Id || null,
      },
    },
  );

  await writeAudit(session, req, {
    action: 'BULK_UPDATE',
    resource: 'movement',
    resourceId: null,
    description: `Bulk categorizzazione "${keyword}": ${result.modifiedCount} movimenti aggiornati`,
    meta: { keyword, categoryId, subCategory1Id, updated: result.modifiedCount },
  });

  return NextResponse.json({ updated: result.modifiedCount });
}
