// Suivi du cadre dans le viseur : la détection image par image est bruitée (le
// cadre tremble, disparaît une image sur dix). On le stabilise :
//  - moyenne exponentielle tant que le nouveau cadre est proche de l'ancien ;
//  - maintien du dernier cadre quelques images quand la détection échoue ;
//  - un changement brusque (autre document, faux positif) n'est adopté qu'après
//    deux détections concordantes consécutives ;
//  - avec la détection maison (avant qu'OpenCV soit prêt), même le premier cadre doit
//    être confirmé : seule, elle se trompe souvent sur une table claire.
// Pur et testable : aucun DOM.

import type { Point, Quad } from "./geometrie";

export type EtatSuivi = {
  /** Cadre affiché. */
  quad: Quad | null;
  /** Images consécutives sans détection. */
  manques: number;
  /** Cadre « lointain » en attente de confirmation. */
  candidat: Quad | null;
  confirmations: number;
};

export const ETAT_SUIVI_INITIAL: EtatSuivi = { quad: null, manques: 0, candidat: null, confirmations: 0 };

/** Poids du nouveau cadre dans la moyenne (plus il est grand, plus le cadre est réactif). */
const ALPHA = 0.45;
/** Écart moyen des coins (en fraction de la diagonale) en dessous duquel deux cadres sont « le même ». */
const PROCHE = 0.06;
/** Nombre d'images sans détection pendant lesquelles on garde le dernier cadre. */
const MANQUES_MAX = 3;
/** Détections concordantes nécessaires pour adopter un cadre lointain. */
const CONFIRMATIONS = 2;

function ecartMoyen(a: Quad, b: Quad, diagonale: number): number {
  let somme = 0;
  for (let i = 0; i < 4; i++) somme += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return somme / 4 / diagonale;
}

function melange(ancien: Quad, nouveau: Quad): Quad {
  const m = (a: Point, b: Point): Point => ({ x: a.x + ALPHA * (b.x - a.x), y: a.y + ALPHA * (b.y - a.y) });
  return [m(ancien[0], nouveau[0]), m(ancien[1], nouveau[1]), m(ancien[2], nouveau[2]), m(ancien[3], nouveau[3])];
}

/** Intègre une détection (ou son absence) et renvoie le nouvel état. */
export function suivreCadre(
  etat: EtatSuivi,
  detecte: Quad | null,
  largeur: number,
  hauteur: number,
  options: { confirmerPremier?: boolean } = {}
): EtatSuivi {
  const diagonale = Math.hypot(largeur, hauteur) || 1;

  if (!detecte) {
    const manques = etat.manques + 1;
    return { quad: manques > MANQUES_MAX ? null : etat.quad, manques, candidat: null, confirmations: 0 };
  }

  // Premier cadre : affiché tout de suite pour rester réactif, sauf s'il doit être confirmé.
  if (!etat.quad && !options.confirmerPremier) return { quad: detecte, manques: 0, candidat: null, confirmations: 0 };

  if (etat.quad && ecartMoyen(etat.quad, detecte, diagonale) <= PROCHE) {
    return { quad: melange(etat.quad, detecte), manques: 0, candidat: null, confirmations: 0 };
  }

  // Cadre lointain (ou premier cadre à confirmer) : on attend qu'il se confirme.
  const concordant = etat.candidat && ecartMoyen(etat.candidat, detecte, diagonale) <= PROCHE;
  const confirmations = concordant ? etat.confirmations + 1 : 1;
  if (confirmations >= CONFIRMATIONS) return { quad: detecte, manques: 0, candidat: null, confirmations: 0 };
  return { quad: etat.quad, manques: 0, candidat: detecte, confirmations };
}

/** Moteur de la détection en direct : OpenCV une fois chargé, la détection maison avant. */
export type MoteurDirect = "opencv" | "maison";

/**
 * Texte de la pastille du viseur. « Feuille repérée » n'est jamais promis sur un cadre maison
 * non confirmé (il n'est d'ailleurs pas affiché) ; tant qu'OpenCV n'est pas prêt et qu'aucun
 * cadre n'est confirmé, le viseur dit qu'il se prépare plutôt que de chercher.
 */
export function messageViseur(quad: Quad | null, moteur: MoteurDirect | null): string {
  if (quad) return "Feuille repérée";
  return moteur === "opencv" ? "Cherche la feuille…" : "Préparation de la détection…";
}
