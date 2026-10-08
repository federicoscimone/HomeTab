/**
 * @fileoverview Mongoose model for User.
 * @module lib/models/User
 *
 * Tutti gli utenti vedono gli stessi dati (un solo nucleo familiare): il ruolo decide cosa
 * possono fare, non cosa possono vedere. Ruoli e permessi in lib/auth/permissions.js.
 */

import mongoose from 'mongoose';
import { ROLES } from '../auth/permissions.js';
import { LOCALES } from '../i18n/locale.js';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  hashedPassword: { type: String, required: true },
  // Il default è il ruolo più basso: chi crea un utente deve dichiarare i privilegi, non toglierli.
  role: { type: String, enum: ROLES, default: 'viewer' },
  /** Un utente disattivato non entra più e le sue sessioni aperte smettono di funzionare. */
  active: { type: Boolean, default: true },
  /** Password provvisoria assegnata da un admin: va sostituita al primo accesso. */
  mustChangePassword: { type: Boolean, default: false },
  /**
   * Incrementato a ogni cambio o reimpostazione della password. Il JWT ne porta una copia: se non
   * coincide, la sessione è revocata. Senza questo un JWT resterebbe valido per 30 giorni anche
   * dopo che un admin ha reimpostato la password.
   */
  sessionVersion: { type: Number, default: 0 },
  lastLoginAt: { type: Date, default: null },
  /**
   * Lingua scelta dall'utente. L'interfaccia usa il cookie; questa serve dove il cookie non
   * arriva (email, notifiche) e per ritrovare la lingua dopo il login da un browser nuovo.
   */
  locale: { type: String, enum: [...LOCALES, null], default: null },
  /** Chat Telegram collegata dall'utente (vedi lib/models/TelegramLink.js); null se nessuna. */
  telegramChatId: { type: String, default: null },
  telegramLinkedAt: { type: Date, default: null },
  /**
   * Verifica in due passaggi facoltativa: dopo la password serve un codice inviato sul canale
   * scelto. Si attiva solo dopo aver ricevuto un codice su quel canale, così non si resta chiusi
   * fuori da un canale che non funziona.
   */
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorChannel: { type: String, enum: ['telegram', 'email', null], default: null },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
