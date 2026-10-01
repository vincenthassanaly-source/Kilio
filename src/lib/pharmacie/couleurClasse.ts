import type { CSSProperties } from "react";
import { cheminDeClasse, classesRacines, type PharmaClasse, type PharmaRefSnapshot } from "./referentiel";

/** Nombre de teintes `--classe-N` définies dans globals.css. */
export const NB_TEINTES_CLASSE = 8;

/**
 * Numéro de teinte (1..NB_TEINTES_CLASSE) d'une classe : celui de sa classe
 * racine (rang dans l'ordre d'affichage), donc stable et partagé par toutes
 * les sous-classes et molécules. Deux racines ne partagent une teinte qu'au-delà
 * de NB_TEINTES_CLASSE racines.
 */
export function teinteDeClasse(snap: PharmaRefSnapshot, classe: PharmaClasse | undefined): number {
  if (!classe) return 1;
  const racine = cheminDeClasse(snap, classe)[0];
  const rang = classesRacines(snap).findIndex((c) => c.id === racine.id);
  return (Math.max(rang, 0) % NB_TEINTES_CLASSE) + 1;
}

/** Style à poser sur un conteneur : définit `--classe` pour ses descendants. */
export function styleClasse(snap: PharmaRefSnapshot, classe: PharmaClasse | undefined): CSSProperties {
  return { "--classe": `var(--classe-${teinteDeClasse(snap, classe)})` } as CSSProperties;
}
