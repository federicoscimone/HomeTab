import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import { demoBlocked } from '@/lib/demoGuard';
import connectDB from '@/lib/mongodb';
import { providerById } from '@/lib/ai/providers';
import { loadAiSettings, providerKey, resolveAiSettings } from '@/lib/ai/settings';
import { ollamaUrl } from '@/lib/ai/settingsInput';

/**
 * Verifica la chiave di un fornitore chiedendo l'elenco dei modelli, una chiamata che non
 * consuma token e non costa nulla; per Ollama, che risponda all'indirizzo. Senza `secret` nel
 * corpo verifica la chiave (o l'indirizzo) già configurata.
 *
 * @returns {{ valid: boolean|null }} null se il fornitore non ha dato una risposta chiara.
 */
export async function POST(req) {
  const { denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const blocked = await demoBlocked();
  if (blocked) return blocked;

  const body = (await req.json().catch(() => null)) ?? {};
  const provider = providerById(body.provider);
  if (!provider) return NextResponse.json({ valid: false });
  let secret = typeof body.secret === 'string' ? body.secret.trim() : '';
  // Per Ollama il «segreto» è l'indirizzo: solo http(s), come quello che si salva.
  if (secret && provider.local) secret = ollamaUrl(secret) ?? '';
  if (!secret && !body.secret) {
    await connectDB();
    const doc = await loadAiSettings();
    secret = (provider.local ? resolveAiSettings(doc).ollamaBaseUrl.value : providerKey(body.provider, doc).apiKey) || '';
  }
  if (!secret) return NextResponse.json({ valid: false });
  return NextResponse.json(await provider.verify(secret));
}
