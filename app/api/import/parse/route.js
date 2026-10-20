import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import { logApiError } from '@/lib/logger';
import connectDB from '@/lib/mongodb';
import ImportTemplate from '@/lib/models/ImportTemplate';
import { parseExcelBuffer, parsePasteText } from '@/lib/utils/importParser';
import { localSuggester } from '@/lib/services/localCategorize';
import { importMaxBytes } from '@/lib/demoAccounts';
import { serverTranslator } from '@/lib/i18n/server';
import { aiAvailability } from '@/lib/ai';
import { loadAiSettings, resolveAiSettings } from '@/lib/ai/settings';
import { webAvailability } from '@/lib/ai/webAvailability';

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

  // Categorie in locale, senza IA: parole chiave, poi esercente nello storico, poi categoria
  // della banca (lib/services/localCategorize.js).
  const suggest = rows.length ? await localSuggester({ withBank: rows.some((r) => r.bankCategory) }) : null;
  const enriched = rows.map((row, i) => {
    const s = suggest ? suggest(row) : null;
    return {
      _rowId: i,
      ...row,
      // paymentMethod proviene dal parser (rilevato via keyword/default) o null se non rilevato
      // _methodAutoDetected è già impostato dal parser
      categoryId:     s?.categoryId     || null,
      subCategory1Id: s?.subCategory1Id || null,
      // Da dove viene la categoria: la revisione lo mostra con un segno diverso per fonte.
      ...(s?.source === 'history' ? { _histCat: true, _histSupport: s.support, _histText: s.text } : {}),
      ...(s?.source === 'bank' ? { _bankCat: true, _bankSupport: s.support } : {}),
      subCategory2Id: null,
      selected:       true,
      _autocat:       s?.source === 'keyword',
      importMethod,
    };
  });

  // La revisione chiede i suggerimenti dell'IA solo se servono e se l'IA è utilizzabile.
  const aiDoc = await loadAiSettings();
  const ai = aiAvailability('importCategorize', aiDoc);
  return NextResponse.json({
    rows: enriched,
    total: enriched.length,
    aiAvailable: ai.available,
    aiAutoSuggest: ai.available && resolveAiSettings(aiDoc).importAutoSuggest.value === true,
    ...webAvailability(aiDoc),
  });
}
