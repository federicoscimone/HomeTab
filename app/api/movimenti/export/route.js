import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import { logApiError } from '@/lib/logger';
import { buildMovementFilter } from '@/lib/utils/movementFilter';
import { serverTranslator } from '@/lib/i18n/server';

export async function GET(req) {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;

  await connectDB();
  // Intestazioni e valori testuali nella lingua di chi esporta, come il resto dell'interfaccia.
  const t = await serverTranslator('movements');
  const tPay = await serverTranslator('payments');
  const col = (key) => t(`export.${key}`);

  const { searchParams } = new URL(req.url);
  const filter = buildMovementFilter(searchParams);

  try {
    const movements = await Movement.find(filter)
      .populate('categoryId',     'name')
      .populate('subCategory1Id', 'name')
      .populate('subCategory2Id', 'name')
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const rows = movements.map(m => ({
      [col('date')]:        m.date,
      [col('time')]:        m.time ?? '',
      [col('type')]:        m.type === 'income' ? col('income') : col('expense'),
      [col('amount')]:      m.type === 'expense' ? -m.amount : m.amount,
      [col('payee')]:       m.payee ?? '',
      [col('description')]: m.description ?? '',
      [col('place')]:       m.place ?? '',
      [col('method')]:      tPay.has(m.paymentMethod) ? tPay(m.paymentMethod) : m.paymentMethod,
      [col('category')]:    m.categoryId?.name ?? '',
      [col('sub1')]:        m.subCategory1Id?.name ?? '',
      [col('sub2')]:        m.subCategory2Id?.name ?? '',
      [col('notes')]:       m.notes ?? '',
      [col('excluded')]:    m.excludeFromAnalysis ? col('yes') : col('no'),
      [col('source')]:      m.source === 'import' ? col('imported') : col('manual'),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Larghezze colonne
    ws['!cols'] = [
      { wch: 12 }, { wch: 8  }, { wch: 8  }, { wch: 12 },
      { wch: 24 }, { wch: 30 }, { wch: 16 }, { wch: 18 },
      { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 30 },
      { wch: 14 }, { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, col('sheet'));

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `hometab-movimenti-${dateStr}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    logApiError('GET /api/movimenti/export', err);
    return NextResponse.json({ error: (await serverTranslator('errors'))('exportFailed') }, { status: 500 });
  }
}
