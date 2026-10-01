/**
 * @fileoverview Hook client per mostrare o nascondere comandi in base al ruolo.
 * @module lib/auth/useCan
 *
 * Serve solo all'interfaccia: la protezione vera la fanno le API con requirePermission.
 */

'use client';

import { useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { can } from '@/lib/auth/permissions';

/**
 * @returns {(permission: string) => boolean}
 *
 * @example
 * const canDo = useCan();
 * {canDo('movements:delete') && <button>Elimina</button>}
 */
export default function useCan() {
  const { data } = useSession();
  const role = data?.user?.role;
  return useCallback((permission) => can(role, permission), [role]);
}
