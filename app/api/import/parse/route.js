import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import { logApiError } from '@/lib/logger';
import connectDB from '@/lib/mongodb';
import ImportTemplate from '@/lib/models/ImportTemplate';
import KeywordMapping from '@/lib/models/KeywordMapping';
import { parseExcelBuffer, parsePasteText } from '@/lib/utils/importParser';
import { autoCategorize } from '@/lib/utils/autoCategorize';
import { importMaxBytes } from '@/lib/demoAccounts';
import { serverTranslator } from '@/lib/i18n/server';

export async function POST(req) {
  const { session, denied } = await requirePermission('movements:create');
  if (denied) return denied;

  await connectDB();
  const tErrors = await serverTranslator('errors');

  const formData = await req.formData();
  const templateId = formData.get('templateId');
  const pasteText  = formData.get('pasteText');
  const file       = formData.get('file');

  if (!templateId)
    return NextResponse.json({ error: tErrors('templateRequired') }, { status: 400 });

  // Un id malformato farebbe fallire findById con un errore di cast (500): è un template che non c'è.
  const template = mongoose.isValidObjectId(templateId) ? await ImportTemplate.findById(templateId).lean() : null;
  if (!template)
    return NextResponse.json({ error: tErrors('templateNotFound') }, { status: 404 });

  // Carica keyword mappings ordinati per priorità
  const mappings = await KeywordMapping.find()
    .populate('categoryId', 'name color')
    .populate('subCategory1Id', 'name')
    .sort({ priority: -1 })
    .lean();

  // Il file intero passa in memoria per il parsing: senza limite un file enorme bloccherebbe la
  // richiesta, e nella demo pubblica chiunque può caricarne uno.
  const maxBytes = importMaxBytes();
  const inputBytes = file && file.size > 0 ? file.size : Buffer.byteLength(pasteText || '', 'utf8');
  if (inputBytes > maxBytes) {
    return NextResponse.json(
      { error: tErrors('fileTooLarge', { mb: Math.round(maxBytes / 1024 / 1024) }) },
      { status: 413 },
    );
  }

  let rows = [];

  try {
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      rows = parseExcelBuffer(buffer, template);
    } else if (pasteText) {
      rows = parsePasteText(pasteText, template);
    } else {
      return NextResponse.json({ error: tErrors('noDataProvided') }, { status: 400 });
    }
  } catch (err) {
    logApiError('POST /api/import/parse', err, { templateId });
    return NextResponse.json({ error: tErrors('parseError', { message: err.message }) }, { status: 400 });
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
