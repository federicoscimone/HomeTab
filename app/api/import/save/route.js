import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { randomUUID } from 'crypto';
import connectDB from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import { getPaymentGroup } from '@/lib/utils/payments';

export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();

  const { rows, skipDuplicates } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'Nessuna riga da salvare' }, { status: 400 });

  const batchId = randomUUID();
  const results = { saved: 0, duplicates: 0, errors: 0 };

  for (const row of rows) {
    try {
      // Rilevamento duplicato: stessa data + importo + (payee o description)
      if (skipDuplicates) {
        const existing = await Expense.findOne({
          date: row.date,
          amount: row.amount,
          $or: [
            row.payee       ? { payee: row.payee }             : null,
            row.description ? { description: row.description } : null,
          ].filter(Boolean),
        });
        if (existing) { results.duplicates++; continue; }
      }

      await Expense.create({
        amount:         row.amount,
        paymentMethod:  row.paymentMethod || 'credit_card',
        paymentGroup:   getPaymentGroup(row.paymentMethod || 'credit_card'),
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
        importBatchId:  batchId,
      });

      results.saved++;
    } catch (err) {
      console.error('[import/save] row error', err);
      results.errors++;
    }
  }

  return NextResponse.json({ ...results, batchId });
}
