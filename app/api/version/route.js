/**
 * @fileoverview API route — /api/version
 * GET — versione dell'istanza: { name, version, commit, shortCommit, buildDate, environment }.
 *
 * Pubblica (proxy.js, PUBLIC_API): niente sessione e niente database, così risponde anche quando
 * Mongo è giù e la può interrogare un monitor (Uptime Kuma). Contiene solo dati della build, già
 * pubblici nel repository e su GHCR: nessuna configurazione, nessun segreto.
 */

import { NextResponse } from 'next/server';
import packageJson from '@/package.json';
import { buildInfo } from '@/lib/buildInfo';

// Le variabili si leggono a ogni richiesta: la stessa build gira in ambienti diversi.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(buildInfo(packageJson.version), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
