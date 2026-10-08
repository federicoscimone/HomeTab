/**
 * @fileoverview Stato di Telegram e della verifica in due passaggi per la pagina Account.
 * @module lib/services/accountSecurity
 */

import { isDemoMode } from '@/lib/demoAccounts';
import { availableChannels, botUsername, emailConfigured, telegramConfigured } from '@/lib/notify';

/**
 * @param {object} user - Documento User.
 * @returns {object} Quello che la pagina Account mostra, senza chatId né altri identificativi.
 */
export function securityOverview(user) {
  return {
    // Nella demo le credenziali sono pubbliche: collegare un Telegram personale o attivare un
    // secondo fattore su un account condiviso non ha senso, come il backup su Drive.
    demo: isDemoMode(),
    telegram: {
      configured: telegramConfigured(),
      bot: botUsername(),
      linked: Boolean(user.telegramChatId),
      linkedAt: user.telegramLinkedAt ?? null,
    },
    email: { configured: emailConfigured() },
    twoFactor: { enabled: Boolean(user.twoFactorEnabled), channel: user.twoFactorChannel ?? null },
    channels: availableChannels(user),
  };
}
