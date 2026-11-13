/**
 * Reset notturno della vetrina (DEMO_MODE=true) su un server proprio: su Vercel lo fa il cron di
 * vercel.json. Chiama /api/demo/reset una volta al giorno, all'ora UTC di DEMO_RESET_HOUR_UTC
 * (default 3, come su Vercel). Nel compose è il servizio `demo-reset`, sotto il profilo "demo".
 *
 * L'endpoint fa da sé tutti i controlli (DEMO_MODE, segreto, presenza dell'account demo): qui c'è
 * solo l'orario. Con --now esegue un reset subito ed esce (per provarlo o forzarlo a mano).
 */

const url = process.env.DEMO_RESET_URL || 'http://app:3000/api/demo/reset';
const secret = process.env.CRON_SECRET;
const hourUtc = Number(process.env.DEMO_RESET_HOUR_UTC ?? 3);

if (!secret) {
  console.error('[demo-reset] CRON_SECRET è obbligatorio');
  process.exit(1);
}
if (!Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23) {
  console.error('[demo-reset] DEMO_RESET_HOUR_UTC deve essere un intero tra 0 e 23');
  process.exit(1);
}

/** @returns {Promise<boolean>} true se l'app ha risposto 2xx. */
async function reset() {
  try {
    // Il seed richiede qualche secondo: margine ampio, ma un'app bloccata non ferma il worker.
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(120_000),
    });
    console.log(`[demo-reset] ${new Date().toISOString()} risposta ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error(`[demo-reset] ${new Date().toISOString()} errore: ${err.message}`);
    return false;
  }
}

/** Millisecondi fino alla prossima occorrenza di hourUtc:00 UTC. */
function msUntilNext() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(hourUtc, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next - now;
}

function schedule() {
  const ms = msUntilNext();
  console.log(`[demo-reset] prossimo reset tra ${Math.round(ms / 60_000)} minuti`);
  setTimeout(async () => {
    await reset();
    schedule();
  }, ms);
}

if (process.argv.includes('--now')) {
  process.exit((await reset()) ? 0 : 1);
} else {
  schedule();
}
