import type { Muscle } from "./constantes";
import type { ExerciceCatalogue } from "./serveur";

/** Minuscules sans accents : « Développé » se trouve en tapant « developpe ». */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Exercices dont le nom ou le matériel contient la recherche, filtrés par muscle principal. */
export function filtrerExercices(
  exercices: readonly ExerciceCatalogue[],
  filtre: { recherche: string; muscle: Muscle | null },
): ExerciceCatalogue[] {
  const mots = normaliser(filtre.recherche).split(/\s+/).filter(Boolean);
  return exercices.filter((e) => {
    if (filtre.muscle && e.muscle !== filtre.muscle) return false;
    if (mots.length === 0) return true;
    const texte = normaliser(`${e.nom} ${e.materiel ?? ""}`);
    return mots.every((m) => texte.includes(m));
  });
}
