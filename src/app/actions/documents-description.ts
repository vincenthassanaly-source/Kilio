"use server";

import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { decrireDocument } from "@/lib/documents/decrire";
import type { DescriptionDocument } from "@/lib/documents/description";
import { MESSAGE_QUOTA_GEMINI } from "@/lib/gemini/appel";
import { createAdminClient } from "@/lib/supabase/admin";

// Bouton « Description » d'un document : Gemini lit ses fichiers et en donne
// un résumé simple avec les éléments principaux. Enregistrée après le premier
// calcul ; `regenerer` force une nouvelle lecture.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DescriptionAffichee = DescriptionDocument & {
  /** Seuls les premiers fichiers ont été lus. */
  partiel: boolean;
};

export async function obtenirDescriptionDocument(
  id: string,
  regenerer = false
): Promise<ActionResult<DescriptionAffichee>> {
  if (typeof id !== "string" || !UUID.test(id)) return fail("Ce document est introuvable.");

  const resultat = await decrireDocument(createAdminClient(), id, regenerer === true);
  if (resultat.statut === "echec") {
    return fail(resultat.quota ? MESSAGE_QUOTA_GEMINI : `${resultat.detail} Réessaie.`);
  }
  return ok({ ...resultat.description, partiel: resultat.partiel });
}
