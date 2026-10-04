import { EQUIPEMENT_AUTRE } from "./libelles";
import type { TypeMesure } from "./seance";
import type { PosesExercice } from "./silhouette";

/** Ligne légère de la bibliothèque : tout ce qu'il faut pour la liste et les filtres. */
export type ExerciceListe = {
  id: string;
  nom_fr: string;
  nom_en: string;
  muscle_principal: string;
  equipement: string | null;
  categorie: string;
  niveau: string | null;
  typeMesure: TypeMesure;
  /** Chemin de la première image dans le bucket, ou null si l'exercice n'en a pas. */
  image: string | null;
  /** Poses de l'illustration dessinée ; null tant qu'elles ne sont pas validées (photo affichée). */
  poses: PosesExercice | null;
};

export type FiltresExercices = {
  recherche: string;
  muscle: string | null;
  equipement: string | null;
};

/** Minuscules sans accents ni diacritiques, espaces réduits : « Développé » → « developpe ». */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Texte de recherche d'un exercice (noms français et anglais), à précalculer une fois. */
export function texteRecherche(exercice: Pick<ExerciceListe, "nom_fr" | "nom_en">): string {
  return normaliser(`${exercice.nom_fr} ${exercice.nom_en}`);
}

/**
 * Filtre la bibliothèque : chaque mot de la recherche doit apparaître dans le
 * nom (français ou anglais), le muscle principal et l'équipement doivent
 * correspondre s'ils sont choisis. L'ordre d'entrée est conservé.
 */
export function filtrerExercices<T extends ExerciceListe>(
  exercices: readonly T[],
  filtres: FiltresExercices,
  recherches: ReadonlyMap<string, string>,
): T[] {
  const mots = normaliser(filtres.recherche).split(" ").filter(Boolean);
  return exercices.filter((exercice) => {
    if (filtres.muscle && exercice.muscle_principal !== filtres.muscle) return false;
    if (filtres.equipement && (exercice.equipement ?? EQUIPEMENT_AUTRE) !== filtres.equipement) return false;
    if (mots.length === 0) return true;
    const texte = recherches.get(exercice.id) ?? texteRecherche(exercice);
    return mots.every((mot) => texte.includes(mot));
  });
}
