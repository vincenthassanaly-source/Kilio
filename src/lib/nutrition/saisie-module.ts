import type { ModuleIAServeur } from "@/lib/saisie-ia/module";
import type { ElementACreer, IssueCreation } from "@/lib/saisie-ia/types";
import { addJournalEntry, getCatalogueJournal } from "@/app/actions/journal";
import { heureParis } from "@/lib/date/paris";
import {
  CAS_QUESTION_REPAS,
  MAX_REPAS_PROPOSES,
  REGLES_REPAS,
  interpreterRepas,
  lignesContexteRepas,
  repasComplet,
  type RepasACreer,
} from "./saisie-naturelle";

// Module « Repas » de « Ajouter avec l'IA » (facette serveur).

const MESSAGE_A_PRECISER = "Aliment ou quantité à préciser : utilise « Modifier ».";

export const moduleRepas: ModuleIAServeur = {
  type: "repas",
  cle: "repas",
  libelle: "repas",
  max: MAX_REPAS_PROPOSES,
  schemaElement: {
    type: "object",
    properties: {
      aliment: { type: "string" },
      correspondance: { type: "string" },
      quantite: { type: "number" },
      unite: { type: "string" },
      moment: { type: "string" },
      date: { type: "string" },
    },
    required: ["aliment", "correspondance", "quantite", "unite", "moment", "date"],
  },
  regles: REGLES_REPAS,
  casQuestion: CAS_QUESTION_REPAS,

  async preparer(aujourdhui) {
    const { items } = await getCatalogueJournal();
    const [h, m] = heureParis().split(":").map(Number);
    const ctx = { catalogue: items, aujourdhui, heure: h + m / 60 };
    return {
      lignesContexte: lignesContexteRepas(items),
      interpreter: (bruts) => interpreterRepas(bruts, ctx).map((donnees) => ({ type: "repas" as const, donnees })),
    };
  },

  // Un repas à la fois par addJournalEntry : mêmes contrôles (moment, date,
  // quantité positive) que le panneau d'ajout manuel.
  async creer(elements: ElementACreer[]) {
    const issues: IssueCreation[] = [];
    for (const e of elements) {
      if (e.type !== "repas") continue;
      issues.push(await creerRepas(e.donnees));
    }
    return issues;
  },
};

async function creerRepas(r: RepasACreer): Promise<IssueCreation> {
  if (!r?.cible || !repasComplet(r)) return { ok: false, message: MESSAGE_A_PRECISER };
  try {
    const formData = new FormData();
    formData.set("type", String(r.cible.type));
    formData.set(r.cible.type === "aliment" ? "aliment_id" : "recette_id", String(r.cible.id));
    // Quantité déjà convertie (g/ml, ou portions pour une recette).
    formData.set("quantite", String(r.quantite));
    formData.set("saisie_mode", "grammes");
    formData.set("moment", String(r.moment));
    formData.set("date", String(r.date));
    const etat = await addJournalEntry({ error: null }, formData);
    return etat.error ? { ok: false, message: etat.error } : { ok: true };
  } catch (err) {
    console.error("[saisie-ia] Création d'un repas en échec.", err);
    return { ok: false, message: "Le repas n'a pas pu être ajouté. Réessaie." };
  }
}
