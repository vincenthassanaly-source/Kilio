"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { aujourdhuiParis, heureParis } from "@/lib/date/paris";
import { estTypeSeance } from "@/lib/seances/compute";
import { decalerSeance, lireSemaine, marquerFaite, type SemaineSeances } from "@/lib/seances/serveur";
import { estUuid } from "@/lib/uuid";

const HEURE_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_CRENEAUX = 14;

export type CreneauInput = { jourSemaine: number; heure: string; type: string };

function validerCreneau(input: CreneauInput): { erreur: string } | { jour: number; heure: string; type: string } {
  const type = input.type.trim();
  if (!estTypeSeance(type)) return { erreur: "Choisis LEGS, PUSH ou PULL." };
  if (!Number.isInteger(input.jourSemaine) || input.jourSemaine < 0 || input.jourSemaine > 6) {
    return { erreur: "Jour invalide." };
  }
  if (!HEURE_REGEX.test(input.heure)) return { erreur: "Heure invalide (format HH:MM)." };
  return { jour: input.jourSemaine, heure: input.heure, type };
}

function revalider() {
  revalidatePath("/aujourdhui");
}

/**
 * Créneaux et séances de la semaine en cours. Crée les occurrences manquantes
 * et replace les séances manquées (cf. lireSemaine) : appelée à l'ouverture de
 * l'écran Aujourd'hui, sans revalidatePath (elle s'exécute pendant le rendu).
 */
export async function getSemaineSeances(today: string): Promise<SemaineSeances> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error("Date invalide.");
  return lireSemaine(createAdminClient(), today, heureParis());
}

/**
 * Marque une séance faite (ou non). Une séance faite fait aussi de ce jour un
 * jour d'entraînement, donc la cible kcal « entraînement » du Journal ; la
 * défaire le remet en repos (le bouton haltère d'Aujourd'hui reste utilisable
 * pour forcer l'inverse).
 */
export async function marquerSeanceFaite(id: string, faite: boolean): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Séance introuvable.");
  const resultat = await marquerFaite(createAdminClient(), id, faite);
  if (resultat.error) return fail(resultat.error);

  revalider();
  revalidatePath("/nutrition/journal");
  revalidatePath("/nutrition/bilan");
  revalidatePath("/");
  return ok();
}

export async function decalerSeanceAuProchainJourLibre(id: string): Promise<ActionResult<{ date: string }>> {
  if (!estUuid(id)) return fail("Séance introuvable.");
  const resultat = await decalerSeance(createAdminClient(), id);
  if (resultat.error || !resultat.date) return fail(resultat.error ?? "Impossible de décaler la séance.");
  revalider();
  return ok({ date: resultat.date });
}

export async function creerCreneau(input: CreneauInput): Promise<ActionResult> {
  const valide = validerCreneau(input);
  if ("erreur" in valide) return fail(valide.erreur);

  const supabase = createAdminClient();
  const { count, error: erreurCompte } = await supabase
    .from("creneaux_seance")
    .select("id", { count: "exact", head: true });
  if (erreurCompte) return fail("Le créneau n'a pas pu être ajouté. Réessaie.");
  if ((count ?? 0) >= MAX_CRENEAUX) return fail(`Tu ne peux pas planifier plus de ${MAX_CRENEAUX} créneaux.`);

  const { error } = await supabase
    .from("creneaux_seance")
    .insert({ jour_semaine: valide.jour, heure: valide.heure, type: valide.type });
  if (error) return fail("Le créneau n'a pas pu être ajouté. Réessaie.");

  revalider();
  return ok();
}

/** Séances à venir (non faites) d'un créneau : régénérées depuis le créneau modifié ou supprimé. */
async function retirerSeancesAVenir(creneauId: string): Promise<string | null> {
  const { error } = await createAdminClient()
    .from("seances")
    .delete()
    .eq("creneau_id", creneauId)
    .eq("statut", "prevue")
    .gte("date", aujourdhuiParis());
  return error ? error.message : null;
}

export async function modifierCreneau(id: string, input: CreneauInput): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Créneau introuvable.");
  const valide = validerCreneau(input);
  if ("erreur" in valide) return fail(valide.erreur);

  const { error } = await createAdminClient()
    .from("creneaux_seance")
    .update({ jour_semaine: valide.jour, heure: valide.heure, type: valide.type })
    .eq("id", id);
  if (error) return fail("Le créneau n'a pas pu être modifié. Réessaie.");
  if (await retirerSeancesAVenir(id)) return fail("Le créneau est modifié, mais les séances à venir n'ont pas pu être mises à jour.");

  revalider();
  return ok();
}

export async function supprimerCreneau(id: string): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Créneau introuvable.");
  if (await retirerSeancesAVenir(id)) return fail("Le créneau n'a pas pu être supprimé. Réessaie.");

  const { error } = await createAdminClient().from("creneaux_seance").delete().eq("id", id);
  if (error) return fail("Le créneau n'a pas pu être supprimé. Réessaie.");

  revalider();
  return ok();
}
