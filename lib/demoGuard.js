import { NextResponse } from 'next/server';
import { isDemoMode } from './demoAccounts.js';
import { serverTranslator } from './i18n/server.js';

/**
 * Per le funzioni che nella demo pubblica non hanno senso o sarebbero un rischio (collegare un
 * Google Drive personale, inviarvi backup): risposta 403 in DEMO_MODE, null altrimenti.
 *
 * @example
 * const blocked = await demoBlocked();
 * if (blocked) return blocked;
 *
 * @returns {Promise<NextResponse|null>}
 */
export async function demoBlocked() {
  return isDemoMode()
    ? NextResponse.json({ error: (await serverTranslator('errors'))('demoUnavailable') }, { status: 403 })
    : null;
}
