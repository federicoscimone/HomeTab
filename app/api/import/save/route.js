import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import logger, { logApiError } from '@/lib/logger';
import { writeAudit } from '@/lib/utils/audit';
import { randomUUID } from 'crypto';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import { getPaymentGroup } from '@/lib/utils/payments';

export async function POST(req) {
  const { session, denied } = await requirePermission('movements:create');
  if (denied) return denied;

  await connectDB();

  const { rows, skipDuplicates } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'Nessuna riga da salvare' }, { status: 400 });

  const batchId = randomUUID();
  const results = { saved: 0, duplicates: 0, errors: 0 };

  for (const row of rows) {
    try {
      // Rilevamento duplicato: stessa data + importo + testo (description o payee)
      if (skipDuplicates) {
        const textConditions = [
          row.description?.trim() ? { description: row.description.trim() } : null,
          row.payee?.trim()       ? { payee: row.payee.trim() }             : null,
        ].filter(Boolean);
        const existing = textConditions.length
          ? await Movement.findOne({ date: row.date, amount: row.amount, $or: textConditions })
          : null;
        if (existing) { results.duplicates++; continue; }
      }

      await Movement.create({
        amount:         row.amount,
        paymentMethod:  row.paymentMethod || 'other',
        paymentGroup:   getPaymentGroup(row.paymentMethod || 'other'),
        date:           row.date,
        time:           row.time || null,
        description:    row.description || '',
        place:          row.place || '',
        payee:          row.payee || '',
        notes:          row.notes || '',
        type:           row.type || 'expense',
        categoryId:     row.categoryId || null,
        subCategory1Id: row.subCategory1Id || null,
        subCategory2Id: row.subCategory2Id || null,
        source:         'import',
        importMethod:   row.importMethod || null,
        importBatchId:  batchId,
      });

      results.saved++;
    } catch (err) {
      logApiError('POST /api/import/save (row)', err, { batchId, row });
      results.errors++;
    }
  }

  logger.info('POST /api/import/save', { ...results, batchId, userId: session.user?.id });
  await writeAudit(session, req, {
    action: 'IMPORT',
    resource: 'movement',
    resourceId: batchId,
    description: `Importati ${results.saved} movimenti (${results.duplicates} duplicati, ${results.errors} errori)`,
    meta: { ...results, batchId },
  });
  return NextResponse.json({ ...results, batchId });
}
