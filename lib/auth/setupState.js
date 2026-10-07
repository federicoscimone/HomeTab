/**
 * @fileoverview Stato della configurazione iniziale: esiste almeno un utente?
 * @module lib/auth/setupState
 *
 * Senza utenti l'unica pagina utile è /setup, che crea il primo amministratore; prima chi
 * installava trovava un login senza alcun account e doveva sapere di dover aprire /setup a mano.
 *
 * La risposta "sì" si ricorda per tutta la vita del processo: un'installazione con utenti non
 * torna mai senza, perché l'ultimo amministratore attivo non si può eliminare. La risposta "no"
 * invece si richiede ogni volta, così il primo account creato vale subito.
 */

import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';

let knownToHaveUsers = false;

/** @returns {Promise<boolean>} true se nel database esiste almeno un utente. */
export async function hasUsers() {
  if (knownToHaveUsers) return true;
  await connectDB();
  knownToHaveUsers = Boolean(await User.exists({}));
  return knownToHaveUsers;
}
