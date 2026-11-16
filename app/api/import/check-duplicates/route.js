import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import { loadCandidates } from '@/lib/services/importDuplicates';
import { duplicateKey, isDuplicateOf } from '@/lib/utils/split';

/**
 * POST /api/import/check-duplicates
 * Body: { rows: [{ date, amount, payee, description }] }
 * Response: { duplicates: boolean[] }  — array parallelo alle righe in input
 *
 * Una riga è già presente se un movimento ha stessa data, stesso importo e una descrizione o un
 * esercente uguale (lib/utils/split.js, isDuplicateOf). Un movimento diviso si riconosce dal suo
 * originale: la banca riporta la riga intera.
 */
export async function POST(req) {
  const { denied } = await requirePermission('movements:create');
  if (denied) return denied;

  const { rows } = await req.json().catch(() => ({}));
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ duplicates: [] });

  await connectDB();
  const keys = rows.map((r) => duplicateKey(r ?? {}));
  const candidates = await loadCandidates(keys);
  return NextResponse.json({
    duplicates: keys.map((k) => (candidates.get(k.date) ?? []).some((m) => isDuplicateOf(k, m))),
  });
}

