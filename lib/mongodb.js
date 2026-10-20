/**
 * @fileoverview MongoDB singleton connection helper for Next.js.
 *
 * In Next.js dev mode, hot-reloads create new module instances but the Node.js
 * global persists, so we cache the connection on `global.mongoose` to avoid
 * opening a new connection on every hot-reload.
 *
 * @module lib/mongodb
 */

import mongoose from 'mongoose';
import logger from './logger.js';
import AiBudget from './models/AiBudget.js';
import AiSettings from './models/AiSettings.js';
import AiUsage from './models/AiUsage.js';
import AllocationPlan from './models/AllocationPlan.js';
import AuditLog from './models/AuditLog.js';
import BotState from './models/BotState.js';
import Category from './models/Category.js';
import Goal from './models/Goal.js';
import ImportTemplate from './models/ImportTemplate.js';
import KeywordMapping from './models/KeywordMapping.js';
import Movement from './models/Movement.js';
import OtpChallenge from './models/OtpChallenge.js';
import PasswordResetToken from './models/PasswordResetToken.js';
import RateLimit from './models/RateLimit.js';
import TelegramLink from './models/TelegramLink.js';
import User from './models/User.js';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Definire MONGODB_URI nel file .env.local');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, collectionsPromise: null };
}

const REQUIRED_MODELS = [
  AiBudget,
  AiSettings,
  AiUsage,
  AllocationPlan,
  AuditLog,
  BotState,
  Category,
  Goal,
  ImportTemplate,
  KeywordMapping,
  Movement,
  OtpChallenge,
  PasswordResetToken,
  RateLimit,
  TelegramLink,
  User,
];

async function ensureCollections(mongooseInstance) {
  if (cached.collectionsPromise) {
    await cached.collectionsPromise;
    return;
  }

  cached.collectionsPromise = (async () => {
    const db = mongooseInstance.connection.db;
    const existingCollections = await db.listCollections({}, { nameOnly: true }).toArray();
    const existingNames = new Set(existingCollections.map((collection) => collection.name));
    const createdCollections = [];

    for (const model of REQUIRED_MODELS) {
      const collectionName = model.collection.collectionName;
      if (existingNames.has(collectionName)) continue;

      try {
        await model.createCollection();
        createdCollections.push(collectionName);
      } catch (error) {
        // Ignore race conditions when multiple requests bootstrap at the same time.
        if (error?.code !== 48 && error?.codeName !== 'NamespaceExists') {
          throw error;
        }
      }
    }

    if (createdCollections.length > 0) {
      logger.info('MongoDB bootstrap completato: collezioni create', {
        createdCollections,
        createdCount: createdCollections.length,
      });
      return;
    }

    logger.info('MongoDB bootstrap completato: nessuna collezione da creare');
  })();

  try {
    await cached.collectionsPromise;
  } catch (error) {
    cached.collectionsPromise = null;
    throw error;
  }
}

/**
 * Returns a cached Mongoose connection, creating one if needed.
 * Must be called at the top of every API route handler before DB operations.
 *
 * @returns {Promise<import('mongoose').Mongoose>}
 */
async function connectDB() {
  if (cached.conn) {
    await ensureCollections(cached.conn);
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    }).catch((error) => {
      // Un tentativo fallito non resta in cache. Prima la promessa rifiutata restava salvata e ogni
      // richiesta successiva falliva con lo stesso errore finché il processo non ripartiva, anche
      // dopo che il database era tornato raggiungibile (per esempio un utente Mongo creato dopo
      // l'avvio dell'app, o un intoppo di rete alla partenza a freddo su Vercel).
      cached.promise = null;
      throw error;
    });
  }

  cached.conn = await cached.promise;
  await ensureCollections(cached.conn);
  return cached.conn;
}

export default connectDB;
