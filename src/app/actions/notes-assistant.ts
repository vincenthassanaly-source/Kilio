"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { appelerGemini } from "@/lib/gemini/appel";
import { messageEchec } from "@/lib/gemini/analyse";
import { creerCacheCourt, empreinte } from "@/lib/gemini/cache-court";
import {
  CONTENU_MAX,
  MODES_ASSISTANT,
  SCHEMA_REFORMULATION,
  SCHEMA_RESUME,
  SCHEMA_TAGS,
  TAGS_NOUVEAUX_MAX,
  construirePromptReformulation,
  construirePromptResume,
  construirePromptTags,
  lireReformulation,
  lireResume,
  lireTags,
  nettoyerContenu,
  nettoyerNomTag,
  nettoyerTitre,
  texteDeNote,
  type ModeAssistantNote,
  type PropositionNote,
} from "@/lib/notes/assistant";
import { NOTES_TAG } from "@/lib/notes/tags";
import { createAdminClient } from "@/lib/supabase/admin";
import { estUuid } from "@/lib/uuid";

// Assistant IA d'une note. Deux étapes : `proposerPourNote` appelle Gemini et
// ne touche à rien ; `appliquerPropositionNote` écrit, après le clic sur
// « Appliquer ». Le résultat d'un appel est gardé quelques minutes (même note,
// même texte, mêmes tags) pour qu'un second clic ne rappelle pas Gemini ;
// « Régénérer » passe outre.

const GEMINI_TIMEOUT_MS = 30_000;
const CACHE_DUREE_MS = 10 * 60_000;
const CACHE_TAILLE_MAX = 100;

const cache = creerCacheCourt<PropositionNote>(CACHE_DUREE_MS, CACHE_TAILLE_MAX);

function revalider() {
  revalidatePath("/notes");
  updateTag(NOTES_TAG);
}

export async function proposerPourNote(
  noteId: string,
  mode: ModeAssistantNote,
  regenerer = false
): Promise<ActionResult<PropositionNote>> {
  if (typeof noteId !== "string" || !estUuid(noteId)) return fail("Note introuvable.");
  if (!MODES_ASSISTANT.includes(mode)) return fail("Action inconnue.");

  const supabase = createAdminClient();
  const { data: note, error } = await supabase
    .from("notes")
    .select("titre, contenu, type, note_items(libelle, coche, position), notes_tags(tag_id, tag:tags(nom))")
    .eq("id", noteId)
    .maybeSingle();
  if (error) return fail("La note n'a pas pu être lue.");
  if (!note) return fail("Cette note n'existe plus.");

  if (mode === "reformuler" && note.type !== "texte") {
    return fail("Seules les notes de type texte peuvent être reformulées.");
  }
  const texte = texteDeNote({ type: note.type, contenu: note.contenu, items: note.note_items });
  if (texte === "") return fail("Cette note est vide : il n'y a rien à analyser.");
  if (texte.length > CONTENU_MAX) return fail("Cette note est trop longue pour l'assistant.");

  const idsDeLaNote = note.notes_tags.map((nt) => nt.tag_id);
  let tagsExistants: { id: string; nom: string }[] = [];
  if (mode === "tags") {
    const { data: tags, error: tagsError } = await supabase.from("tags").select("id, nom").order("nom");
    if (tagsError) return fail("Les tags n'ont pas pu être lus.");
    tagsExistants = tags ?? [];
  }

  const cle = empreinte(
    noteId,
    mode,
    note.titre,
    texte,
    ...(mode === "tags" ? [tagsExistants.map((t) => `${t.id}:${t.nom}`).join(","), idsDeLaNote.slice().sort().join(",")] : [])
  );
  if (!regenerer) {
    const enCache = cache.lire(cle);
    if (enCache) return ok(enCache);
  }

  let prompt: string;
  let schema: unknown;
  if (mode === "resume") {
    prompt = construirePromptResume(note.titre, texte);
    schema = SCHEMA_RESUME;
  } else if (mode === "reformuler") {
    prompt = construirePromptReformulation(note.titre, texte);
    schema = SCHEMA_REFORMULATION;
  } else {
    const nomsDeLaNote = note.notes_tags.map((nt) => nt.tag?.nom).filter((n): n is string => !!n);
    prompt = construirePromptTags(
      note.titre,
      texte,
      tagsExistants.map((t) => t.nom),
      nomsDeLaNote
    );
    schema = SCHEMA_TAGS;
  }

  const resultat = await appelerGemini({
    prompt,
    schema,
    timeoutMs: GEMINI_TIMEOUT_MS,
    temperature: mode === "reformuler" ? 0.2 : 0.3,
    etiquette: `note-assistant-${mode}`,
  });
  if (!resultat.ok) return fail(messageEchec(resultat));

  const proposition =
    mode === "resume"
      ? lireResume(resultat.brut)
      : mode === "reformuler"
        ? lireReformulation(resultat.brut)
        : lireTags(resultat.brut, tagsExistants, idsDeLaNote);
  if (!proposition) {
    return fail(
      mode === "tags"
        ? "Gemini ne voit aucun tag pertinent à ajouter à cette note."
        : "Réponse de Gemini inutilisable. Réessaie."
    );
  }

  cache.ecrire(cle, proposition);
  return ok(proposition);
}

export type ApplicationNote =
  | { mode: "resume"; titre?: string; resume?: string }
  | { mode: "reformuler"; contenu: string }
  | { mode: "tags"; tagIds: string[]; nouveaux: string[] };

export async function appliquerPropositionNote(
  noteId: string,
  application: ApplicationNote
): Promise<ActionResult> {
  if (typeof noteId !== "string" || !estUuid(noteId)) return fail("Note introuvable.");
  if (typeof application !== "object" || application === null) return fail("Proposition invalide.");

  const supabase = createAdminClient();
  const { data: note, error } = await supabase
    .from("notes")
    .select("contenu, type")
    .eq("id", noteId)
    .maybeSingle();
  if (error) return fail("La note n'a pas pu être lue.");
  if (!note) return fail("Cette note n'existe plus.");

  if (application.mode === "resume") {
    const titre = nettoyerTitre(application.titre);
    const resume = typeof application.resume === "string" ? application.resume.trim() : "";
    const changements: { titre?: string; contenu?: string } = {};
    if (titre) changements.titre = titre;
    if (resume) {
      if (note.type !== "texte") return fail("Le résumé ne peut être ajouté qu'à une note de type texte.");
      const contenu = note.contenu.trim() ? `${resume}\n\n${note.contenu}` : resume;
      if (contenu.length > CONTENU_MAX) return fail("La note deviendrait trop longue.");
      changements.contenu = contenu;
    }
    if (Object.keys(changements).length === 0) return fail("Rien à appliquer.");
    const { error: ecritureError } = await supabase.from("notes").update(changements).eq("id", noteId);
    if (ecritureError) return fail("La note n'a pas pu être modifiée. Réessaie.");
    revalider();
    return ok();
  }

  if (application.mode === "reformuler") {
    if (note.type !== "texte") return fail("Seules les notes de type texte peuvent être reformulées.");
    const contenu = nettoyerContenu(application.contenu);
    if (contenu === "") return fail("Le texte reformulé est vide.");
    if (contenu.length > CONTENU_MAX) return fail("Le texte reformulé est trop long.");
    const { error: ecritureError } = await supabase.from("notes").update({ contenu }).eq("id", noteId);
    if (ecritureError) return fail("La note n'a pas pu être modifiée. Réessaie.");
    revalider();
    return ok();
  }

  if (application.mode === "tags") {
    const demandes = (Array.isArray(application.tagIds) ? application.tagIds : []).filter(
      (id): id is string => typeof id === "string" && estUuid(id)
    );
    const nouveauxNoms = [
      ...new Set(
        (Array.isArray(application.nouveaux) ? application.nouveaux : [])
          .map(nettoyerNomTag)
          .filter((nom) => nom !== "")
      ),
    ].slice(0, TAGS_NOUVEAUX_MAX);
    if (demandes.length === 0 && nouveauxNoms.length === 0) return fail("Aucun tag à ajouter.");

    try {
      const ids = new Set<string>();
      if (demandes.length > 0) {
        const { data, error: lectureError } = await supabase.from("tags").select("id").in("id", demandes);
        if (lectureError) throw new Error(lectureError.message);
        for (const tag of data ?? []) ids.add(tag.id);
      }
      if (nouveauxNoms.length > 0) {
        const { data, error: creationError } = await supabase
          .from("tags")
          .upsert(
            nouveauxNoms.map((nom) => ({ nom })),
            { onConflict: "nom" }
          )
          .select("id");
        if (creationError) throw new Error(creationError.message);
        for (const tag of data ?? []) ids.add(tag.id);
      }

      // Ajout seulement : les tags déjà posés sur la note restent.
      const { data: actuels, error: actuelsError } = await supabase
        .from("notes_tags")
        .select("tag_id")
        .eq("note_id", noteId);
      if (actuelsError) throw new Error(actuelsError.message);
      const dejaLa = new Set((actuels ?? []).map((nt) => nt.tag_id));
      const aAjouter = [...ids].filter((id) => !dejaLa.has(id));
      if (aAjouter.length > 0) {
        const { error: insertError } = await supabase
          .from("notes_tags")
          .insert(aAjouter.map((tag_id) => ({ note_id: noteId, tag_id })));
        if (insertError) throw new Error(insertError.message);
      }
    } catch (err) {
      console.error("appliquerPropositionNote: tags", err);
      revalider();
      return fail("Les tags n'ont pas pu être ajoutés. Réessaie.");
    }
    revalider();
    return ok();
  }

  return fail("Action inconnue.");
}
