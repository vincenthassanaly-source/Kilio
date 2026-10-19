"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { estJourValide, estMoisValide, premierEtDernierJour } from "@/lib/vidage/jours";
import { HAUTEUR_MIN, validerFeuille, type Trait } from "@/lib/vidage/traits";

// « Vider ma tête » : une feuille manuscrite par jour (table feuilles_vidage,
// scripts/migration-vider-tete-2026-10-19.sql). Une feuille vide n'existe pas :
// effacer tout le contenu supprime la ligne et l'aperçu, donc le calendrier
// ne marque que les jours réellement écrits.
//
// L'aperçu PNG vit dans un bucket PRIVÉ (journal intime) : jamais d'URL
// publique, uniquement des URL signées de courte durée générées à la lecture.
const BUCKET = "vider-tete";
const REGLAGES_ID = 1;
const HEURE_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const APERCU_MAX_OCTETS = 1_500_000;
const APERCU_URL_SECONDES = 60 * 60;

export type FeuilleVidage = {
  jour: string;
  traits: Trait[];
  hauteur: number;
  apercuUrl: string | null;
  updatedAt: string | null;
};

const cheminApercu = (jour: string) => `${jour}.png`;

export async function getFeuille(jour: string): Promise<ActionResult<FeuilleVidage>> {
  if (!estJourValide(jour)) return fail("Jour invalide.");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("feuilles_vidage")
    .select("jour, traits, hauteur, apercu_path, updated_at")
    .eq("jour", jour)
    .maybeSingle();
  if (error) return fail("La feuille n'a pas pu être chargée. Réessaie.");
  if (!data) return ok({ jour, traits: [], hauteur: HAUTEUR_MIN, apercuUrl: null, updatedAt: null });

  const valide = validerFeuille({ traits: data.traits, hauteur: data.hauteur });
  if (!valide.ok) return fail("La feuille est illisible.");

  let apercuUrl: string | null = null;
  if (data.apercu_path) {
    const signee = await supabase.storage.from(BUCKET).createSignedUrl(data.apercu_path, APERCU_URL_SECONDES);
    apercuUrl = signee.data?.signedUrl ?? null;
  }
  return ok({ jour, traits: valide.traits, hauteur: valide.hauteur, apercuUrl, updatedAt: data.updated_at });
}

/** Remplace toute la feuille du jour (dernier écrit gagne : app mono-utilisateur). */
export async function enregistrerFeuille(
  jour: string,
  traits: Trait[],
  hauteur: number
): Promise<ActionResult<{ updatedAt: string }>> {
  if (!estJourValide(jour)) return fail("Jour invalide.");
  const valide = validerFeuille({ traits, hauteur });
  if (!valide.ok) return fail(valide.error);

  const supabase = createAdminClient();
  const updatedAt = new Date().toISOString();

  if (valide.traits.length === 0) {
    const { error } = await supabase.from("feuilles_vidage").delete().eq("jour", jour);
    if (error) return fail("La feuille n'a pas pu être enregistrée. Réessaie.");
    // Meilleur effort : un aperçu orphelin est inoffensif (bucket privé).
    await supabase.storage.from(BUCKET).remove([cheminApercu(jour)]);
    return ok({ updatedAt });
  }

  const { error } = await supabase
    .from("feuilles_vidage")
    .upsert({ jour, traits: valide.traits, hauteur: valide.hauteur, updated_at: updatedAt });
  if (error) return fail("La feuille n'a pas pu être enregistrée. Réessaie.");
  return ok({ updatedAt });
}

/** Aperçu image (PNG) de la feuille, envoyé par le client après la sauvegarde des traits. */
export async function enregistrerApercu(jour: string, formData: FormData): Promise<ActionResult> {
  if (!estJourValide(jour)) return fail("Jour invalide.");
  const fichier = formData.get("apercu");
  if (!(fichier instanceof File) || fichier.type !== "image/png") return fail("Aperçu invalide.");
  if (fichier.size === 0 || fichier.size > APERCU_MAX_OCTETS) return fail("Aperçu trop volumineux.");

  const supabase = createAdminClient();
  const chemin = cheminApercu(jour);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(chemin, fichier, { contentType: "image/png", upsert: true });
  if (uploadError) return fail("L'aperçu n'a pas pu être enregistré.");

  const { error } = await supabase.from("feuilles_vidage").update({ apercu_path: chemin }).eq("jour", jour);
  if (error) return fail("L'aperçu n'a pas pu être enregistré.");
  return ok();
}

/** Jours écrits d'un mois (AAAA-MM), pour le calendrier de relecture. */
export async function listerJoursEcrits(mois: string): Promise<ActionResult<string[]>> {
  if (!estMoisValide(mois)) return fail("Mois invalide.");
  const [premier, dernier] = premierEtDernierJour(mois);
  const { data, error } = await createAdminClient()
    .from("feuilles_vidage")
    .select("jour")
    .gte("jour", premier)
    .lte("jour", dernier)
    .order("jour", { ascending: true });
  if (error) return fail("Le calendrier n'a pas pu être chargé. Réessaie.");
  return ok((data ?? []).map((ligne) => ligne.jour));
}

export async function updateReglagesVidage(actif: boolean, heure: string): Promise<ActionResult> {
  if (!HEURE_REGEX.test(heure)) return fail("Heure invalide (format HH:MM).");

  // Réactiver ou changer l'heure ne rejoue pas le rappel du jour s'il est déjà
  // parti : `vidage_dernier_envoi` reste tel quel.
  const { error } = await createAdminClient()
    .from("reglages_briefing")
    .update({ vidage_actif: actif, vidage_heure: heure })
    .eq("id", REGLAGES_ID);
  if (error) return fail("Le réglage n'a pas pu être enregistré. Réessaie.");

  revalidatePath("/reglages");
  return ok();
}
