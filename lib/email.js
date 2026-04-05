/**
 * @fileoverview Nodemailer-based email helpers for auth flows.
 * All SMTP configuration is read from environment variables at call time.
 * @module lib/email
 */

import nodemailer from 'nodemailer';

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
 * Sends a password-reset email with a one-time link.
 *
 * @param {object} params
 * @param {string} params.to       - Recipient email address.
 * @param {string} params.name     - Recipient display name (for personalisation).
 * @param {string} params.resetUrl - Full URL to the reset-password page including the token.
 * @returns {Promise<void>}
 */
export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const transporter = createTransporter();
  const appName = 'HomeBI';
  const expiryMinutes = 60;

  await transporter.sendMail({
    from: `"${appName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `${appName} — Reset della password`,
    text: `
Ciao ${name},

Hai richiesto il reset della password per il tuo account ${appName}.

Clicca sul link seguente per impostare una nuova password:
${resetUrl}

Il link è valido per ${expiryMinutes} minuti e può essere usato una sola volta.

Se non hai richiesto il reset, ignora questa email — la tua password non verrà modificata.

— Team ${appName}
    `.trim(),
    html: `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
    <div style="background:#6366f1;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">${appName}</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin-top:0;">Ciao <strong>${name}</strong>,</p>
      <p>Hai richiesto il reset della password. Clicca sul pulsante per impostarne una nuova:</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}"
           style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
          Reimposta Password
        </a>
      </div>
      <p style="color:#666;font-size:13px;">Il link è valido per <strong>${expiryMinutes} minuti</strong> e può essere usato una sola volta.</p>
      <p style="color:#666;font-size:13px;">Se non hai richiesto il reset, ignora questa email.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#aaa;font-size:12px;margin:0;">
        Link alternativo:<br>
        <a href="${resetUrl}" style="color:#6366f1;word-break:break-all;">${resetUrl}</a>
      </p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  });
}

/**
 * Sends a security-notification email after a successful password change.
 *
 * @param {object} params
 * @param {string} params.to   - Recipient email address.
 * @param {string} params.name - Recipient display name.
 * @returns {Promise<void>}
 */
export async function sendPasswordChangedEmail({ to, name }) {
  const transporter = createTransporter();
  const appName = 'HomeBI';

  await transporter.sendMail({
    from: `"${appName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `${appName} — Password modificata`,
    text: `
Ciao ${name},

La tua password è stata modificata con successo.

Se non sei stato tu, contatta immediatamente l'amministratore.

— Team ${appName}
    `.trim(),
    html: `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
    <div style="background:#22c55e;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">${appName}</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin-top:0;">Ciao <strong>${name}</strong>,</p>
      <p>La tua password è stata <strong>modificata con successo</strong>.</p>
      <p style="color:#ef4444;">Se non sei stato tu, contatta immediatamente l'amministratore.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  });
}
