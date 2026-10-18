"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  POSITION_MAX,
  champsDepuisLigne,
  champsIdentiques,
  colonnesDepuisChamps,
  estStatut,
  type ChampsIdee,
  type Statut,
} from "@/lib/opinions/types";
import { nettoyerChamps } from "@/lib/opinions/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";
import { estUuid } from "@/lib/uuid";

export type Idee = ChampsIdee & { id: string; statut: Statut; created_at: string; updated_at: string };
/** Ancienne version d'une idée ; `created_at` = date à laquelle elle a été remplacée. */
export type VersionIdee = ChampsIdee & { id: string; created_at: string };
export type IdeeAvecVersions = Idee & { versions: VersionIdee[] };

function revalider(id?: string) {
  revalidatePath("/opinions");
  if (id) revalidatePath(`/opinions/${id}`);
}

function versIdee(ligne: Tables<"opinions_idees">): Idee {
  return {
    id: ligne.id,
    statut: estStatut(ligne.statut) ? ligne.statut : "brouillon",
    created_at: ligne.created_at,
    updated_at: ligne.updated_at,
    ...champsDepuisLigne(ligne),
  };
}

// --- Lecture ---

export async function getIdees(): Promise<Idee[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("opinions_idees").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(versIdee);
}

export async function getIdee(id: string): Promise<IdeeAvecVersions | null> {
  if (!estUuid(id)) return null;
  const supabase = createAdminClient();

  const { data: ligne, error } = await supabase.from("opinions_idees").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!ligne) return null;

  const { data: versions, error: erreurVersions } = await supabase
    .from("opinions_versions")
    .select("*")
    .eq("idee_id", id)
    .order("created_at", { ascending: false });
  if (erreurVersions) throw new Error(erreurVersions.message);

  return {
    ...versIdee(ligne),
    versions: (versions ?? []).map((v) => ({ id: v.id, created_at: v.created_at, ...champsDepuisLigne(v) })),
  };
}

// --- Écriture ---

/** Saisie rapide : une phrase, rangée en brouillon ; le reste se complète ensuite. */
export async function creerIdee(position: string): Promise<ActionResult<{ id: string }>> {
  const texte = position.trim();
  if (!texte) return fail("La position est requise.");
  if (texte.length > POSITION_MAX) return fail(`La position dépasse ${POSITION_MAX} caractères.`);

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("opinions_idees").insert({ position: texte }).select("id").single();
  if (error) return fail(error.message);

  revalider();
  return ok({ id: data.id });
}

/**
 * Enregistre les champs de fond. Si quelque chose change réellement, l'ancienne
 * version est archivée avant l'écrasement (historique de l'évolution de l'avis).
 */
export async function modifierIdee(id: string, champs: ChampsIdee): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Idée introuvable.");
  const propres = nettoyerChamps(champs);
  if (typeof propres === "string") return fail(propres);

  const supabase = createAdminClient();
  const { data: ligne, error } = await supabase.from("opinions_idees").select("*").eq("id", id).maybeSingle();
  if (error) return fail(error.message);
  if (!ligne) return fail("Idée introuvable.");

  if (ligne.statut === "validee" && propres.theme === null) return fail("Une idée validée a besoin d'un thème.");

  const avant = champsDepuisLigne(ligne);
  if (champsIdentiques(avant, propres)) return ok();

  const { data: version, error: erreurVersion } = await supabase
    .from("opinions_versions")
    .insert({ idee_id: id, ...colonnesDepuisChamps(avant) })
    .select("id")
    .single();
  if (erreurVersion) return fail(erreurVersion.message);

  const { error: erreurMaj } = await supabase
    .from("opinions_idees")
    .update({ ...colonnesDepuisChamps(propres), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (erreurMaj) {
    // Sans mise à jour, l'instantané ferait doublon avec la version courante.
    await supabase.from("opinions_versions").delete().eq("id", version.id);
    return fail(erreurMaj.message);
  }

  revalider(id);
  return ok();
}

export async function changerStatutIdee(id: string, statut: Statut): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Idée introuvable.");
  if (!estStatut(statut)) return fail("Statut invalide.");

  const supabase = createAdminClient();
  const { data: ligne, error } = await supabase.from("opinions_idees").select("*").eq("id", id).maybeSingle();
  if (error) return fail(error.message);
  if (!ligne) return fail("Idée introuvable.");

  // Une idée validée entre dans le profil et dans la couverture des thèmes.
  if (statut === "validee" && champsDepuisLigne(ligne).theme === null) {
    return fail("Choisis un thème avant de valider cette idée.");
  }

  const { error: erreurMaj } = await supabase
    .from("opinions_idees")
    .update({ statut, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (erreurMaj) return fail(erreurMaj.message);

  revalider(id);
  return ok();
}

export async function supprimerIdee(id: string): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Idée introuvable.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("opinions_idees").delete().eq("id", id);
  if (error) return fail(error.message);

  revalider();
  return ok();
}
