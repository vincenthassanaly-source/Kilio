"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { appelerGemini, MESSAGE_QUOTA_GEMINI } from "@/lib/gemini/appel";
import { estJourValide, estMoisValide, premierEtDernierJour } from "@/lib/vidage/jours";
import {
  LONGUEUR_MAX_TEXTE,
  MAX_TRANCHES,
  PROMPT_TRANSCRIPTION,
  SCHEMA_TRANSCRIPTION,
  lireTranscription,
} from "@/lib/vidage/transcription";
import { HAUTEUR_MIN, traitsIdentiques, validerFeuille, type Trait } from "@/lib/vidage/traits";

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
  /** Texte lu par Gemini (éventuellement corrigé) ; null tant que la feuille n'est pas transcrite. */
  transcription: string | null;
  /** Vrai quand le texte a été corrigé à la main : confirmer avant de le remplacer. */
  transcriptionModifiee: boolean;
};

const cheminApercu = (jour: string) => `${jour}.png`;

export async function getFeuille(jour: string): Promise<ActionResult<FeuilleVidage>> {
  if (!estJourValide(jour)) return fail("Jour invalide.");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("feuilles_vidage")
    .select("jour, traits, hauteur, apercu_path, updated_at, transcription, transcription_modifiee")
    .eq("jour", jour)
    .maybeSingle();
  if (error) return fail("La feuille n'a pas pu être chargée. Réessaie.");
  if (!data) {
    return ok({ jour, traits: [], hauteur: HAUTEUR_MIN, apercuUrl: null, updatedAt: null, transcription: null, transcriptionModifiee: false });
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
    transcriptionModifiee: data.transcription_modifiee ?? false,
  });
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

  // Le texte transcrit décrit la feuille telle qu'elle était : dès que les traits changent, il
  // est effacé. Renvoyer la même feuille (reprise après coupure) le laisse en place. En cas
  // de doute (lecture de l'existant impossible), on l'efface plutôt que de le garder faux.
  const { data: existante, error: lectureError } = await supabase
    .from("feuilles_vidage")
    .select("traits")
    .eq("jour", jour)
    .maybeSingle();
  const effacerTexte = Boolean(lectureError) || (existante != null && !traitsIdentiques(existante.traits, valide.traits));

  const { error } = await supabase.from("feuilles_vidage").upsert({
    jour,
    traits: valide.traits,
    hauteur: valide.hauteur,
    updated_at: updatedAt,
    ...(effacerTexte ? { transcription: null, transcription_modifiee: false } : {}),
  });
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

// Transcription par Gemini : le client rend la feuille en tranches PNG (voir apercu.ts) et les
// envoie ici ; le texte lu est enregistré avec la feuille. La limite de requête des Server
// Actions est de 4 Mo (next.config.ts) : on garde de la marge pour l'enveloppe multipart.
const TRANCHE_MAX_OCTETS = 1_500_000;
const TRANCHES_TOTAL_MAX_OCTETS = 3_500_000;
const TRANSCRIPTION_DELAI_MS = 50_000;

export async function transcrireFeuille(jour: string, formData: FormData): Promise<ActionResult<{ texte: string }>> {
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
  const { data: ligne, error } = await supabase.from("feuilles_vidage").select("updated_at").eq("jour", jour).maybeSingle();
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

  // N'écrit que si la feuille n'a pas bougé pendant l'appel : sinon le texte décrirait
  // une feuille qui n'existe plus.
  const { data: maj, error: majError } = await supabase
    .from("feuilles_vidage")
    .update({ transcription: texte, transcription_modifiee: false })
    .eq("jour", jour)
    .eq("updated_at", ligne.updated_at)
    .select("jour");
  if (majError) return fail("Le texte n'a pas pu être enregistré. Réessaie.");
  if (!maj || maj.length === 0) return fail("La feuille a changé pendant la transcription. Relance-la.");
  return ok({ texte });
}

/** Texte corrigé à la main. Vide = suppression. */
export async function enregistrerTranscription(jour: string, texte: string): Promise<ActionResult> {
  if (!estJourValide(jour)) return fail("Jour invalide.");
  if (typeof texte !== "string" || texte.length > LONGUEUR_MAX_TEXTE) return fail("Le texte est trop long.");
  const propre = texte.trim();
  const { error } = await createAdminClient()
    .from("feuilles_vidage")
    .update(propre ? { transcription: propre, transcription_modifiee: true } : { transcription: null, transcription_modifiee: false })
    .eq("jour", jour);
  if (error) return fail("Le texte n'a pas pu être enregistré. Réessaie.");
  return ok();
}

/** Retire le texte transcrit sans toucher à l'écriture. */
export async function supprimerTranscription(jour: string): Promise<ActionResult> {
  if (!estJourValide(jour)) return fail("Jour invalide.");
  const { error } = await createAdminClient()
    .from("feuilles_vidage")
    .update({ transcription: null, transcription_modifiee: false })
    .eq("jour", jour);
  if (error) return fail("Le texte n'a pas pu être supprimé. Réessaie.");
  return ok();
}

export type JourEcrit = { jour: string; apercuUrl: string | null };

/** Jours écrits d'un mois (AAAA-MM) avec leur vignette signée, pour le calendrier de relecture. */
export async function listerJoursEcrits(mois: string): Promise<ActionResult<JourEcrit[]>> {
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
