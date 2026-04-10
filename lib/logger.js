/**
 * Logger centralizzato — usa Winston con rotazione file ogni 60 giorni.
 * Solo server-side: non importare in componenti client.
 *
 * Livelli: error | warn | info | debug
 *
 * File prodotti in /logs/:
 *   error-YYYY-MM-DD.log   — solo errori
 *   combined-YYYY-MM-DD.log — tutto (info, warn, error)
 *
 * In development viene aggiunto anche l'output in console.
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const logsDir = path.join(process.cwd(), 'logs');

/** Formato per i file: JSON strutturato con timestamp e stack trace */
const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  json()
);

/** Formato per la console in sviluppo */
const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${ts} ${level}: ${stack || message}${metaStr}`;
  })
);

function makeRotateTransport(level, filename) {
  return new DailyRotateFile({
    dirname: logsDir,
    filename: `${filename}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxFiles: '60d',       // conserva i file per 60 giorni, poi li elimina
    zippedArchive: true,   // comprime i log vecchi per risparmiare spazio
    level,
    format: fileFormat,
  });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    makeRotateTransport('error', 'error'),
    makeRotateTransport('info', 'combined'),
  ],
  // Evita che eccezioni non gestite abbattano il processo
  exceptionHandlers: [makeRotateTransport('error', 'exceptions')],
  rejectionHandlers: [makeRotateTransport('error', 'rejections')],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: consoleFormat }));
}

export default logger;

/**
 * Helper per loggare errori da API route in modo uniforme.
 *
 * @param {string} route  - es. 'GET /api/movimenti'
 * @param {unknown} err   - l'errore catturato
 * @param {object} [meta] - dati aggiuntivi (userId, filtri, ecc.)
 */
export function logApiError(route, err, meta = {}) {
  logger.error(`API error — ${route}`, {
    ...meta,
    message: err?.message ?? String(err),
    stack: err?.stack,
  });
}
