/**
 * @fileoverview Nodemailer-based email helpers for auth flows.
 * All SMTP configuration is read from environment variables at call time.
 *
 * Le email partono nella lingua salvata sul profilo dell'utente (User.locale); se non ne ha
 * scelta una, in quella della richiesta che le ha generate.
 * @module lib/email
 */

import nodemailer from 'nodemailer';
import { isLocale } from '@/lib/i18n/locale';
import { requestLocale, serverTranslator } from '@/lib/i18n/server';

const APP_NAME = 'HomeTab';
const RESET_LINK_MINUTES = 60;

/**
 * Creates a Nodemailer transporter from SMTP environment variables.
 *
 * @returns {import('nodemailer').Transporter}
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true per porta 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Ogni testo inserito nell'HTML passa da qui. Il nome dell'utente lo imposta un amministratore:
 * prima finiva nell'HTML così com'era, e un nome con dei tag sarebbe diventato markup nell'email.
 */
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/** @param {string|null|undefined} locale */
async function emailTranslator(locale) {
  const lang = isLocale(locale) ? locale : await requestLocale();
  return { lang, t: await serverTranslator('email', lang) };
}

const sender = () => `"${APP_NAME}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;

/** Involucro HTML comune: intestazione colorata e corpo. `body` deve essere già sicuro. */
const layout = (lang, color, body) => `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
    <div style="background:${color};padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">${APP_NAME}</h1>
    </div>
    <div style="padding:32px;">${body}</div>
  </div>
</body>
</html>`.trim();

/**
 * Sends a password-reset email with a one-time link.
 *
 * @param {object} params
 * @param {string} params.to       - Recipient email address.
 * @param {string} params.name     - Recipient display name (for personalisation).
 * @param {string} params.resetUrl - Full URL to the reset-password page including the token.
 * @param {string|null} [params.locale] - Lingua salvata sull'utente.
 * @returns {Promise<void>}
 */
export async function sendPasswordResetEmail({ to, name, resetUrl, locale }) {
  const { lang, t } = await emailTranslator(locale);
  const vars = { app: APP_NAME, name, minutes: RESET_LINK_MINUTES };
  const url = escapeHtml(resetUrl);

  await createTransporter().sendMail({
    from: sender(),
    to,
    subject: t('reset.subject', vars),
    text: [
      t('reset.greeting', vars), '',
      t('reset.intro', vars), '',
      t('reset.linkIntro'), resetUrl, '',
      t('reset.validity', vars), '',
      t('reset.ignore'), '',
      t('team', vars),
    ].join('\n'),
    html: layout(lang, '#6366f1', `
      <p style="margin-top:0;">${escapeHtml(t('reset.greeting', vars))}</p>
      <p>${escapeHtml(t('reset.buttonIntro'))}</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${url}"
           style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
          ${escapeHtml(t('reset.button'))}
        </a>
      </div>
      <p style="color:#666;font-size:13px;">${escapeHtml(t('reset.validity', vars))}</p>
      <p style="color:#666;font-size:13px;">${escapeHtml(t('reset.ignoreShort'))}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#aaa;font-size:12px;margin:0;">
        ${escapeHtml(t('reset.alternative'))}<br>
        <a href="${url}" style="color:#6366f1;word-break:break-all;">${url}</a>
      </p>`),
  });
}

/**
 * Sends a security-notification email after a successful password change.
 *
 * @param {object} params
 * @param {string} params.to   - Recipient email address.
 * @param {string} params.name - Recipient display name.
 * @param {string|null} [params.locale] - Lingua salvata sull'utente.
 * @returns {Promise<void>}
 */
export async function sendPasswordChangedEmail({ to, name, locale }) {
  const { lang, t } = await emailTranslator(locale);
  const vars = { app: APP_NAME, name };

  await createTransporter().sendMail({
    from: sender(),
    to,
    subject: t('changed.subject', vars),
    text: [
      t('changed.greeting', vars), '',
      t('changed.text'), '',
      t('changed.warning'), '',
      t('team', vars),
    ].join('\n'),
    html: layout(lang, '#22c55e', `
      <p style="margin-top:0;">${escapeHtml(t('changed.greeting', vars))}</p>
      <p>${escapeHtml(t('changed.text'))}</p>
      <p style="color:#ef4444;">${escapeHtml(t('changed.warning'))}</p>`),
  });
}
