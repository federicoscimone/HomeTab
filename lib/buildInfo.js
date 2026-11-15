/**
 * @fileoverview Versione dell'istanza in esecuzione: quale build gira, di quando e in quale ambiente.
 *
 * I valori arrivano dalla CI come build arg e diventano variabili d'ambiente dell'immagine
 * (Dockerfile, stage runner); l'ambiente lo dice la configurazione del deploy. Si leggono lato
 * server all'avvio e a ogni richiesta, mai con NEXT_PUBLIC_*: la stessa immagine passa da un
 * ambiente all'altro senza essere ricostruita.
 *
 *   BUILD_SHA   commit da cui è costruita l'immagine (su Vercel: VERCEL_GIT_COMMIT_SHA)
 *   BUILD_DATE  data della build, ISO 8601
 *   APP_ENV     nome dell'ambiente, per esempio "lab-int" (su Vercel: VERCEL_ENV)
 *
 * Versione (Semantic Versioning): quella di package.json, con lo SHA breve come metadato di build
 * quando la build viene da un commit noto ("1.4.2+059b385"); "-dev" in una build locale.
 *
 * Funzione pura e senza import, così la usano l'app, i worker e i test.
 */

const SHA = /^[0-9a-f]{7,40}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
const ENVIRONMENT = /^[\w.-]{1,40}$/;

/**
 * @param {string} packageVersion - Il campo version di package.json.
 * @param {Record<string, string | undefined>} [env] - Le variabili d'ambiente.
 * @returns {{ name: string, version: string, commit: string | null, shortCommit: string | null,
 *   buildDate: string | null, environment: string | null }}
 */
export function buildInfo(packageVersion, env = process.env) {
  const rawSha = (env.BUILD_SHA || env.VERCEL_GIT_COMMIT_SHA || '').trim().toLowerCase();
  const commit = SHA.test(rawSha) ? rawSha : null;
  const shortCommit = commit ? commit.slice(0, 7) : null;

  const rawDate = (env.BUILD_DATE || '').trim();
  const buildDate = ISO_DATE.test(rawDate) && !Number.isNaN(Date.parse(rawDate)) ? rawDate : null;

  const rawEnv = (env.APP_ENV || env.VERCEL_ENV || '').trim();
  const environment = ENVIRONMENT.test(rawEnv) ? rawEnv : null;

  return {
    name: 'hometab',
    version: shortCommit ? `${packageVersion}+${shortCommit}` : `${packageVersion}-dev`,
    commit,
    shortCommit,
    buildDate,
    environment,
  };
}
