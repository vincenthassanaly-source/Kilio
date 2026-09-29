import type { ModuleIAServeur } from "@/lib/saisie-ia/module";
import type { ElementACreer } from "@/lib/saisie-ia/types";
import { ajouterArticlesCourses, getCoursesItems } from "@/app/actions/courses";
import {
  CAS_QUESTION_COURSES,
  MAX_COURSES_PROPOSEES,
  REGLES_COURSES,
  interpreterCourses,
  lignesContexteCourses,
} from "./saisie-naturelle";

// Module « Courses » de « Ajouter avec l'IA » (facette serveur).

export const moduleCourses: ModuleIAServeur = {
  type: "course",
  cle: "courses",
  libelle: "articles de courses",
  max: MAX_COURSES_PROPOSEES,
  schemaElement: {
    type: "object",
    properties: { libelle: { type: "string" } },
    required: ["libelle"],
  },
  regles: REGLES_COURSES,
  casQuestion: CAS_QUESTION_COURSES,

  async preparer() {
    const existants = (await getCoursesItems()).map((a) => ({ id: a.id, libelle: a.libelle, coche: a.coche }));
    return {
      lignesContexte: lignesContexteCourses(existants),
      interpreter: (bruts) =>
        interpreterCourses(bruts, existants).map((donnees) => ({ type: "course" as const, donnees })),
    };
  },

  // Un seul appel pour tout le lot : ajouterArticlesCourses rejoue côté serveur
  // la décision créer / remettre / déjà présent sur les données fraîches.
  async creer(elements: ElementACreer[]) {
    const libelles = elements.map((e) => (e.type === "course" ? e.donnees.libelle : ""));
    const resultat = await ajouterArticlesCourses(libelles);
    const deja = new Set(resultat.dejaPresents.map((l) => l.toLowerCase()));
    return libelles.map((libelle) =>
      deja.has(libelle.toLowerCase())
        ? { ok: true as const, avertissement: `« ${libelle} » était déjà dans la liste.` }
        : { ok: true as const }
    );
  },
};
