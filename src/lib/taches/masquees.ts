"use client";

import { useSyncExternalStore } from "react";

// Tâches masquées le temps du toast « Annuler » d'une suppression différée
// (cf. `supprimerAvecAnnulation`). Partagé au niveau du module plutôt que par
// carte : si la carte est démontée pendant le délai (changement de vue ou de
// liste), l'annulation doit quand même la réafficher, et la suppression
// groupée masque plusieurs cartes d'un coup.
let masquees: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function emettre() {
  for (const l of listeners) l();
}

export function masquerTaches(ids: readonly string[]) {
  masquees = new Set([...masquees, ...ids]);
  emettre();
}

export function reafficherTaches(ids: readonly string[]) {
  const suivantes = new Set(masquees);
  for (const id of ids) suivantes.delete(id);
  masquees = suivantes;
  emettre();
}

function abonner(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const VIDE: ReadonlySet<string> = new Set();

export function useTachesMasquees(): ReadonlySet<string> {
  return useSyncExternalStore(abonner, () => masquees, () => VIDE);
}
