// Fonctions pures du module Menus de la semaine : calendrier (semaine du lundi
// au dimanche) et agrégation des ingrédients en libellés de courses. Aucun
// accès réseau ni base ici ; les requêtes vivent dans src/app/actions/menus.ts.

import { cleDoublon } from "@/lib/courses/compute";
import { shiftDate } from "@/lib/date/iso";
import type { MomentRepas } from "@/lib/nutrition/compute";
import { semaineDe } from "@/lib/seances/compute";

/** Ordre d'affichage des créneaux d'une journée (≠ ordre de l'enum en base). */
export const CRENEAUX_MENU: readonly MomentRepas[] = ["petit_dej", "dejeuner", "collation", "diner"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Les 7 dates (lundi → dimanche) de la semaine commençant à `lundi`. */
export function joursDeLaSemaine(lundi: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDate(lundi, i));
}

/**
 * Lundi de la semaine demandée par `?semaine=` : n'importe quelle date valide
 * est ramenée à son lundi ; une valeur absente ou invalide donne la semaine
 * de `aujourdhui`.
 */
export function semaineDepuisParam(param: string | undefined, aujourdhui: string): string {
  if (param && DATE_RE.test(param) && !Number.isNaN(new Date(`${param}T00:00:00Z`).getTime())) {
    return semaineDe(param).debut;
  }
  return semaineDe(aujourdhui).debut;
}

// --- Copie de semaine ------------------------------------------------------

export type RepasACopier = {
  date: string;
  moment: MomentRepas;
  aliment_id: string | null;
  recette_id: string | null;
  quantite: number;
};

/**
 * Repas d'une semaine reportés sur la suivante : même créneau, même contenu,
 * même quantité, 7 jours plus tard. Aucune validation « mangé » n'est reprise
 * (les lignes copiées partent toujours « à manger »).
 */
export function repasSemaineSuivante(repas: readonly RepasACopier[]): RepasACopier[] {
  return repas.map((r) => ({
    date: shiftDate(r.date, 7),
    moment: r.moment,
    aliment_id: r.aliment_id,
    recette_id: r.recette_id,
    quantite: r.quantite,
  }));
}

// --- Courses -------------------------------------------------------------

type Unite = "g" | "ml" | "piece";

type IngredientMenu = { nom: string; quantite: number; unite: Unite };
type IngredientLibreMenu = { nom: string; quantite: string | null };

export type LigneMenuCourses = {
  /** Portions prévues (recette) ou grammes/ml prévus (aliment), comme journal_repas. */
  quantite: number;
  recette: {
    portions: number;
    ingredients: IngredientMenu[];
    libres: IngredientLibreMenu[];
  } | null;
  aliment: { nom: string; unite: Unite; poidsUniteG: number | null } | null;
};

function formaterNombre(n: number): string {
  return String(n).replace(".", ",");
}

/** « 600 g », « 1,2 kg », « 250 ml », « 1,5 L », « 6 pièces » — arrondi vers le haut (on achète, on ne coupe pas). */
export function formaterQuantiteCourses(quantite: number, unite: Unite): string {
  if (unite === "piece") {
    const n = Math.ceil(quantite - 1e-9);
    return `${n} pièce${n > 1 ? "s" : ""}`;
  }
  const arrondie = Math.ceil(quantite - 1e-9);
  if (arrondie >= 1000) {
    const grand = Math.ceil(arrondie / 100) / 10;
    return `${formaterNombre(grand)} ${unite === "g" ? "kg" : "L"}`;
  }
  return `${arrondie} ${unite}`;
}

/**
 * Libellés de la liste de courses pour des repas planifiés : les quantités
 * d'un même ingrédient (même nom, même unité) sont additionnées sur tous les
 * créneaux, une recette comptant `quantite / portions` fois ses ingrédients.
 * Les ingrédients libres (quantité en texte, ex. « 1 pincée ») ne se
 * multiplient pas : un libellé par nom et texte distincts. L'ordre suit la
 * première apparition.
 */
export function libellesCoursesDepuisMenu(lignes: readonly LigneMenuCourses[]): string[] {
  const cumuls = new Map<string, { nom: string; unite: Unite; total: number }>();
  const libres = new Map<string, string>();

  function ajouter(nom: string, unite: Unite, quantite: number) {
    const cle = `${cleDoublon(nom)}|${unite}`;
    const existant = cumuls.get(cle);
    if (existant) existant.total += quantite;
    else cumuls.set(cle, { nom: nom.trim(), unite, total: quantite });
  }

  for (const ligne of lignes) {
    if (ligne.recette) {
      const { portions, ingredients, libres: libresRecette } = ligne.recette;
      const facteur = ligne.quantite / (portions || 1);
      for (const ing of ingredients) ajouter(ing.nom, ing.unite, ing.quantite * facteur);
      for (const libre of libresRecette) {
        const texte = libre.quantite?.trim();
        const libelle = texte ? `${libre.nom.trim()}, ${texte}` : libre.nom.trim();
        const cle = cleDoublon(libelle);
        if (libelle && !libres.has(cle)) libres.set(cle, libelle);
      }
    } else if (ligne.aliment) {
      const { nom, unite, poidsUniteG } = ligne.aliment;
      // journal_repas.quantite est en g/ml même pour un aliment « pièce ».
      if (unite === "piece" && poidsUniteG) ajouter(nom, "piece", ligne.quantite / poidsUniteG);
      else ajouter(nom, unite === "piece" ? "g" : unite, ligne.quantite);
    }
  }

  const mesures = [...cumuls.values()]
    .filter((c) => c.nom && c.total > 0)
    .map((c) => `${c.nom}, ${formaterQuantiteCourses(c.total, c.unite)}`);
  return [...mesures, ...libres.values()];
}
