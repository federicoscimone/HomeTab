/**
 * @fileoverview POST /api/telegram/webhook — messaggi del bot, consegnati da Telegram o dal
 * processo di polling.
 *
 * - Webhook (TELEGRAM_WEBHOOK_SECRET impostato): Telegram rimanda il segreto nell'header
 *   X-Telegram-Bot-Api-Secret-Token, e senza di esso la richiesta non viene da Telegram.
 * - Polling: workers/telegram.js consegna ogni update con l'header X-HomeTab-Relay, un HMAC
 *   del segreto del server (relayToken in lib/telegramBot.js).
 * Risponde sempre 200 a un update autentico, anche se elaborarlo fallisce: con un errore
 * Telegram ritenterebbe lo stesso update all'infinito.
 */

import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { telegramConfigured } from '@/lib/notify/telegram';
import { handleUpdate, relayToken, webhookMode } from '@/lib/telegramBot';
import { secretMatches } from '@/lib/utils/secrets';
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale';
import { serverTranslator } from '@/lib/i18n/server';
import logger from '@/lib/logger';

/** Testi del bot nella lingua dell'utente, con next-intl. */
const text = async (locale, key, vars) =>
  (await serverTranslator('telegramBot', isLocale(locale) ? locale : DEFAULT_LOCALE))(key, vars);

export async function POST(req) {
  if (!telegramConfigured()) return new NextResponse(null, { status: 404 });
  const authorized = webhookMode()
    ? secretMatches(req.headers.get('x-telegram-bot-api-secret-token'), process.env.TELEGRAM_WEBHOOK_SECRET)
    : secretMatches(req.headers.get('x-hometab-relay'), relayToken());
  if (!authorized) return new NextResponse(null, { status: 401 });

  const update = await req.json().catch(() => null);
  try {
    await connectDB();
    await handleUpdate(update, text);
  } catch (err) {
    logger.error('Update Telegram non elaborato', { updateId: update?.update_id, error: err.message });
  }
  return NextResponse.json({ ok: true });
}
