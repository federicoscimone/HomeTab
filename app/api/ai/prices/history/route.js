import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import { loadAiSettings } from '@/lib/ai/settings';
import { priceHistory } from '@/lib/services/prices';

/** Lo storico dei prezzi, modello per modello, e quando sono stati controllati l'ultima volta. */
export async function GET() {
  const { denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  await connectDB();
  const [models, doc] = await Promise.all([priceHistory(), loadAiSettings()]);
  return NextResponse.json({ models, checkedAt: doc.pricesCheckedAt ?? null });
}
