"use server";

import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { decrireDocument } from "@/lib/documents/decrire";
import type { DescriptionDocument } from "@/lib/documents/description";
import { messageEchec } from "@/lib/gemini/analyse";
import { createAdminClient } from "@/lib/supabase/admin";
import { estUuid } from "@/lib/uuid";

// Bouton « Description » d'un document : Gemini lit ses fichiers et en donne
// un résumé simple avec les éléments principaux. Enregistrée après le premier
// calcul ; `regenerer` force une nouvelle lecture.


export type DescriptionAffichee = DescriptionDocument & {
  /** Seuls les premiers fichiers ont été lus. */
  partiel: boolean;
};

export async function obtenirDescriptionDocument(
  id: string,
  regenerer = false
): Promise<ActionResult<DescriptionAffichee>> {
  if (typeof id !== "string" || !estUuid(id)) return fail("Ce document est introuvable.");

  const resultat = await decrireDocument(createAdminClient(), id, regenerer === true);
  if (resultat.statut === "echec") return fail(messageEchec(resultat));
  return ok({ ...resultat.description, partiel: resultat.partiel });
}
