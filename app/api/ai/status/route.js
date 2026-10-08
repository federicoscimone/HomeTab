import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import AiUsage from '@/lib/models/AiUsage';
import { aiAvailability } from '@/lib/ai';
import { budgetStatus } from '@/lib/ai/budget';
import { microToUsd } from '@/lib/ai/pricing';

/**
 * Stato dell'IA per la pagina delle impostazioni: se è attiva, con quale modello, quanto si è
 * speso nel mese e le ultime chiamate. Solo numeri: il registro non contiene testi.
 */
export async function GET() {
  const { denied } = await requirePermission('settings:manage');
  if (denied) return denied;

  await connectDB();
  const { month, spentMicro, capMicro } = await budgetStatus();
  const monthStart = new Date(`${month}-01T00:00:00Z`);

  const [byOutcome, recent] = await Promise.all([
    AiUsage.aggregate([
      { $match: { createdAt: { $gte: monthStart } } },
      { $group: { _id: '$outcome', calls: { $sum: 1 } } },
    ]),
    AiUsage.find().sort({ createdAt: -1 }).limit(10)
      .select('task model outcome inputTokens outputTokens cacheReadTokens costMicro durationMs createdAt')
      .lean(),
  ]);

  return NextResponse.json({
    import: aiAvailability('importCategorize'),
    month,
    spentUsd: microToUsd(spentMicro),
    capUsd: microToUsd(capMicro),
    calls: Object.fromEntries(byOutcome.map((o) => [o._id, o.calls])),
    recent: recent.map(({ _id, costMicro, ...r }) => ({ id: String(_id), ...r, costUsd: microToUsd(costMicro) })),
  });
}
