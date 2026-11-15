/**
 * @fileoverview La versione dell'istanza per i componenti client (lib/buildInfo.js).
 * Il root layout la calcola lato server e la passa qui: i client non leggono variabili d'ambiente.
 */

'use client';

import { createContext, useContext } from 'react';

const BuildInfoContext = createContext(null);

export default function BuildInfoProvider({ value, children }) {
  return <BuildInfoContext.Provider value={value}>{children}</BuildInfoContext.Provider>;
}

/** @returns {ReturnType<typeof import('@/lib/buildInfo').buildInfo> | null} */
export function useBuildInfo() {
  return useContext(BuildInfoContext);
}
