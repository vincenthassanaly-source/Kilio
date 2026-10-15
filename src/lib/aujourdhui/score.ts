import { SEUIL_DEPASSEMENT_LEGER } from "@/lib/nutrition/bilan";

// Score de la journée : logique pure (aucune dépendance React ni réseau).
// Chaque domaine donne une fraction 0..1 ; le score est la moyenne à poids égal
// des seuls domaines qui ont un objet aujourd'hui. Un domaine sans objet (pas
// de séance prévue, aucune habitude active, journal vide, jour libre...) est
// exclu : il ne tire jamais le score vers le bas. Ton neutre : aucun retard.

type DomaineScore = "taches" | "nutrition" | "sport" | "habitudes";

type LigneScore = {
  domaine: DomaineScore;
  libelle: string;
  /** Éléments faits / attendus, pour les domaines comptables (tâches, habitudes). */
  fait: number;
  total: number;
  /** Avancement 0..1 utilisé dans la moyenne. */
  fraction: number;
  /** Texte affiché à droite du libellé. */
  detail: string;
};

export type ScoreDuJour = { pct: number; lignes: LigneScore[] };

export type EntreeScore = {
  /** Tâches dont l'échéance est aujourd'hui (faites ou non). */
  taches: readonly { fait: boolean }[];
  /** `null` : données indisponibles. */
  nutrition: { kcal: number; kcalGoal: number | null; jourLibre: boolean } | null;
  /** `entraineAujourdhui` : jour marqué « entraînement » ; `seancesFaites` : séances enregistrées aujourd'hui. */
  sport: { entraineAujourdhui: boolean; seancesFaites: number } | null;
  /** Habitudes actives du jour ; `hebdo` : objectif « X fois par semaine ». */
  habitudes: readonly { fait: boolean; hebdo: boolean }[] | null;
};

// Au-delà de +10 % de la cible (seuil « léger » du Bilan), la fraction décroît
// linéairement et s'annule à +30 %.
const DEPASSEMENT_NUL = 1.3;

function fractionNutrition(ratio: number): number {
  if (ratio <= SEUIL_DEPASSEMENT_LEGER) return Math.min(ratio, 1);
  return Math.max(0, (DEPASSEMENT_NUL - ratio) / (DEPASSEMENT_NUL - SEUIL_DEPASSEMENT_LEGER));
}

export function scoreDuJour(entree: EntreeScore): ScoreDuJour | null {
  const lignes: LigneScore[] = [];

  const totalTaches = entree.taches.length;
  if (totalTaches > 0) {
    const fait = entree.taches.filter((t) => t.fait).length;
    lignes.push({
      domaine: "taches",
      libelle: "Tâches",
      fait,
      total: totalTaches,
      fraction: fait / totalTaches,
      detail: `${fait}/${totalTaches}`,
    });
  }

  const { nutrition } = entree;
  if (nutrition && !nutrition.jourLibre && nutrition.kcalGoal !== null && nutrition.kcalGoal > 0) {
    const kcal = Math.round(nutrition.kcal);
    if (kcal > 0) {
      lignes.push({
        domaine: "nutrition",
        libelle: "Nutrition",
        fait: kcal,
        total: nutrition.kcalGoal,
        fraction: fractionNutrition(kcal / nutrition.kcalGoal),
        detail: `${kcal} / ${nutrition.kcalGoal} kcal`,
      });
    }
  }

  const { sport } = entree;
  if (sport && (sport.seancesFaites > 0 || sport.entraineAujourdhui)) {
    const faite = sport.seancesFaites > 0;
    lignes.push({
      domaine: "sport",
      libelle: "Sport",
      fait: faite ? 1 : 0,
      total: 1,
      fraction: faite ? 1 : 0,
      detail: faite ? "Séance faite" : "Journée d'entraînement",
    });
  }

  // Une habitude hebdomadaire n'est attendue que si elle est faite aujourd'hui :
  // les autres jours de la semaine, elle ne pèse pas.
  const attendues = (entree.habitudes ?? []).filter((h) => !h.hebdo || h.fait);
  if (attendues.length > 0) {
    const fait = attendues.filter((h) => h.fait).length;
    lignes.push({
      domaine: "habitudes",
      libelle: "Habitudes",
      fait,
      total: attendues.length,
      fraction: fait / attendues.length,
      detail: `${fait}/${attendues.length}`,
    });
  }

  if (lignes.length === 0) return null;
  const moyenne = lignes.reduce((somme, l) => somme + l.fraction, 0) / lignes.length;
  return { pct: Math.round(moyenne * 100), lignes };
}
