import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import logger, { logApiError } from '@/lib/logger';
import { writeAudit } from '@/lib/utils/audit';
import { randomUUID } from 'crypto';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import { getPaymentGroup } from '@/lib/utils/payments';
import { duplicateKey, isDuplicateOf, validateSplitRows } from '@/lib/utils/split';
import { serverTranslator } from '@/lib/i18n/server';
import { loadCandidates } from '@/lib/services/importDuplicates';

/**
 * POST /api/import/save
 * Body: { rows: object[], skipDuplicates: boolean }
 *
 * Le righe divise nella revisione arrivano come parti con lo stesso split.groupId: si salvano
 * tutte o nessuna, e devono sommare all'importo originale.
 *
 * I duplicati si decidono prima di salvare, sul database com'era prima di questo import. Prima il
 * controllo avveniva riga per riga mentre si salvava: la seconda di due righe identiche dello
 * stesso estratto (due caffè uguali nello stesso giorno) risultava un duplicato della prima, e la
 * seconda metà di uno split 50/50 sarebbe stata scartata.
 */
export async function POST(req) {
  const { session, denied } = await requirePermission('movements:create');
  if (denied) return denied;
  const tErrors = await serverTranslator('errors');

  const { rows, skipDuplicates } = await req.json().catch(() => ({}));
  if (!Array.isArray(rows) || rows.length === 0 || rows.some((r) => !r || typeof r !== 'object'))
    return NextResponse.json({ error: tErrors('noRowsToSave') }, { status: 400 });

  const splitError = validateSplitRows(rows);
  if (splitError) return NextResponse.json({ error: tErrors(splitError) }, { status: 400 });

  await connectDB();

  // Unità da salvare: una riga, oppure tutte le parti di uno split.
  const units = [];
  const byGroup = new Map();
  for (const row of rows) {
    const groupId = row.split?.groupId;
    if (!groupId) { units.push([row]); continue; }
    if (!byGroup.has(groupId)) { byGroup.set(groupId, []); units.push(byGroup.get(groupId)); }
    byGroup.get(groupId).push(row);
  }

  let duplicateUnits = new Set();
  if (skipDuplicates) {
    const keys = units.map((unit) => duplicateKey(unit[0]));
    const candidates = await loadCandidates(keys);
    duplicateUnits = new Set(units.filter((_, i) =>
      (candidates.get(keys[i].date) ?? []).some((m) => isDuplicateOf(keys[i], m))));
  }

  const batchId = randomUUID();
  const results = { saved: 0, duplicates: 0, errors: 0 };

  for (const unit of units) {
    if (duplicateUnits.has(unit)) { results.duplicates += 1; continue; }
    const created = [];
    try {
      for (const row of unit) created.push(await Movement.create(toMovement(row, batchId)));
      results.saved += created.length;
    } catch (err) {
      logApiError('POST /api/import/save (row)', err, { batchId, row: unit[created.length] });
      // Le parti di uno split si salvano tutte o nessuna: una parte sola sbaglierebbe il totale.
      if (created.length) await Movement.deleteMany({ _id: { $in: created.map((m) => m._id) } }).catch(() => {});
      results.errors += unit.length;
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

/** I campi di un movimento importato; il resto della riga viene ignorato. */
function toMovement(row, batchId) {
  return {
    amount:              row.amount,
    paymentMethod:       row.paymentMethod || 'other',
    paymentGroup:        getPaymentGroup(row.paymentMethod || 'other'),
    date:                row.date,
    time:                row.time || null,
    description:         row.description || '',
    place:               row.place || '',
    payee:               row.payee || '',
    notes:               row.notes || '',
    bankCategory:        typeof row.bankCategory === 'string' ? row.bankCategory.slice(0, 100) : '',
    type:                row.type || 'expense',
    categoryId:          row.categoryId || null,
    subCategory1Id:      row.subCategory1Id || null,
    subCategory2Id:      row.subCategory2Id || null,
    // La revisione lo mandava già, ma non veniva salvato: i movimenti esclusi finivano nei report.
    excludeFromAnalysis: row.excludeFromAnalysis === true,
    source:              'import',
    importMethod:        row.importMethod || null,
    importBatchId:       batchId,
    split: row.split ? {
      groupId:             row.split.groupId,
      originalAmount:      row.split.originalAmount,
      originalDescription: row.split.originalDescription ?? '',
      originalPayee:       row.split.originalPayee ?? '',
    } : null,
  };
}
