import { shiftDate } from "@/lib/date/iso";

// Suivi d'un objectif de type « valeur » (objectif_entries : une mesure par
// date). Fonctions pures, utilisées par ObjectifSuiviValeur.tsx.

export type PointValeur = { date: string; valeur: number };

/**
 * Progression vers la cible, de 0 à 1.
 *
 * Un objectif à faire baisser (perte de poids : 1ʳᵉ mesure au-dessus de la
 * cible) part de sa 1ʳᵉ mesure : `(départ − actuel) / (départ − cible)`.
 * Sans cela, 80 kg pour une cible de 70 kg afficherait déjà 100 %.
 * Tout autre objectif garde le calcul historique `actuel / cible` (départ à
 * zéro), qui convient aux valeurs cumulées (livres lus, épargne…).
 *
 * Limite assumée : le départ est la 1ʳᵉ mesure enregistrée ; supprimer cette
 * mesure déplace le point de départ.
 */
export function progressionValeur(valeurs: number[], cible: number | null): number | null {
  if (cible == null) return null;
  if (valeurs.length === 0) return 0;

  const depart = valeurs[0];
  const actuel = valeurs[valeurs.length - 1];
  const clamp = (x: number) => Math.min(1, Math.max(0, x));

  if (depart > cible) return clamp((depart - actuel) / (depart - cible));
  return clamp(actuel / cible);
}

/**
 * Moyenne glissante sur `fenetreJours` jours calendaires (le jour du point et
 * les précédents), alignée sur `points` (triés par date croissante). Lisse le
 * bruit d'une mesure quotidienne comme le poids, qui varie de 1 à 2 kg d'un
 * jour à l'autre.
 */
export function moyenneGlissante(points: PointValeur[], fenetreJours = 7): number[] {
  return points.map((point, i) => {
    const debut = shiftDate(point.date, -(fenetreJours - 1));
    let somme = 0;
    let nb = 0;
    for (let j = i; j >= 0 && points[j].date >= debut; j--) {
      somme += points[j].valeur;
      nb++;
    }
    return somme / nb;
  });
}
