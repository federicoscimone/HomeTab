import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';

/**
 * POST /api/import/check-duplicates
 * Body: { rows: [{ date, amount, payee, description }] }
 * Response: { duplicates: boolean[] }  — array parallelo alle righe in input
 *
 * Per ogni riga cerca un movement con stessa data + importo + (description o payee).
 * Usa query dirette per-riga invece di confronto batch JS, per massima affidabilità.
 */
export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { rows } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ duplicates: [] });

  await connectDB();

  // Pre-filtro: carica tutti i movimenti che potrebbero essere duplicati,
  // usando le date dell'import come filtro iniziale per ridurre i risultati.
  const dates = [...new Set(rows.map(r => r.date))];
  const candidates = await Movement.find(
    { date: { $in: dates } },
    { date: 1, amount: 1, description: 1, payee: 1 },
  ).lean();

  // Raggruppa i candidati per data → lookup O(1) per data
  const byDate = new Map();
  for (const m of candidates) {
    if (!byDate.has(m.date)) byDate.set(m.date, []);
    byDate.get(m.date).push(m);
  }

  const duplicates = rows.map(r => {
    const bucket = byDate.get(r.date);
    if (!bucket) return false;

    // Testi identificativi della riga importata (trim + lowercase)
    const rDesc = (r.description || '').trim().toLowerCase();
    const rPay  = (r.payee  || '').trim().toLowerCase();
    // Arrotonda l'importo per evitare errori floating-point da Excel
    const rAmt  = Math.round(Number(r.amount) * 100);

    for (const m of bucket) {
      const mAmt  = Math.round(Number(m.amount) * 100);
      if (mAmt !== rAmt) continue;

      const mDesc = (m.description || '').trim().toLowerCase();
      const mPay  = (m.payee  || '').trim().toLowerCase();

      // Match se uno qualsiasi dei campi testuali non vuoti coincide
      if (rDesc && (rDesc === mDesc || rDesc === mPay)) return true;
      if (rPay  && (rPay  === mDesc || rPay  === mPay))  return true;
    }
    return false;
  });

  return NextResponse.json({ duplicates });
}
