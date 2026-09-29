"use server";

import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { createAdminClient } from "@/lib/supabase/admin";
import { assurerListe } from "@/lib/taches/saisie-creation";

// Crée (ou retrouve) une liste avant d'ouvrir le formulaire pré-rempli d'une
// tâche proposée par « Ajouter avec l'IA » : le formulaire ne sait choisir
// qu'une liste existante.
export async function preparerListe(nom: string): Promise<ActionResult<{ id: string }>> {
  const propre = typeof nom === "string" ? nom.trim() : "";
  if (!propre) return fail("Nom de liste manquant.");
  try {
    const id = await assurerListe(createAdminClient(), propre, new Map());
    return ok({ id });
  } catch (err) {
    console.error("[saisie-taches] Création de liste impossible.", err);
    return fail("La liste n'a pas pu être créée. Réessaie.");
  }
}
