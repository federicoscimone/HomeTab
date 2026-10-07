import { NextResponse } from 'next/server';
import { isDemoMode } from './demoAccounts.js';

/**
 * Per le funzioni che nella demo pubblica non hanno senso o sarebbero un rischio (collegare un
 * Google Drive personale, inviarvi backup): risposta 403 in DEMO_MODE, null altrimenti.
 *
 * @example
 * const blocked = demoBlocked();
 * if (blocked) return blocked;
 *
 * @returns {NextResponse|null}
 */
export function demoBlocked() {
  return isDemoMode()
    ? NextResponse.json({ error: 'Non disponibile nella demo' }, { status: 403 })
    : null;
}
