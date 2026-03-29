import mongoose from 'mongoose';

const PasswordResetTokenSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  // Token hashed con SHA-256 — nel DB non si salva il token in chiaro
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
}, { timestamps: true });

// Indice TTL: MongoDB elimina automaticamente i token scaduti
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.PasswordResetToken || mongoose.model('PasswordResetToken', PasswordResetTokenSchema);
