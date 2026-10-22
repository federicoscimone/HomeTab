import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import { demoBlocked } from '@/lib/demoGuard';
import connectDB from '@/lib/mongodb';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';
import { applyPriceCheck } from '@/lib/services/prices';

/**
 * «Aggiorna i prezzi», secondo passo: applica il controllo indicato. Si applica per id, così si
 * salva esattamente ciò che il server ha letto e verificato, non valori rimandati dal browser.
 */
export async function POST(req) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const blocked = await demoBlocked();
  if (blocked) return blocked;

  const { checkId } = (await req.json().catch(() => null)) ?? {};
  if (typeof checkId !== 'string' || !/^[a-f0-9]{24}$/.test(checkId)) {
    return NextResponse.json({ error: (await serverTranslator('errors'))('priceCheckExpired') }, { status: 400 });
  }
  await connectDB();
  const result = await applyPriceCheck(checkId, session.user.id);
  if (!result) return NextResponse.json({ error: (await serverTranslator('errors'))('priceCheckExpired') }, { status: 409 });

  await writeAudit(session, req, {
    action: 'UPDATE',
    resource: 'system',
    resourceId: 'ai',
    description: `Prezzi dei modelli aggiornati dalle pagine ufficiali: ${result.applied}`,
    meta: { checkId, applied: result.applied },
  });
  return NextResponse.json(result);
}
