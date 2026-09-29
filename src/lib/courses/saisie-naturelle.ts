import { texteOuNull } from "@/lib/saisie-ia/outils";
import { LONGUEUR_MAX_LIBELLE_COURSE, PLAFOND_ARTICLES_COURSES, cleDoublon } from "./compute";

// Module Courses de « Ajouter avec l'IA » : logique pure (aucun réseau, aucune
// base). Gemini propose des libellés d'articles, ce module les nettoie et
// prévient quand un article est déjà sur la liste ou serait remis dessus.

export const MAX_COURSES_PROPOSEES = PLAFOND_ARTICLES_COURSES;

export type CoursePropose = {
  libelle: string;
  avertissements: string[];
};

export type ArticleConnu = { id: string; libelle: string; coche: boolean };

/** Revalide les articles bruts de Gemini ; écarte ceux sans libellé. */
export function interpreterCourses(bruts: Record<string, unknown>[], existants: ArticleConnu[]): CoursePropose[] {
  const actifs = new Set(existants.filter((a) => !a.coche).map((a) => cleDoublon(a.libelle)));
  const archives = new Set(existants.filter((a) => a.coche).map((a) => cleDoublon(a.libelle)));
  const vus = new Set<string>();

  // Même décision que le serveur à la création (planifierAjoutCourses) : la
  // proposition dit d'avance ce qui va se passer pour chaque article.
  const propositions: CoursePropose[] = [];
  for (const brut of bruts) {
    const libelle = texteOuNull(brut.libelle, LONGUEUR_MAX_LIBELLE_COURSE);
    if (!libelle) continue;
    const cle = cleDoublon(libelle);
    const avertissements: string[] = [];
    if (vus.has(cle) || actifs.has(cle)) avertissements.push("Déjà dans la liste : ne sera pas ajouté une seconde fois.");
    else if (archives.has(cle)) avertissements.push("Déjà acheté récemment : sera remis dans la liste.");
    vus.add(cle);
    propositions.push({ libelle, avertissements });
  }
  return propositions;
}

export function lignesContexteCourses(existants: ArticleConnu[]): string[] {
  const actifs = existants.filter((a) => !a.coche).map((a) => a.libelle);
  return [`Articles déjà sur la liste de courses (JSON) : ${JSON.stringify(actifs.slice(0, 60))}`];
}

export const REGLES_COURSES = [
  "- `courses` : un article par produit à acheter, libellé court avec la quantité si elle est citée (« lait », « 6 œufs »). Ce qui est à acheter va dans `courses`, jamais dans `taches`, sauf si un jour ou une heure est cité (« passer à la pharmacie jeudi » est une tâche).",
  "- Ne mets un article dans `courses` que si Vincent parle de courses, de faire les courses ou d'acheter un produit précis.",
] as const;

export const CAS_QUESTION_COURSES = [] as const;
