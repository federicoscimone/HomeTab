/**
 * Reimposta la password di un utente HomeTab.
 *
 * Uso:
 *   node scripts/reset-password.js <email> <nuova-password>
 *
 * Esempio:
 *   node scripts/reset-password.js admin@example.com NuovaPassword123!
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createInterface } from 'readline';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hometab';

// ── Argomenti da riga di comando ──────────────────────────────────────────────

const [,, email, passwordArg] = process.argv;

if (!email) {
  console.error('Uso: node scripts/reset-password.js <email> [nuova-password]');
  process.exit(1);
}

// ── Lettura password interattiva se non passata come argomento ────────────────

async function readPasswordFromStdin() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question('Nuova password: ', answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const password = passwordArg || await readPasswordFromStdin();

  if (!password || password.length < 8) {
    console.error('Errore: la password deve essere di almeno 8 caratteri.');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);

  const User = mongoose.models.User || (await import('../lib/models/User.js')).default;

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.error(`Nessun utente trovato con email: ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  user.hashedPassword = await bcrypt.hash(password, 12);
  await user.save();

  console.log(`Password aggiornata per ${user.name} (${user.email}).`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Errore:', err.message);
  process.exit(1);
});
