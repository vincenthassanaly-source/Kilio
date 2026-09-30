import type { ModuleIAServeur } from "@/lib/saisie-ia/module";
import type { ElementACreer } from "@/lib/saisie-ia/types";
import { createNote } from "@/app/actions/notes";
import { getTags } from "@/app/actions/taches";
import {
  CAS_QUESTION_NOTES,
  MAX_NOTES_PROPOSEES,
  REGLES_NOTES,
  interpreterNotes,
  lignesContexteNotes,
  type NotePropose,
} from "./saisie-naturelle";

// Module « Notes » de « Ajouter avec l'IA » (facette serveur).

export const moduleNotes: ModuleIAServeur = {
  type: "note",
  cle: "notes",
  libelle: "notes",
  max: MAX_NOTES_PROPOSEES,
  schemaElement: {
    type: "object",
    properties: {
      titre: { type: "string" },
      type: { type: "string", enum: ["texte", "checklist"] },
      contenu: { type: "string" },
      items: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
      idee: { type: "boolean" },
    },
    required: ["titre", "type", "contenu", "items", "tags", "idee"],
  },
  regles: REGLES_NOTES,
  casQuestion: CAS_QUESTION_NOTES,

  async preparer() {
    const tags = (await getTags()).map((t) => ({ id: t.id, nom: t.nom }));
    return {
      lignesContexte: lignesContexteNotes(tags),
      interpreter: (bruts) => interpreterNotes(bruts, tags).map((donnees) => ({ type: "note" as const, donnees })),
    };
  },

  // Une note à la fois : createNote passe par le même parse (titre, type,
  // contenu requis) que le formulaire manuel.
  async creer(elements: ElementACreer[]) {
    const issues = [];
    for (const e of elements) {
      if (e.type !== "note") continue;
      issues.push(await creerNote(e.donnees));
    }
    return issues;
  },
};

async function creerNote(n: NotePropose) {
  try {
    const formData = new FormData();
    formData.set("titre", String(n.titre ?? ""));
    formData.set("type", String(n.type ?? "texte"));
    formData.set("contenu", n.type === "texte" ? String(n.contenu ?? "") : "");
    formData.set("couleur", "");
    if (n.type === "checklist") {
      for (const item of Array.isArray(n.items) ? n.items : []) formData.append("item_libelle", String(item));
    }
    for (const id of Array.isArray(n.tagIds) ? n.tagIds : []) formData.append("tag_ids", String(id));
    // Virgules retirées : createNote découpe `nouveaux_tags` sur ce signe.
    formData.set(
      "nouveaux_tags",
      (Array.isArray(n.nouveauxTags) ? n.nouveauxTags : []).map((t) => String(t).replace(/,/g, " ")).join(",")
    );
    const etat = await createNote({ error: null }, formData);
    return etat.error ? { ok: false as const, message: etat.error } : { ok: true as const };
  } catch (err) {
    console.error("[saisie-ia] Création d'une note en échec.", err);
    return { ok: false as const, message: "La note n'a pas pu être créée. Réessaie." };
  }
}
