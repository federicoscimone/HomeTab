import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { logApiError } from '@/lib/logger';
import connectDB from '@/lib/mongodb';
import ImportTemplate from '@/lib/models/ImportTemplate';
import KeywordMapping from '@/lib/models/KeywordMapping';
import { parseExcelBuffer, parsePasteText } from '@/lib/utils/importParser';
import { autoCategorize } from '@/lib/utils/autoCategorize';

export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();

  const formData = await req.formData();
  const templateId = formData.get('templateId');
  const pasteText  = formData.get('pasteText');
  const file       = formData.get('file');

  if (!templateId)
    return NextResponse.json({ error: 'Seleziona un template' }, { status: 400 });

  const template = await ImportTemplate.findById(templateId).lean();
  if (!template)
    return NextResponse.json({ error: 'Template non trovato' }, { status: 404 });

  // Carica keyword mappings ordinati per priorità
  const mappings = await KeywordMapping.find()
    .populate('categoryId', 'name color')
    .populate('subCategory1Id', 'name')
    .sort({ priority: -1 })
    .lean();

  let rows = [];

  try {
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      rows = parseExcelBuffer(buffer, template);
    } else if (pasteText) {
      rows = parsePasteText(pasteText, template);
    } else {
      return NextResponse.json({ error: 'Nessun dato fornito' }, { status: 400 });
    }
  } catch (err) {
    logApiError('POST /api/import/parse', err, { templateId });
    return NextResponse.json({ error: `Errore parsing: ${err.message}` }, { status: 400 });
  }

  // Determina metodo di caricamento dal tipo file / input
  const importMethod = (file && file.size > 0)
    ? (template.fileType === 'csv' ? 'csv' : 'xlsx')
    : 'paste';

  // Applica auto-categorizzazione
  const enriched = rows.map((row, i) => {
    const cat = autoCategorize(row, mappings);
    return {
      _rowId: i,
      ...row,
      // paymentMethod proviene dal parser (rilevato via keyword/default) o null se non rilevato
      // _methodAutoDetected è già impostato dal parser
      categoryId:     cat?.categoryId     || null,
      subCategory1Id: cat?.subCategory1Id || null,
      subCategory2Id: null,
      selected:       true,
      _autocat:       !!cat,
      importMethod,
    };
  });

  return NextResponse.json({ rows: enriched, total: enriched.length });
}
