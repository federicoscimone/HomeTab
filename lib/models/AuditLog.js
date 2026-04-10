import mongoose from 'mongoose';

/**
 * Traccia ogni operazione significativa eseguita dagli utenti.
 *
 * action  — cosa è stato fatto (CREATE, UPDATE, DELETE, IMPORT, LOGIN, PASSWORD_CHANGE)
 * resource — su quale entità (movement, category, template, keyword, user)
 * resourceId — _id del documento coinvolto (stringa per flessibilità)
 * description — testo leggibile per la UI, es. "Modificato movimento €24.50 - Bar Roma"
 * meta — dati aggiuntivi opzionali (diff campi, conteggi batch, ecc.)
 */
const AuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'LOGIN', 'PASSWORD_CHANGE'],
      index: true,
    },
    resource: {
      type: String,
      required: true,
      enum: ['movement', 'category', 'template', 'keyword', 'user', 'system'],
      index: true,
    },
    resourceId: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Indice composito per le query più comuni (lista per utente, filtri per action+resource)
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, resource: 1, createdAt: -1 });

export default mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
