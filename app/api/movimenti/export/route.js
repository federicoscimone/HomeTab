import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import { PAYMENT_METHODS } from '@/lib/utils/payments';
import { logApiError } from '@/lib/logger';

const PAYMENT_LABEL = Object.fromEntries(PAYMENT_METHODS.map(m => [m.value, m.label]));

const TYPE_LABEL = { expense: 'Uscita', income: 'Entrata' };

export async function GET(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();

  const { searchParams } = new URL(req.url);
  const from          = searchParams.get('from');
  const to            = searchParams.get('to');
  const categoryIds   = searchParams.get('categoryIds') ? searchParams.get('categoryIds').split(',').filter(Boolean) : [];
  const paymentMethod = searchParams.get('paymentMethod');
  const paymentGroup  = searchParams.get('paymentGroup');
  const search        = searchParams.get('search');
  const type          = searchParams.get('type');
  const incomplete    = searchParams.get('incomplete') === '1';
  const excludeFromAnalysis = searchParams.get('excludeFromAnalysis') === '1';

  const filter = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to)   filter.date.$lte = to;
  }
  if (categoryIds.length > 0) {
    filter.$or = [
      { categoryId: { $in: categoryIds } },
      { subCategory1Id: { $in: categoryIds } },
      { subCategory2Id: { $in: categoryIds } }
    ];
  }
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (paymentGroup)  filter.paymentGroup  = paymentGroup;
  if (type)          filter.type = type;
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ payee: rx }, { description: rx }, { place: rx }, { notes: rx }];
  }
  if (incomplete) filter.categoryId = null;
  if (excludeFromAnalysis) filter.excludeFromAnalysis = true;

  try {
    const movements = await Movement.find(filter)
      .populate('categoryId',     'name')
      .populate('subCategory1Id', 'name')
      .populate('subCategory2Id', 'name')
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const rows = movements.map(m => ({
      'Data':              m.date,
      'Ora':               m.time ?? '',
      'Tipo':              TYPE_LABEL[m.type] ?? m.type,
      'Importo (€)':       m.type === 'expense' ? -m.amount : m.amount,
      'Esercente':         m.payee ?? '',
      'Causale':           m.description ?? '',
      'Luogo':             m.place ?? '',
      'Metodo pagamento':  PAYMENT_LABEL[m.paymentMethod] ?? m.paymentMethod,
      'Categoria':         m.categoryId?.name ?? '',
      'Sotto-cat 1':       m.subCategory1Id?.name ?? '',
      'Sotto-cat 2':       m.subCategory2Id?.name ?? '',
      'Note':              m.notes ?? '',
      'Escluso analisi':   m.excludeFromAnalysis ? 'Sì' : 'No',
      'Origine':           m.source === 'import' ? 'Importazione' : 'Manuale',
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
    XLSX.utils.book_append_sheet(wb, ws, 'Movimenti');

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
    return NextResponse.json({ error: 'Errore durante l\'esportazione' }, { status: 500 });
  }
}
