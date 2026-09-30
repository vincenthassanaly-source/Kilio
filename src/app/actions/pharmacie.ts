"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { estNoteRevision, prochainEtatCarte } from "@/lib/pharmacie/srs";
import type { PharmaCarte, PharmaChapitre, PharmaMatiere, PharmaNotion, PharmaSnapshot } from "@/lib/pharmacie/types";

// Lecture unique : arborescence + notions + cartes (voir lib/pharmacie/types.ts).
// Les écritures d'ajout passent par le skill `kilio-pharmacie-ajout` (chat),
// pas par l'app : ici seulement la révision, la correction et la suppression.
export async function getPharmacieSnapshot(): Promise<PharmaSnapshot> {
  const supabase = createAdminClient();

  const [matieres, chapitres, notions, cartes] = await Promise.all([
    fetchAllRows<PharmaMatiere>((from, to) =>
      supabase.from("pharma_matieres").select("*").order("ordre").order("nom").range(from, to)
    ),
    fetchAllRows<PharmaChapitre>((from, to) =>
      supabase.from("pharma_chapitres").select("*").order("ordre").order("nom").range(from, to)
    ),
    fetchAllRows<PharmaNotion>((from, to) =>
      supabase.from("pharma_notions").select("*").order("ordre").order("created_at").range(from, to)
    ),
    fetchAllRows<PharmaCarte>((from, to) =>
      supabase
        .from("pharma_cartes")
        .select("id, notion_id, question, reponse, echeance, intervalle_jours, facilite, repetitions, dernier_passage")
        .order("id")
        .range(from, to)
    ),
  ]);

  return { matieres, chapitres, notions, cartes, genereLe: new Date().toISOString() };
}

// Lève en cas d'échec (au lieu de retourner `fail`) : rejouée par la file
// hors ligne (lib/offline/queue.ts), qui s'appuie sur l'exception pour
// décider d'un rejeu. `quandISO` est l'instant réel de la réponse, pour
// qu'un rejeu tardif ne décale pas l'échéance.
export async function noterCarte(carteId: string, note: string, quandISO?: string): Promise<void> {
  if (!estNoteRevision(note)) throw new Error("Note de révision invalide.");
  const quand = quandISO ? new Date(quandISO) : new Date();
  if (Number.isNaN(quand.getTime())) throw new Error("Date invalide.");

  const supabase = createAdminClient();
  const { data: carte, error } = await supabase
    .from("pharma_cartes")
    .select("intervalle_jours, facilite, repetitions")
    .eq("id", carteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // Carte supprimée entre-temps (notion supprimée) : rien à noter.
  if (!carte) return;

  const suivant = prochainEtatCarte(carte, note, quand);
  const { error: updateError } = await supabase.from("pharma_cartes").update(suivant).eq("id", carteId);
  if (updateError) throw new Error(updateError.message);
}

function nettoyerTags(brut: string[]): string[] {
  return [...new Set(brut.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
}

export async function modifierNotion(
  id: string,
  champs: { titre: string; contenu: string; tags: string[] }
): Promise<ActionResult> {
  const titre = champs.titre.trim();
  const contenu = champs.contenu.trim();
  if (!titre) return fail("Le titre est requis.");
  if (!contenu) return fail("Le contenu est requis.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pharma_notions")
    .update({ titre, contenu, tags: nettoyerTags(champs.tags), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/pharmacie");
  return ok();
}

export async function supprimerNotion(id: string): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("pharma_notions").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/pharmacie");
  return ok();
}
