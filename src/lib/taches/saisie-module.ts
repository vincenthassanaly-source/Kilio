import type { ModuleIAServeur } from "@/lib/saisie-ia/module";
import type { ElementACreer } from "@/lib/saisie-ia/types";
import { getListes, getTags } from "@/app/actions/taches";
import { creerTaches } from "./saisie-creation";
import {
  CAS_QUESTION_TACHES,
  MAX_TACHES,
  REGLES_TACHES,
  interpreterTaches,
  lignesContexteTaches,
  type TacheACreer,
} from "./saisie-naturelle";

// Module « Tâches » de « Ajouter avec l'IA » (facette serveur).

const SCHEMA_TACHE = {
  type: "object",
  properties: {
    titre: { type: "string" },
    date: { type: "string" },
    heure: { type: "string" },
    heure_fin: { type: "string" },
    toute_la_journee: { type: "boolean" },
    priorite: { type: "string" },
    rappel_minutes: { type: "integer" },
    recurrence_frequence: { type: "string" },
    recurrence_non_supportee: { type: "string" },
    recurrence_fin: { type: "string" },
    liste: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
  },
  required: [
    "titre",
    "date",
    "heure",
    "heure_fin",
    "toute_la_journee",
    "priorite",
    "rappel_minutes",
    "recurrence_frequence",
    "recurrence_non_supportee",
    "recurrence_fin",
    "liste",
    "tags",
  ],
};

export const moduleTaches: ModuleIAServeur = {
  type: "tache",
  cle: "taches",
  libelle: "tâches",
  max: MAX_TACHES,
  schemaElement: SCHEMA_TACHE,
  regles: REGLES_TACHES,
  casQuestion: CAS_QUESTION_TACHES,

  async preparer() {
    const [listes, tags] = await Promise.all([getListes(), getTags()]);
    const ctx = {
      listes: listes.map((l) => ({ id: l.id, nom: l.nom })),
      tags: tags.map((t) => ({ id: t.id, nom: t.nom })),
    };
    return {
      lignesContexte: lignesContexteTaches(ctx),
      interpreter: (bruts) =>
        interpreterTaches(bruts, ctx).map((donnees) => ({ type: "tache" as const, donnees })),
    };
  },

  creer(elements: ElementACreer[]) {
    return creerTaches(elements.map((e) => e.donnees as TacheACreer));
  },
};
