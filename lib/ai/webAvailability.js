/**
 * @fileoverview Se la ricerca web degli esercenti è disponibile, e quanto costa a riga.
 * @module lib/ai/webAvailability
 */

import { aiAvailability } from './index.js';
import { parseModelSpec } from './providers.js';
import { microToUsd, typicalWebRowMicro } from './pricing.js';

/** @returns {{ webAvailable: boolean, webRowUsd: number }} Per le schermate di revisione. */
export function webAvailability(doc) {
  const web = aiAvailability('importWebSearch', doc);
  const name = parseModelSpec(web.model)?.name;
  return { webAvailable: web.available, webRowUsd: web.available ? microToUsd(typicalWebRowMicro(name)) : 0 };
}
