"use server";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { decouperCapture } from "@/lib/inbox/compute";
import { NOTES_TAG } from "@/lib/notes/tags";
import { creerTacheRapide } from "@/lib/taches/creation-rapide";
import { TACHES_TAG } from "@/lib/taches/tags";
import { estUuid } from "@/lib/uuid";
import type { Tables } from "@/lib/supabase/types";

export type InboxItem = Tables<"inbox_items">;

const TEXTE_MAX = 4000;

export async function getInboxItems(): Promise<InboxItem[]> {
  const supabase = createAdminClient();
  // Plus ancien d'abord : on trie dans l'ordre d'arrivée.
  const { data, error } = await supabase.from("inbox_items").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getInboxCount(): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase.from("inbox_items").select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function addInboxItem(texte: string): Promise<ActionResult<{ id: string }>> {
  const propre = texte.trim();
  if (!propre) return fail("Écris quelque chose à capturer.");
  if (propre.length > TEXTE_MAX) return fail("Capture trop longue.");

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("inbox_items").insert({ texte: propre }).select("id").single();
  if (error) return fail(error.message);

  revalidatePath("/inbox");
  return ok({ id: data.id });
}

export async function deleteInboxItem(id: string): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Élément introuvable.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("inbox_items").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/inbox");
  return ok();
}

async function lireItem(id: string): Promise<InboxItem | null> {
  if (!estUuid(id)) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.from("inbox_items").select("*").eq("id", id).maybeSingle();
  return data;
}

/** Capture → tâche (première liste, sans échéance). La capture est retirée de l'inbox. */
export async function inboxVersTache(id: string): Promise<ActionResult<{ id: string }>> {
  const item = await lireItem(id);
  if (!item) return fail("Élément introuvable.");

  const supabase = createAdminClient();
  const { titre, reste } = decouperCapture(item.texte);
  const creation = await creerTacheRapide(supabase, { titre, notes: reste });
  if (!creation.ok) return fail(creation.error);

  await supabase.from("inbox_items").delete().eq("id", id);
  revalidateTag(TACHES_TAG, { expire: 0 });
  revalidatePath("/taches");
  revalidatePath("/agenda");
  revalidatePath("/inbox");
  return ok({ id: creation.id });
}

/** Capture → note texte. La capture est retirée de l'inbox. */
export async function inboxVersNote(id: string): Promise<ActionResult<{ id: string }>> {
  const item = await lireItem(id);
  if (!item) return fail("Élément introuvable.");

  const supabase = createAdminClient();
  const { titre, reste } = decouperCapture(item.texte);
  const { data, error } = await supabase
    .from("notes")
    .insert({ titre, contenu: reste ?? "", type: "texte" })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await supabase.from("inbox_items").delete().eq("id", id);
  updateTag(NOTES_TAG);
  revalidatePath("/notes");
  revalidatePath("/inbox");
  return ok({ id: data.id });
}
