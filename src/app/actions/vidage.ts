"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { heureParis } from "@/lib/date/paris";
import { appelerGemini, MESSAGE_QUOTA_GEMINI } from "@/lib/gemini/appel";
import { estJourValide, estMoisValide, premierEtDernierJour } from "@/lib/vidage/jours";
import { ajouterBloc, depasseLimite } from "@/lib/vidage/texte";
import { exigerSession } from "@/lib/vidage/verrou";
import {
  LONGUEUR_MAX_TEXTE,
  MAX_TRANCHES,
  PROMPT_TRANSCRIPTION,
  SCHEMA_TRANSCRIPTION,
  lireTranscription,
} from "@/lib/vidage/transcription";
import { HAUTEUR_MIN, validerFeuille, type Trait } from "@/lib/vidage/traits";

// « Vider ma tête » : une feuille manuscrite par jour (table feuilles_vidage,
// scripts/migration-vider-tete-2026-10-19.sql) et le texte du jour (colonne
// `transcription`) : transcriptions validées et notes tapées, ajoutées à la suite.
// Un jour sans écriture ni texte n'existe pas : vider les deux supprime la ligne et
// l'aperçu, donc le calendrier ne marque que les jours réellement écrits. Valider une
// transcription vide la feuille mais garde le texte (la ligne reste, sans traits).
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
  /** Texte du jour (transcriptions validées et notes tapées, avec leur heure) ; null s'il n'y en a pas. */
  transcription: string | null;
};

const cheminApercu = (jour: string) => `${jour}.png`;

export async function getFeuille(jour: string): Promise<ActionResult<FeuilleVidage>> {
  const session = await exigerSession();
  if (!session.ok) return session;
  if (!estJourValide(jour)) return fail("Jour invalide.");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("feuilles_vidage")
    .select("jour, traits, hauteur, apercu_path, updated_at, transcription")
    .eq("jour", jour)
    .maybeSingle();
  if (error) return fail("La feuille n'a pas pu être chargée. Réessaie.");
  if (!data) {
    return ok({ jour, traits: [], hauteur: HAUTEUR_MIN, apercuUrl: null, updatedAt: null, transcription: null });
  }

  const valide = validerFeuille({ traits: data.traits, hauteur: data.hauteur });
  if (!valide.ok) return fail("La feuille est illisible.");

  let apercuUrl: string | null = null;
  if (data.apercu_path) {
    const signee = await supabase.storage.from(BUCKET).createSignedUrl(data.apercu_path, APERCU_URL_SECONDES);
    apercuUrl = signee.data?.signedUrl ?? null;
  }
  return ok({
    jour,
    traits: valide.traits,
    hauteur: valide.hauteur,
    apercuUrl,
    updatedAt: data.updated_at,
    transcription: data.transcription ?? null,
  });
}

/** Remplace toute la feuille du jour (dernier écrit gagne : app mono-utilisateur). */
export async function enregistrerFeuille(
  jour: string,
  traits: Trait[],
  hauteur: number
): Promise<ActionResult<{ updatedAt: string }>> {
  const session = await exigerSession();
  if (!session.ok) return session;
  if (!estJourValide(jour)) return fail("Jour invalide.");
  const valide = validerFeuille({ traits, hauteur });
  if (!valide.ok) return fail(valide.error);

  const supabase = createAdminClient();
  const updatedAt = new Date().toISOString();

  if (valide.traits.length === 0) {
    // Le texte du jour survit à la feuille : sans lui la ligne disparaît, avec lui elle reste vide.
    const { data: existante, error: lectureError } = await supabase
      .from("feuilles_vidage")
      .select("transcription")
      .eq("jour", jour)
      .maybeSingle();
    if (lectureError) return fail("La feuille n'a pas pu être enregistrée. Réessaie.");
    const { error } = existante?.transcription
      ? await supabase
          .from("feuilles_vidage")
          .update({ traits: [], hauteur: HAUTEUR_MIN, apercu_path: null, updated_at: updatedAt })
          .eq("jour", jour)
      : await supabase.from("feuilles_vidage").delete().eq("jour", jour);
    if (error) return fail("La feuille n'a pas pu être enregistrée. Réessaie.");
    // Meilleur effort : un aperçu orphelin est inoffensif (bucket privé).
    await supabase.storage.from(BUCKET).remove([cheminApercu(jour)]);
    return ok({ updatedAt });
  }

  // L'upsert ne touche que ces colonnes : le texte du jour reste en place.
  const { error } = await supabase.from("feuilles_vidage").upsert({
    jour,
    traits: valide.traits,
    hauteur: valide.hauteur,
    updated_at: updatedAt,
  });
  if (error) return fail("La feuille n'a pas pu être enregistrée. Réessaie.");
  return ok({ updatedAt });
}

/** Aperçu image (PNG) de la feuille, envoyé par le client après la sauvegarde des traits. */
export async function enregistrerApercu(jour: string, formData: FormData): Promise<ActionResult> {
  const session = await exigerSession();
  if (!session.ok) return session;
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

// Transcription par Gemini : le client rend la feuille en tranches PNG (voir apercu.ts) et les
// envoie ici ; le texte lu est enregistré avec la feuille. La limite de requête des Server
// Actions est de 4 Mo (next.config.ts) : on garde de la marge pour l'enveloppe multipart.
const TRANCHE_MAX_OCTETS = 1_500_000;
const TRANCHES_TOTAL_MAX_OCTETS = 3_500_000;
const TRANSCRIPTION_DELAI_MS = 50_000;

export async function transcrireFeuille(jour: string, formData: FormData): Promise<ActionResult<{ texte: string }>> {
  const session = await exigerSession();
  if (!session.ok) return session;
  if (!estJourValide(jour)) return fail("Jour invalide.");
  const tranches = formData.getAll("tranche");
  if (tranches.length === 0 || tranches.length > MAX_TRANCHES) return fail("Images de la feuille invalides.");
  let total = 0;
  const fichiers: File[] = [];
  for (const tranche of tranches) {
    if (!(tranche instanceof File) || tranche.type !== "image/png" || tranche.size === 0 || tranche.size > TRANCHE_MAX_OCTETS) {
      return fail("Images de la feuille invalides.");
    }
    total += tranche.size;
    fichiers.push(tranche);
  }
  if (total > TRANCHES_TOTAL_MAX_OCTETS) return fail("La feuille est trop dense pour être envoyée en une fois.");

  const supabase = createAdminClient();
  const { data: ligne, error } = await supabase.from("feuilles_vidage").select("jour").eq("jour", jour).maybeSingle();
  if (error) return fail("La feuille n'a pas pu être lue. Réessaie.");
  if (!ligne) return fail("La feuille n'est pas encore enregistrée. Réessaie dans un instant.");

  const images = await Promise.all(
    fichiers.map(async (f) => ({ mimeType: "image/png", data: Buffer.from(await f.arrayBuffer()).toString("base64") }))
  );
  const resultat = await appelerGemini({
    prompt: PROMPT_TRANSCRIPTION,
    images,
    schema: SCHEMA_TRANSCRIPTION,
    timeoutMs: TRANSCRIPTION_DELAI_MS,
    // Recopie, pas création : aucune fantaisie.
    temperature: 0,
    etiquette: "transcription-feuille",
  });
  if (!resultat.ok) return fail(resultat.code === "quota" ? MESSAGE_QUOTA_GEMINI : `La transcription a échoué : ${resultat.detail}`);

  const texte = lireTranscription(resultat.brut);
  if (texte === null) return fail("La réponse de Gemini est illisible. Réessaie.");
  if (texte === "") return fail("Aucune écriture lisible sur la feuille.");

  // Le texte n'est qu'une proposition : rien n'est enregistré avant validerTranscription.
  return ok({ texte });
}

type Client = ReturnType<typeof createAdminClient>;

/**
 * Ajoute un bloc daté au texte du jour. `viderFeuille` (validation d'une transcription) vide
 * en plus la feuille et son aperçu : le manuscrit n'est pas gardé, seul le texte l'est.
 */
async function ajouterAuTexteDuJour(jour: string, texte: string, viderFeuille: boolean): Promise<ActionResult<{ texte: string }>> {
  const session = await exigerSession();
  if (!session.ok) return session;
  if (!estJourValide(jour)) return fail("Jour invalide.");
  if (typeof texte !== "string" || texte.trim() === "") return fail("Il n'y a rien à ajouter.");

  const supabase = createAdminClient();
  const { data: existante, error: lectureError } = await supabase
    .from("feuilles_vidage")
    .select("transcription")
    .eq("jour", jour)
    .maybeSingle();
  if (lectureError) return fail("Le texte n'a pas pu être enregistré. Réessaie.");

  const heure = heureParis();
  const precedent = existante?.transcription ?? null;
  if (depasseLimite(precedent, texte, heure)) return fail("Le texte du jour est trop long pour y ajouter ceci.");
  const transcription = ajouterBloc(precedent, texte, heure);

  const vide = { traits: [], hauteur: HAUTEUR_MIN, apercu_path: null, updated_at: new Date().toISOString() };
  const { error } = existante
    ? await supabase
        .from("feuilles_vidage")
        .update(viderFeuille ? { transcription, ...vide } : { transcription })
        .eq("jour", jour)
    : await supabase.from("feuilles_vidage").insert({ jour, transcription, ...vide });
  if (error) return fail("Le texte n'a pas pu être enregistré. Réessaie.");

  // Meilleur effort : un aperçu orphelin est inoffensif (bucket privé).
  if (viderFeuille) await supabase.storage.from(BUCKET).remove([cheminApercu(jour)]);
  return ok({ texte: transcription });
}

/** Valide le texte transcrit : il rejoint le texte du jour et la feuille est vidée, sans retour possible. */
export async function validerTranscription(jour: string, texte: string): Promise<ActionResult<{ texte: string }>> {
  return ajouterAuTexteDuJour(jour, texte, true);
}

/** Note tapée au clavier : elle rejoint le texte du jour, la feuille n'est pas touchée. */
export async function ajouterTexte(jour: string, texte: string): Promise<ActionResult<{ texte: string }>> {
  return ajouterAuTexteDuJour(jour, texte, false);
}

/** Retire la ligne du jour (et l'aperçu) quand elle ne porte plus ni écriture ni texte. */
async function supprimerLigneVide(supabase: Client, jour: string): Promise<boolean> {
  const { data, error } = await supabase.from("feuilles_vidage").select("traits").eq("jour", jour).maybeSingle();
  if (error) return false;
  if (data && Array.isArray(data.traits) && data.traits.length > 0) return true;
  const { error: suppressionError } = await supabase.from("feuilles_vidage").delete().eq("jour", jour);
  if (suppressionError) return false;
  await supabase.storage.from(BUCKET).remove([cheminApercu(jour)]);
  return true;
}

/** Texte du jour corrigé à la main. Vide = suppression. */
export async function enregistrerTranscription(jour: string, texte: string): Promise<ActionResult> {
  const session = await exigerSession();
  if (!session.ok) return session;
  if (!estJourValide(jour)) return fail("Jour invalide.");
  if (typeof texte !== "string" || texte.length > LONGUEUR_MAX_TEXTE) return fail("Le texte est trop long.");
  const propre = texte.trim();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("feuilles_vidage")
    .update({ transcription: propre || null })
    .eq("jour", jour);
  if (error) return fail("Le texte n'a pas pu être enregistré. Réessaie.");
  if (!propre && !(await supprimerLigneVide(supabase, jour))) return fail("Le texte n'a pas pu être enregistré. Réessaie.");
  return ok();
}

/** Retire le texte du jour sans toucher à l'écriture. */
export async function supprimerTranscription(jour: string): Promise<ActionResult> {
  const session = await exigerSession();
  if (!session.ok) return session;
  if (!estJourValide(jour)) return fail("Jour invalide.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("feuilles_vidage").update({ transcription: null }).eq("jour", jour);
  if (error || !(await supprimerLigneVide(supabase, jour))) return fail("Le texte n'a pas pu être supprimé. Réessaie.");
  return ok();
}

export type JourEcrit = { jour: string; apercuUrl: string | null };

/** Jours écrits d'un mois (AAAA-MM) avec leur vignette signée, pour le calendrier de relecture. */
export async function listerJoursEcrits(mois: string): Promise<ActionResult<JourEcrit[]>> {
  const session = await exigerSession();
  if (!session.ok) return session;
  if (!estMoisValide(mois)) return fail("Mois invalide.");
  const [premier, dernier] = premierEtDernierJour(mois);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("feuilles_vidage")
    .select("jour, apercu_path")
    .gte("jour", premier)
    .lte("jour", dernier)
    .order("jour", { ascending: true });
  if (error) return fail("Le calendrier n'a pas pu être chargé. Réessaie.");

  const lignes = data ?? [];
  const chemins = lignes.flatMap((ligne) => (ligne.apercu_path ? [ligne.apercu_path] : []));
  const urls = new Map<string, string>();
  if (chemins.length > 0) {
    const signees = await supabase.storage.from(BUCKET).createSignedUrls(chemins, APERCU_URL_SECONDES);
    for (const s of signees.data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return ok(lignes.map((ligne) => ({ jour: ligne.jour, apercuUrl: (ligne.apercu_path && urls.get(ligne.apercu_path)) || null })));
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
