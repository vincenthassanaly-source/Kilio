"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { couleurOuDefaut, couleurSuivante, estCouleur, termesDepuisJson } from "@/lib/opinions/couleurs";
import {
  colonnesDepuisScores,
  estNiveau,
  explicationDepuisColonnes,
  nettoyerParti,
  nettoyerProgramme,
  nettoyerProposition,
  scoresDepuisColonnes,
  type ChampsProposition,
  type Niveau,
  type PartiComplet,
  type Priorites,
  type PropositionParti,
} from "@/lib/opinions/partis";
import { estTheme, type Theme } from "@/lib/opinions/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { estUuid } from "@/lib/uuid";

function revalider() {
  revalidatePath("/opinions");
}

const CODE_DOUBLON = "23505";

// --- Lecture ---

export async function getPartis(): Promise<PartiComplet[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("opinions_partis")
    .select(
      "id, nom, sigle, couleur, opinions_programmes(id, echeance, date_programme, created_at, opinions_propositions(id, position, theme, termes, explication_concret, explication_pour, explication_contre, score_economique, score_societal, score_autorite, score_ecologie, score_identite))"
    )
    .order("nom");
  if (error) throw new Error(error.message);

  return (data ?? []).map((parti) => ({
    id: parti.id,
    nom: parti.nom,
    sigle: parti.sigle,
    couleur: couleurOuDefaut(parti.couleur),
    programmes: parti.opinions_programmes.map((programme) => ({
      id: programme.id,
      echeance: programme.echeance,
      date_programme: programme.date_programme,
      created_at: programme.created_at,
      propositions: programme.opinions_propositions.flatMap((ligne): PropositionParti[] =>
        // Un thème hors liste n'a pas de place dans les comparaisons : ligne ignorée.
        estTheme(ligne.theme)
          ? [
              {
                id: ligne.id,
                position: ligne.position,
                theme: ligne.theme,
                scores: scoresDepuisColonnes(ligne),
                termes: termesDepuisJson(ligne.termes),
                explication: explicationDepuisColonnes(ligne),
              },
            ]
          : []
      ),
    })),
  }));
}

export async function getPriorites(): Promise<Priorites> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("opinions_priorites").select("theme, niveau");
  if (error) throw new Error(error.message);

  const priorites: Priorites = {};
  for (const ligne of data ?? []) {
    if (estTheme(ligne.theme) && estNiveau(ligne.niveau)) priorites[ligne.theme] = ligne.niveau;
  }
  return priorites;
}

// --- Partis ---

/** `couleur` absente : la première teinte de la palette pas encore prise. */
export async function creerParti(nom: string, sigle: string, couleur?: string | null): Promise<ActionResult> {
  const propres = nettoyerParti(nom, sigle);
  if (typeof propres === "string") return fail(propres);
  if (couleur != null && !estCouleur(couleur)) return fail("Couleur invalide.");

  const supabase = createAdminClient();
  let teinte = couleur;
  if (teinte == null) {
    const { data, error: erreurCouleurs } = await supabase.from("opinions_partis").select("couleur");
    if (erreurCouleurs) return fail(erreurCouleurs.message);
    teinte = couleurSuivante((data ?? []).map((ligne) => ligne.couleur));
  }
  const { error } = await supabase.from("opinions_partis").insert({ ...propres, couleur: teinte });
  if (error) return fail(error.code === CODE_DOUBLON ? "Ce parti existe déjà." : error.message);

  revalider();
  return ok();
}

export async function modifierParti(id: string, nom: string, sigle: string, couleur?: string): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Parti introuvable.");
  const propres = nettoyerParti(nom, sigle);
  if (typeof propres === "string") return fail(propres);
  if (couleur !== undefined && !estCouleur(couleur)) return fail("Couleur invalide.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("opinions_partis")
    .update(couleur === undefined ? propres : { ...propres, couleur })
    .eq("id", id);
  if (error) return fail(error.code === CODE_DOUBLON ? "Ce parti existe déjà." : error.message);

  revalider();
  return ok();
}

/** Supprime le parti, ses programmes et leurs propositions (cascade). */
export async function supprimerParti(id: string): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Parti introuvable.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("opinions_partis").delete().eq("id", id);
  if (error) return fail(error.message);

  revalider();
  return ok();
}

// --- Programmes ---

export async function creerProgramme(partiId: string, echeance: string, date: string | null): Promise<ActionResult> {
  if (!estUuid(partiId)) return fail("Parti introuvable.");
  const propres = nettoyerProgramme(echeance, date);
  if (typeof propres === "string") return fail(propres);

  const supabase = createAdminClient();
  const { error } = await supabase.from("opinions_programmes").insert({ parti_id: partiId, ...propres });
  if (error) return fail(error.message);

  revalider();
  return ok();
}

export async function modifierProgramme(id: string, echeance: string, date: string | null): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Programme introuvable.");
  const propres = nettoyerProgramme(echeance, date);
  if (typeof propres === "string") return fail(propres);

  const supabase = createAdminClient();
  const { error } = await supabase.from("opinions_programmes").update(propres).eq("id", id);
  if (error) return fail(error.message);

  revalider();
  return ok();
}

/** Supprime le programme et ses propositions (cascade). */
export async function supprimerProgramme(id: string): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Programme introuvable.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("opinions_programmes").delete().eq("id", id);
  if (error) return fail(error.message);

  revalider();
  return ok();
}

// --- Propositions ---

export async function creerProposition(programmeId: string, champs: ChampsProposition): Promise<ActionResult> {
  if (!estUuid(programmeId)) return fail("Programme introuvable.");
  const propres = nettoyerProposition(champs);
  if (typeof propres === "string") return fail(propres);

  const supabase = createAdminClient();
  const { error } = await supabase.from("opinions_propositions").insert({
    programme_id: programmeId,
    position: propres.position,
    theme: propres.theme,
    termes: propres.termes,
    ...colonnesDepuisScores(propres.scores),
  });
  if (error) return fail(error.message);

  revalider();
  return ok();
}

export async function modifierProposition(id: string, champs: ChampsProposition): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Proposition introuvable.");
  const propres = nettoyerProposition(champs);
  if (typeof propres === "string") return fail(propres);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("opinions_propositions")
    .update({
      position: propres.position,
      theme: propres.theme,
      termes: propres.termes,
      ...colonnesDepuisScores(propres.scores),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return fail(error.message);

  revalider();
  return ok();
}

export async function supprimerProposition(id: string): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Proposition introuvable.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("opinions_propositions").delete().eq("id", id);
  if (error) return fail(error.message);

  revalider();
  return ok();
}

/**
 * Crée une de mes idées en brouillon à partir d'une proposition de parti
 * (position, thème et scores recopiés), avec une référence vers la proposition
 * d'origine. Une même proposition n'est reprise qu'une fois.
 */
export async function reprendreProposition(propositionId: string): Promise<ActionResult<{ id: string }>> {
  if (!estUuid(propositionId)) return fail("Proposition introuvable.");
  const supabase = createAdminClient();

  const { data: proposition, error } = await supabase
    .from("opinions_propositions")
    .select("position, theme, score_economique, score_societal, score_autorite, score_ecologie, score_identite")
    .eq("id", propositionId)
    .maybeSingle();
  if (error) return fail(error.message);
  if (!proposition) return fail("Proposition introuvable.");

  const { data: existantes, error: erreurExistantes } = await supabase
    .from("opinions_idees")
    .select("id")
    .eq("proposition_id", propositionId)
    .limit(1);
  if (erreurExistantes) return fail(erreurExistantes.message);
  if ((existantes ?? []).length > 0) return fail("Cette proposition a déjà été reprise : cherche-la dans tes idées.");

  const { data, error: erreurCreation } = await supabase
    .from("opinions_idees")
    .insert({
      position: proposition.position,
      theme: estTheme(proposition.theme) ? proposition.theme : null,
      ...colonnesDepuisScores(scoresDepuisColonnes(proposition)),
      proposition_id: propositionId,
    })
    .select("id")
    .single();
  if (erreurCreation) return fail(erreurCreation.message);

  revalider();
  return ok({ id: data.id });
}

// --- Priorités par thème ---

export async function definirPriorite(theme: Theme, niveau: Niveau): Promise<ActionResult> {
  if (!estTheme(theme)) return fail("Thème invalide.");
  if (!estNiveau(niveau)) return fail("Niveau invalide.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("opinions_priorites")
    .upsert({ theme, niveau, updated_at: new Date().toISOString() }, { onConflict: "theme" });
  if (error) return fail(error.message);

  revalider();
  return ok();
}
