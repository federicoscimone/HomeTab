/**
 * @fileoverview Lucchetto per il seed della demo, condiviso fra processi tramite MongoDB.
 * @module lib/demoLock
 *
 * Su Vercel ogni avvio a freddo esegue instrumentation.js, anche più istanze insieme, e un cron
 * può arrivare due volte: senza lucchetto due seed potrebbero svuotare e ripopolare il database
 * nello stesso momento. Il lucchetto è un documento con _id fisso: inserirlo riesce a un solo
 * processo, gli altri ricevono un errore di chiave duplicata e rinunciano. Scade da solo dopo
 * dieci minuti, così un processo morto a metà non lo lascia chiuso per sempre.
 */

import mongoose from 'mongoose';
import connectDB from './mongodb.js';

const LOCK_ID = 'demo-seed';
const LOCK_TTL_MS = 10 * 60 * 1000;

/**
 * @param {() => Promise<void>} fn - Lavoro da eseguire con il lucchetto preso.
 * @returns {Promise<{ ran: boolean }>} ran = false se un altro processo stava già lavorando.
 */
export async function withDemoLock(fn) {
  await connectDB();
  const locks = mongoose.connection.db.collection('locks');
  await locks.deleteOne({ _id: LOCK_ID, expiresAt: { $lt: new Date() } });
  try {
    await locks.insertOne({ _id: LOCK_ID, expiresAt: new Date(Date.now() + LOCK_TTL_MS) });
  } catch (err) {
    if (err?.code === 11000) return { ran: false };
    throw err;
  }
  try {
    await fn();
    return { ran: true };
  } finally {
    await locks.deleteOne({ _id: LOCK_ID });
  }
}
