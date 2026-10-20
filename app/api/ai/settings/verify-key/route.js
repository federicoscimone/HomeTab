import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import { demoBlocked } from '@/lib/demoGuard';
import connectDB from '@/lib/mongodb';
import { loadAiSettings, providerKey } from '@/lib/ai/settings';

/**
 * Verifica una chiave Anthropic chiedendo l'elenco dei modelli, una chiamata che non consuma
 * token e non costa nulla. Senza `apiKey` nel corpo verifica quella già configurata.
 *
 * @returns {{ valid: boolean|null }} null se Anthropic non ha dato una risposta chiara.
 */
export async function POST(req) {
  const { denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const blocked = await demoBlocked();
  if (blocked) return blocked;

  const body = (await req.json().catch(() => null)) ?? {};
  let apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!apiKey) {
    await connectDB();
    apiKey = providerKey('anthropic', await loadAiSettings()).apiKey || '';
  }
  if (!apiKey) return NextResponse.json({ valid: false });

  const base = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/v1/models?limit=1`, {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (res.ok) return NextResponse.json({ valid: true });
    if (res.status === 401 || res.status === 403) return NextResponse.json({ valid: false });
    return NextResponse.json({ valid: null });
  } catch {
    return NextResponse.json({ valid: null });
  }
}
