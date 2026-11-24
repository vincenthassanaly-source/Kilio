// Suivi du cadre dans le viseur : la détection image par image est bruitée (le
// cadre tremble, disparaît une image sur dix). On le stabilise :
//  - lissage adaptatif (filtre « One Euro ») tant que le nouveau cadre est proche de l'ancien :
//    fort à l'arrêt (le cadre ne tremble plus), faible quand le document bouge (il ne traîne
//    plus derrière), avec une zone morte d'environ un pixel d'analyse ;
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
  /** Sortie du filtre avant la zone morte (null si aucun cadre). */
  lisse?: Quad | null;
  /** Vitesse lissée du cadre, en diagonales par seconde. */
  vitesse?: number;
  /** Instant (ms) de la dernière détection intégrée. */
  instant?: number | null;
};

export const ETAT_SUIVI_INITIAL: EtatSuivi = { quad: null, manques: 0, candidat: null, confirmations: 0, lisse: null, vitesse: 0, instant: null };

/**
 * Filtre « One Euro » (Casiez et al., 2012) : fréquence de coupure minimale à l'arrêt (Hz), gain de
 * la coupure avec la vitesse (par diagonale/s), coupure du filtre de vitesse (Hz). Réglés sur le
 * banc : tremblement à l'arrêt divisé par ~3, retard en mouvement réduit par rapport à l'ancienne
 * moyenne fixe (α 0,45).
 */
const COUPURE_MIN_HZ = 0.35;
const GAIN_VITESSE = 60;
const COUPURE_VITESSE_HZ = 1.5;
/** Intervalle supposé entre deux détections quand l'appelant ne donne pas l'instant (s). */
const INTERVALLE_DEFAUT_S = 0.12;
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

function melange(ancien: Quad, nouveau: Quad, alpha: number): Quad {
  const m = (a: Point, b: Point): Point => ({ x: a.x + alpha * (b.x - a.x), y: a.y + alpha * (b.y - a.y) });
  return [m(ancien[0], nouveau[0]), m(ancien[1], nouveau[1]), m(ancien[2], nouveau[2]), m(ancien[3], nouveau[3])];
}

/** Poids du nouvel échantillon pour un filtre passe-bas de coupure `hz`, échantillonné toutes les `dt` s. */
function alphaPasseBas(hz: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * hz);
  return 1 / (1 + tau / dt);
}

/** Zone morte : un coin affiché ne bouge pas tant que le coin filtré reste à moins de `zone` px. */
function appliquerZoneMorte(affiche: Quad, lisse: Quad, zone: number): Quad {
  return affiche.map((p, i) => (Math.hypot(lisse[i].x - p.x, lisse[i].y - p.y) < zone ? p : lisse[i])) as Quad;
}

/** Nouveau cadre adopté tel quel (premier cadre, cadre lointain confirmé) : le filtre repart de lui. */
function adopter(quad: Quad, instant: number | null): EtatSuivi {
  return { quad, manques: 0, candidat: null, confirmations: 0, lisse: quad, vitesse: 0, instant };
}

/** Intègre une détection (ou son absence) et renvoie le nouvel état. */
export function suivreCadre(
  etat: EtatSuivi,
  detecte: Quad | null,
  largeur: number,
  hauteur: number,
  options: {
    confirmerPremier?: boolean;
    /** Instant de la détection (ms, `performance.now()`) : le filtre tient compte du rythme réel. */
    instant?: number;
    /** Zone morte en pixels du cadre (≈ un pixel de l'image analysée). */
    zoneMorte?: number;
  } = {}
): EtatSuivi {
  const diagonale = Math.hypot(largeur, hauteur) || 1;
  const instant = options.instant ?? null;

  if (!detecte) {
    const manques = etat.manques + 1;
    if (manques > MANQUES_MAX) return { ...ETAT_SUIVI_INITIAL, manques };
    return { ...etat, manques, candidat: null, confirmations: 0 };
  }

  // Premier cadre : affiché tout de suite pour rester réactif, sauf s'il doit être confirmé.
  if (!etat.quad && !options.confirmerPremier) return adopter(detecte, instant);

  const lisse = etat.lisse ?? etat.quad;
  if (etat.quad && lisse && ecartMoyen(lisse, detecte, diagonale) <= PROCHE) {
    const ecoule = instant !== null && etat.instant != null ? (instant - etat.instant) / 1000 : INTERVALLE_DEFAUT_S;
    const dt = Math.min(0.5, Math.max(0.03, ecoule || INTERVALLE_DEFAUT_S));
    const vitesseBrute = ecartMoyen(lisse, detecte, diagonale) / dt;
    const vitesse = (etat.vitesse ?? 0) + alphaPasseBas(COUPURE_VITESSE_HZ, dt) * (vitesseBrute - (etat.vitesse ?? 0));
    const nouveau = melange(lisse, detecte, alphaPasseBas(COUPURE_MIN_HZ + GAIN_VITESSE * vitesse, dt));
    const quad = options.zoneMorte ? appliquerZoneMorte(etat.quad, nouveau, options.zoneMorte) : nouveau;
    return { quad, manques: 0, candidat: null, confirmations: 0, lisse: nouveau, vitesse, instant };
  }

  // Cadre lointain (ou premier cadre à confirmer) : on attend qu'il se confirme.
  const concordant = etat.candidat && ecartMoyen(etat.candidat, detecte, diagonale) <= PROCHE;
  const confirmations = concordant ? etat.confirmations + 1 : 1;
  if (confirmations >= CONFIRMATIONS) return adopter(detecte, instant);
  return { ...etat, manques: 0, candidat: detecte, confirmations };
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
