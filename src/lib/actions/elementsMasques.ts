"use client";

import { useSyncExternalStore } from "react";

// Éléments masqués pendant le délai d'annulation d'une suppression
// (`supprimerAvecAnnulation`). Un état local de composant ne suffit pas quand
// la suppression se fait depuis un écran de détail qui renvoie vers la liste
// (document, collection, recette, routine…) : la liste, rendue avec des données
// serveur encore périmées, afficherait l'élément pendant les 6 secondes du toast.
// Ce petit store en mémoire (un Set immuable par type) est lu par la liste et
// par les lignes ; « Annuler » réaffiche l'élément, un échec aussi.
//
// Volontairement jamais vidé après une suppression réussie : les identifiants
// ne sont pas réutilisés, et un rendu encore périmé ne doit pas faire
// réapparaître l'élément avant que le serveur ait rafraîchi la liste. La
// mémoire est perdue au rechargement de la page, ce qui est le bon moment.

const VIDE: ReadonlySet<string> = new Set();
let parType: ReadonlyMap<string, ReadonlySet<string>> = new Map();
const ecouteurs = new Set<() => void>();

function emettre() {
  for (const ecouteur of ecouteurs) ecouteur();
}

export function masquerElement(type: string, id: string) {
  const courant = parType.get(type) ?? VIDE;
  if (courant.has(id)) return;
  const suivant = new Map(parType);
  suivant.set(type, new Set(courant).add(id));
  parType = suivant;
  emettre();
}

export function reafficherElement(type: string, id: string) {
  const courant = parType.get(type);
  if (!courant?.has(id)) return;
  const sansId = new Set(courant);
  sansId.delete(id);
  const suivant = new Map(parType);
  suivant.set(type, sansId);
  parType = suivant;
  emettre();
}

function abonner(ecouteur: () => void) {
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}

/** Identifiants masqués d'un type (référence stable tant que rien ne change). */
export function useMasques(type: string): ReadonlySet<string> {
  return useSyncExternalStore(
    abonner,
    () => parType.get(type) ?? VIDE,
    () => VIDE
  );
}
