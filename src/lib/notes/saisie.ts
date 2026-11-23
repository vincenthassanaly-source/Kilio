import { estCouleurValide } from "@/lib/notes/palette";
import type { Enums } from "@/lib/supabase/types";

export type NoteInput = {
  titre: string;
  contenu: string;
  type: Enums<"note_type">;
  couleur: string | null;
};

export type ParseNoteResult = { ok: true; value: NoteInput } | { ok: false; error: string };

const TYPES: readonly Enums<"note_type">[] = ["texte", "checklist"];

/**
 * Lit et valide les champs d'une note. Le titre n'est requis que pour une
 * note texte : une checklist (« courses du week-end », liste rapide) se
 * comprend par ses items, on peut la laisser sans titre (enregistré vide).
 */
export function parseNoteInput(formData: FormData): ParseNoteResult {
  const titre = String(formData.get("titre") ?? "").trim();
  const contenu = String(formData.get("contenu") ?? "").trim();
  const type = String(formData.get("type") ?? "texte");
  const couleur = String(formData.get("couleur") ?? "").trim();

  if (!TYPES.includes(type as Enums<"note_type">)) {
    return { ok: false, error: "Type de note invalide." };
  }
  if (type === "texte" && !titre) return { ok: false, error: "Le titre est requis." };
  if (couleur && !estCouleurValide(couleur)) {
    return { ok: false, error: "Couleur invalide." };
  }
  // Une checklist porte son contenu dans note_items, pas dans notes.contenu :
  // seul le type "texte" exige un contenu.
  if (type === "texte" && !contenu) {
    return { ok: false, error: "Le contenu est requis." };
  }

  return {
    ok: true,
    value: { titre, contenu, type: type as Enums<"note_type">, couleur: couleur || null },
  };
}

/** Libellé d'une checklist sans titre (feuille de lecture, annonces, toasts). */
export const TITRE_LISTE_SANS_TITRE = "Liste sans titre";

/** Titre à afficher ou à annoncer : celui de la note, sinon le libellé de repli. */
export function titreNote(note: { titre: string }): string {
  return note.titre.trim() || TITRE_LISTE_SANS_TITRE;
}
