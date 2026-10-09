"use server";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { NOTES_TAG } from "@/lib/notes/tags";
import { creerTacheRapide } from "@/lib/taches/creation-rapide";
import { TACHES_TAG } from "@/lib/taches/tags";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { estUuid } from "@/lib/uuid";
import { estCouleurValide } from "@/lib/notes/palette";
import type { Enums, Tables } from "@/lib/supabase/types";

export type NoteFormState = { error: string | null };

type NoteInput = {
  titre: string;
  contenu: string;
  type: Enums<"note_type">;
  couleur: string | null;
};

type ParseResult = { ok: true; value: NoteInput } | { ok: false; error: string };

const TYPES: readonly Enums<"note_type">[] = ["texte", "checklist"];

function parseNoteInput(formData: FormData): ParseResult {
  const titre = String(formData.get("titre") ?? "").trim();
  const contenu = String(formData.get("contenu") ?? "").trim();
  const type = String(formData.get("type") ?? "texte");
  const couleur = String(formData.get("couleur") ?? "").trim();

  if (!titre) return { ok: false, error: "Le titre est requis." };
  if (!TYPES.includes(type as Enums<"note_type">)) {
    return { ok: false, error: "Type de note invalide." };
  }
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

type SupabaseClient = ReturnType<typeof createAdminClient>;

// Même logique que resolveTagIds/syncTachesTags dans src/app/actions/taches.ts
// (upsert sur nom pour la création à la volée, sync par delete+insert) :
// réutilise la table `tags` existante sans dupliquer createTag/deleteTag,
// mais la jonction notes_tags a sa propre table donc son propre sync.
async function resolveTagIds(
  supabase: SupabaseClient,
  tagIds: string[],
  nouveauxNoms: string[]
): Promise<string[]> {
  const ids = new Set(tagIds);

  if (nouveauxNoms.length > 0) {
    const { data, error } = await supabase
      .from("tags")
      .upsert(
        nouveauxNoms.map((nom) => ({ nom })),
        { onConflict: "nom" }
      )
      .select("id");

    if (error) throw new Error(error.message);
    for (const tag of data ?? []) ids.add(tag.id);
  }

  return [...ids];
}

function parseTagFields(formData: FormData): { tagIds: string[]; nouveauxNoms: string[] } {
  const tagIds = formData.getAll("tag_ids").map(String).filter(Boolean);
  const nouveauxNoms = [
    ...new Set(
      String(formData.get("nouveaux_tags") ?? "")
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)
    ),
  ];
  return { tagIds, nouveauxNoms };
}

async function syncNotesTags(supabase: SupabaseClient, noteId: string, tagIds: string[]) {
  const { error: deleteError } = await supabase.from("notes_tags").delete().eq("note_id", noteId);
  if (deleteError) throw new Error(deleteError.message);

  if (tagIds.length > 0) {
    const { error: insertError } = await supabase
      .from("notes_tags")
      .insert(tagIds.map((tag_id) => ({ note_id: noteId, tag_id })));
    if (insertError) throw new Error(insertError.message);
  }
}

function parseItemLibelles(formData: FormData): string[] {
  return formData
    .getAll("item_libelle")
    .map((v) => String(v).trim())
    .filter(Boolean);
}

export async function createNote(
  _prevState: NoteFormState,
  formData: FormData
): Promise<NoteFormState> {
  const parsed = parseNoteInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const { data: note, error } = await supabase
    .from("notes")
    .insert(parsed.value)
    .select("id")
    .single();

  if (error) return { error: error.message };

  try {
    const { tagIds, nouveauxNoms } = parseTagFields(formData);
    const resolvedTagIds = await resolveTagIds(supabase, tagIds, nouveauxNoms);
    await syncNotesTags(supabase, note.id, resolvedTagIds);
  } catch (tagError) {
    return { error: tagError instanceof Error ? tagError.message : "Erreur lors des tags." };
  }

  // Les items d'une checklist créée à la volée sont soumis avec le
  // formulaire (pas encore d'id de note pour appeler addNoteItem) : insertion
  // groupée, position = ordre d'apparition dans le formulaire.
  if (parsed.value.type === "checklist") {
    const libelles = parseItemLibelles(formData);
    if (libelles.length > 0) {
      const { error: itemsError } = await supabase
        .from("note_items")
        .insert(libelles.map((libelle, position) => ({ note_id: note.id, libelle, position })));
      if (itemsError) return { error: itemsError.message };
    }
  }

  revalidatePath("/notes");
  updateTag(NOTES_TAG);
  return { error: null };
}

export async function updateNote(
  _prevState: NoteFormState,
  formData: FormData
): Promise<NoteFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Note introuvable." };

  const parsed = parseNoteInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const { error } = await supabase.from("notes").update(parsed.value).eq("id", id);

  if (error) return { error: error.message };

  try {
    const { tagIds, nouveauxNoms } = parseTagFields(formData);
    const resolvedTagIds = await resolveTagIds(supabase, tagIds, nouveauxNoms);
    await syncNotesTags(supabase, id, resolvedTagIds);
  } catch (tagError) {
    return { error: tagError instanceof Error ? tagError.message : "Erreur lors des tags." };
  }

  // Les items d'une checklist existante sont gérés en direct depuis la
  // carte/le formulaire d'édition via addNoteItem/toggleNoteItem/
  // updateNoteItemLibelle/deleteNoteItem/reorderNoteItems, pas ici.
  revalidatePath("/notes");
  updateTag(NOTES_TAG);
  return { error: null };
}

export async function deleteNote(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/notes");
  updateTag(NOTES_TAG);
}

export async function toggleEpingle(id: string, epingle: boolean) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("notes").update({ epingle }).eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/notes");
  updateTag(NOTES_TAG);
}

// --- Items de checklist ---

export async function addNoteItem(noteId: string, libelle: string) {
  const trimmed = libelle.trim();
  if (!trimmed) throw new Error("Le libellé de l'item est requis.");

  const supabase = createAdminClient();

  const { data: dernier } = await supabase
    .from("note_items")
    .select("position")
    .eq("note_id", noteId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("note_items")
    .insert({ note_id: noteId, libelle: trimmed, position: (dernier?.position ?? -1) + 1 });

  if (error) throw new Error(error.message);

  revalidatePath("/notes");
  updateTag(NOTES_TAG);
}

export async function toggleNoteItem(id: string, coche: boolean) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("note_items").update({ coche }).eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/notes");
  updateTag(NOTES_TAG);
}

export async function updateNoteItemLibelle(id: string, libelle: string) {
  const trimmed = libelle.trim();
  if (!trimmed) throw new Error("Le libellé de l'item est requis.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("note_items").update({ libelle: trimmed }).eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/notes");
  updateTag(NOTES_TAG);
}

export async function deleteNoteItem(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("note_items").delete().eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/notes");
  updateTag(NOTES_TAG);
}

// Réordonnance simple par échange avec l'item voisin, au sein de la même
// note (même pattern que reordonnerSousTaches/reordonnerTaches dans
// src/app/actions/taches.ts — pas de drag & drop dans le codebase).
export async function reorderNoteItems(noteId: string, id: string, direction: "haut" | "bas") {
  const supabase = createAdminClient();

  const { data: items, error } = await supabase
    .from("note_items")
    .select("id, position")
    .eq("note_id", noteId)
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);
  if (!items) return;

  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return;

  const voisinIndex = direction === "haut" ? index - 1 : index + 1;
  if (voisinIndex < 0 || voisinIndex >= items.length) return;

  const actuel = items[index];
  const voisin = items[voisinIndex];

  const [{ error: err1 }, { error: err2 }] = await Promise.all([
    supabase.from("note_items").update({ position: voisin.position }).eq("id", actuel.id),
    supabase.from("note_items").update({ position: actuel.position }).eq("id", voisin.id),
  ]);

  if (err1) throw new Error(err1.message);
  if (err2) throw new Error(err2.message);

  revalidatePath("/notes");
  updateTag(NOTES_TAG);
}

// --- Tags sur une note ---
// Compléments granulaires à la sync tag_ids/nouveaux_tags faite dans
// createNote/updateNote : utiles pour ajouter/retirer un tag sur une note
// existante sans repasser par tout le formulaire.

// --- Lecture avec relations ---

export type NoteAvecRelations = Tables<"notes"> & {
  items: Tables<"note_items">[];
  tags: Tables<"tags">[];
};

export async function getNotesAvecRelations(): Promise<NoteAvecRelations[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("notes")
    .select(
      "*, note_items(id, note_id, libelle, coche, termine_le, position, created_at, updated_at), notes_tags(tag:tags(id, nom, couleur, created_at))"
    )
    .order("epingle", { ascending: false })
    .order("created_at", { ascending: false })
    .order("position", { referencedTable: "note_items", ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map(({ note_items, notes_tags, ...note }) => ({
    ...note,
    items: note_items,
    tags: notes_tags.map((nt) => nt.tag).filter((tag): tag is Tables<"tags"> => tag !== null),
  }));
}

// --- Note → tâche -------------------------------------------------------------
// La note n'est pas modifiée : la tâche garde un lien (`taches.note_id`) et la
// mention de son origine dans ses notes.

function revalidateApresCreationTache() {
  revalidateTag(TACHES_TAG, { expire: 0 });
  revalidatePath("/taches");
  revalidatePath("/agenda");
}

/** Crée une tâche à partir d'une note (titre = titre de la note, contenu en notes). */
export async function noteVersTache(noteId: string): Promise<ActionResult<{ id: string }>> {
  if (!estUuid(noteId)) return fail("Note introuvable.");
  const supabase = createAdminClient();
  const { data: note, error } = await supabase
    .from("notes")
    .select("titre, contenu, type, note_items(libelle, coche, position)")
    .eq("id", noteId)
    .maybeSingle();
  if (error) return fail(error.message);
  if (!note) return fail("Note introuvable.");

  // Checklist : les éléments restant à faire deviennent les notes de la tâche.
  const details =
    note.type === "checklist"
      ? [...note.note_items]
          .filter((i) => !i.coche)
          .sort((a, b) => a.position - b.position)
          .map((i) => `- ${i.libelle}`)
          .join("\n")
      : note.contenu;

  const creation = await creerTacheRapide(supabase, { titre: note.titre, notes: details, note_id: noteId });
  if (!creation.ok) return fail(creation.error);

  revalidateApresCreationTache();
  return ok({ id: creation.id });
}

/** Crée une tâche à partir d'un élément de checklist (l'élément reste dans la note). */
export async function noteItemVersTache(itemId: string): Promise<ActionResult<{ id: string }>> {
  if (!estUuid(itemId)) return fail("Élément introuvable.");
  const supabase = createAdminClient();
  const { data: item, error } = await supabase
    .from("note_items")
    .select("libelle, note_id, note:notes(titre)")
    .eq("id", itemId)
    .maybeSingle();
  if (error) return fail(error.message);
  if (!item) return fail("Élément introuvable.");

  const creation = await creerTacheRapide(supabase, {
    titre: item.libelle,
    notes: item.note ? `Depuis la note « ${item.note.titre} »` : null,
    note_id: item.note_id,
  });
  if (!creation.ok) return fail(creation.error);

  revalidateApresCreationTache();
  return ok({ id: creation.id });
}
