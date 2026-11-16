/**
 * @fileoverview /api/impostazioni/telegram — il bot Telegram dell'installazione.
 * GET    — la configurazione in uso (mai il token: da dove viene e le ultime 4 cifre) e lo stato
 *          della ricezione.
 * PUT    — { token?, mode }: salva il token cifrato (verificato prima con getMe, che dà anche il
 *          nome del bot) e il modo di ricezione. Senza token si cambia solo il modo.
 * DELETE — toglie la configurazione salvata: tornano a valere le variabili d'ambiente.
 *
 * Solo amministratori, e mai nella demo pubblica. La ricezione si adegua da sola entro 30 secondi
 * (lib/telegramPolling.js); in questo processo subito.
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requirePermission } from '@/lib/auth/guard';
import { demoBlocked } from '@/lib/demoGuard';
import { isDemoMode } from '@/lib/demoAccounts';
import connectDB from '@/lib/mongodb';
import TelegramSettings from '@/lib/models/TelegramSettings';
import BotState from '@/lib/models/BotState';
import User from '@/lib/models/User';
import { encryptSecret } from '@/lib/utils/crypto';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';
import { telegramCall, telegramRuntime } from '@/lib/notify/telegram';
import { publicBaseUrl, webhookUrl } from '@/lib/telegramBot';
import { loadTelegramSettings, runtimeFrom } from '@/lib/services/telegramSettings';
import { telegramSettingsInput } from '@/lib/utils/telegramSettingsInput';

/** Oltre questo intervallo senza contatti con Telegram la ricezione si considera ferma. */
const ACTIVE_MS = 2 * 60 * 1000;

const fail = async (key, status = 400, vars) =>
  NextResponse.json({ error: (await serverTranslator('errors'))(key, vars) }, { status });

async function settingsView(userId) {
  const runtime = await loadTelegramSettings({ force: true });
  const [doc, receiver, linkedUsers, twoFactorUsers, me] = await Promise.all([
    TelegramSettings.findById('telegram').lean(),
    BotState.findById('receiver').lean(),
    User.countDocuments({ telegramChatId: { $ne: null } }),
    User.countDocuments({ twoFactorEnabled: true, twoFactorChannel: 'telegram' }),
    User.findById(userId).select('telegramChatId').lean(),
  ]);
  const base = publicBaseUrl();
  const lastContact = receiver?.lastContactAt ? new Date(receiver.lastContactAt) : null;
  return {
    demo: isDemoMode(),
    source: runtime.source,
    bot: runtime.username,
    mode: runtime.mode,
    saved: doc?.tokenEnc ? {
      hint: doc.tokenHint, botUsername: doc.botUsername, botName: doc.botName, mode: doc.mode,
      updatedAt: doc.updatedAt, unreadable: !runtimeFrom(doc),
    } : null,
    envConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME),
    webhook: { possible: Boolean(webhookUrl(base, 'x')), base: base ?? null },
    receiver: {
      active: Boolean(lastContact && Date.now() - lastContact.getTime() < ACTIVE_MS && receiver?.bot === runtime.username),
      mode: receiver?.mode ?? null,
      lastContactAt: lastContact,
      lastError: receiver?.lastError ?? null,
    },
    linkedUsers,
    twoFactorUsers,
    meLinked: Boolean(me?.telegramChatId),
  };
}

export async function GET() {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  await connectDB();
  return NextResponse.json(await settingsView(session.user.id));
}

export async function PUT(req) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const blocked = await demoBlocked();
  if (blocked) return blocked;

  const { data, error } = telegramSettingsInput(await req.json().catch(() => null));
  if (error) return fail(error);

  await connectDB();
  const doc = await TelegramSettings.findById('telegram');
  if (!data.token && !doc?.tokenEnc) return fail('telegramTokenRequired');
  if (data.mode === 'webhook' && !webhookUrl(publicBaseUrl(), 'x')) return fail('telegramWebhookNeedsHttps');

  const update = { mode: data.mode };
  if (data.token) {
    // Il token si prova prima di salvarlo: getMe risponde solo a un token valido, e dà il nome.
    let me;
    try {
      me = await telegramCall('getMe', {}, { token: data.token });
    } catch {
      return fail('telegramTokenInvalid');
    }
    if (!me?.is_bot || !me.username) return fail('telegramTokenInvalid');
    Object.assign(update, {
      tokenEnc: encryptSecret(data.token),
      tokenHint: data.token.slice(-4),
      botUsername: me.username,
      botName: me.first_name ?? me.username,
    });
  }
  // Il segreto del webhook lo genera l'app: nessuno deve sceglierlo né conoscerlo.
  if (data.mode === 'webhook' && !doc?.webhookSecretEnc) {
    update.webhookSecretEnc = encryptSecret(crypto.randomBytes(32).toString('hex'));
  }

  const previousBot = doc?.botUsername ?? telegramRuntime().username;
  await TelegramSettings.findByIdAndUpdate('telegram', { $set: update }, { upsert: true });
  await loadTelegramSettings({ force: true });

  const bot = update.botUsername ?? doc?.botUsername;
  await writeAudit(session, req, {
    action: 'UPDATE',
    resource: 'system',
    resourceId: 'telegram',
    description: `Configurato il bot Telegram @${bot} (${data.mode === 'webhook' ? 'webhook' : 'polling'})${data.token ? ', token sostituito' : ''}`,
    meta: { bot, mode: data.mode, tokenReplaced: Boolean(data.token), botChanged: Boolean(previousBot && bot !== previousBot) },
  });
  return NextResponse.json(await settingsView(session.user.id));
}

export async function DELETE(req) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const blocked = await demoBlocked();
  if (blocked) return blocked;

  await connectDB();
  const removed = await TelegramSettings.findByIdAndDelete('telegram');
  await loadTelegramSettings({ force: true });
  if (removed) {
    await writeAudit(session, req, {
      action: 'UPDATE', resource: 'system', resourceId: 'telegram',
      description: `Tolta la configurazione del bot Telegram @${removed.botUsername}`,
    });
  }
  return NextResponse.json(await settingsView(session.user.id));
}
