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

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Definire MONGODB_URI nel file .env.local');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Returns a cached Mongoose connection, creating one if needed.
 * Must be called at the top of every API route handler before DB operations.
 *
 * @returns {Promise<import('mongoose').Mongoose>}
 */
async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
