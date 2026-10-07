/**
 * @fileoverview GET /api/import/sample — estratto conto CSV di esempio per provare l'import.
 *
 * Esiste solo in DEMO_MODE, dove il seed crea il template che sa leggerlo (lib/demoImport.js).
 * Il file si genera a ogni richiesta: le date restano degli ultimi giorni e l'ultima riga ripete
 * un'uscita già presente, così la revisione mostra anche il riconoscimento dei doppioni.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import { isDemoMode } from '@/lib/demoAccounts';
import { demoImportSample } from '@/lib/demoImport';

export async function GET() {
  const { denied } = await requirePermission('movements:create');
  if (denied) return denied;
  if (!isDemoMode()) return new NextResponse(null, { status: 404 });

  await connectDB();
  const latest = await Movement.findOne({ type: 'expense', payee: { $ne: '' } })
    .sort({ date: -1, createdAt: -1 })
    .select('date amount payee description')
    .lean();

  return new NextResponse(demoImportSample(new Date(), latest), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="hometab-estratto-conto-esempio.csv"',
    },
  });
}
