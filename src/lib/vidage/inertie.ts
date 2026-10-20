// Défilement au doigt de la feuille, géré par l'app : le canvas bloque tout
// défilement natif (sinon le stylet fait aussi défiler la page), donc le glissé
// du doigt et son inertie sont recréés ici. Fonctions pures, en px et ms.

// Constante de temps du frottement : la vitesse est divisée par e toutes les 250 ms.
const FROTTEMENT_PAR_MS = 1 / 250;
// En dessous (px/ms), on considère que le défilement est arrêté.
const VITESSE_MIN = 0.03;

/**
 * Vitesse lissée du doigt (px/ms) : moyenne mobile entre l'ancienne vitesse et
 * celle du dernier mouvement, pour qu'un à-coup en fin de geste ne projette pas
 * la feuille. `precedente` vaut null au premier mouvement.
 */
export function lisserVitesse(precedente: number | null, deplacement: number, dureeMs: number): number {
  if (dureeMs <= 0) return precedente ?? 0;
  const instantanee = deplacement / dureeMs;
  return precedente === null ? instantanee : precedente * 0.6 + instantanee * 0.4;
}

/**
 * Un pas d'inertie : distance à parcourir pendant `dureeMs` et vitesse restante.
 * Décroissance exponentielle intégrée exactement, donc la distance totale ne
 * dépend pas de la cadence d'affichage (60 ou 120 Hz).
 */
export function pasInertie(vitesse: number, dureeMs: number): { delta: number; vitesse: number; fini: boolean } {
  const reste = vitesse * Math.exp(-FROTTEMENT_PAR_MS * dureeMs);
  const delta = (vitesse - reste) / FROTTEMENT_PAR_MS;
  return { delta, vitesse: reste, fini: Math.abs(reste) < VITESSE_MIN };
}
