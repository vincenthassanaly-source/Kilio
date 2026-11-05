import type { Muscle } from "./constantes";
import type { ExerciceCatalogue } from "./serveur";
import { normalizeSearch } from "@/lib/normalize";

/** Exercices dont le nom ou le matériel contient la recherche, filtrés par muscle principal. */
export function filtrerExercices(
  exercices: readonly ExerciceCatalogue[],
  filtre: { recherche: string; muscle: Muscle | null },
): ExerciceCatalogue[] {
  const mots = normalizeSearch(filtre.recherche).split(/\s+/).filter(Boolean);
  return exercices.filter((e) => {
    if (filtre.muscle && e.muscle !== filtre.muscle) return false;
    if (mots.length === 0) return true;
    const texte = normalizeSearch(`${e.nom} ${e.materiel ?? ""}`);
    return mots.every((m) => texte.includes(m));
  });
}
