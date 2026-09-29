"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { aujourdhuiISO } from "@/lib/budget/compute";
import { createAdminClient } from "@/lib/supabase/admin";
import { appelerGeminiSaisie } from "@/lib/taches/saisie-gemini";
import {
  MAX_QUESTIONS,
  MAX_TACHES,
  MAX_TEXTE,
  construirePrompt,
  interpreterReponse,
  normaliserTexte,
  type PrecisionDonnee,
  type TachePropose,
} from "@/lib/taches/saisie-naturelle";
import { createTache, getListes, getTags } from "./taches";

export type AnalyseSaisie =
  | { statut: "taches"; taches: TachePropose[] }
  | { statut: "question"; question: string; choix: string[] }
  // `detail` : cause technique courte (statut HTTP, délai dépassé…), affichée
  // sous le message pour qu'un échec ne reste pas un mystère.
  | { statut: "erreur"; code: "quota" | "echec" | "incomprehensible"; message: string; detail?: string };

const MESSAGE_QUOTA = "Le quota gratuit de Gemini est atteint pour le moment. Réessaie plus tard.";
const MESSAGE_ECHEC = "L'analyse a échoué. Réessaie.";
const MESSAGE_INCOMPRIS = "Je n'ai pas trouvé de tâche dans ce texte. Reformule ou crée-la à la main.";

function precisionsValides(valeur: unknown): PrecisionDonnee[] | null {
  if (!Array.isArray(valeur) || valeur.length > MAX_QUESTIONS) return null;
  const precisions: PrecisionDonnee[] = [];
  for (const p of valeur) {
    if (typeof p !== "object" || p === null) return null;
    const { question, reponse } = p as { question?: unknown; reponse?: unknown };
    if (typeof question !== "string" || typeof reponse !== "string") return null;
    if (question.length > 300 || reponse.length > 300) return null;
    precisions.push({ question, reponse });
  }
  return precisions;
}

// Analyse un texte libre (et les précisions déjà données) : renvoie des
// tâches à valider, ou une question de précision, ou une erreur typée. Rien
// n'est écrit en base ici : la création n'a lieu qu'au tap de validation.
export async function analyserSaisieTaches(
  texte: string,
  precisions: PrecisionDonnee[]
): Promise<ActionResult<AnalyseSaisie>> {
  const propre = typeof texte === "string" ? texte.trim() : "";
  if (!propre) return fail("Écris d'abord ce que tu veux ajouter.");
  if (propre.length > MAX_TEXTE) return fail(`Le texte est trop long (${MAX_TEXTE} caractères maximum).`);
  const precisionsOk = precisionsValides(precisions);
  if (!precisionsOk) return fail("Requête invalide.");

  // Toute exception inattendue est rattrapée ici : une exception levée par une
  // Server Function arrive masquée en production, et le client n'afficherait
  // qu'un message générique sans cause.
  try {
    return ok(await analyser(propre, precisionsOk));
  } catch (err) {
    console.error("[saisie-taches] Exception inattendue pendant l'analyse.", err);
    const message = err instanceof Error ? err.message : "erreur inconnue";
    return ok({
      statut: "erreur",
      code: "echec",
      message: MESSAGE_ECHEC,
      detail: `Erreur serveur inattendue : ${message}`.slice(0, 200),
    });
  }
}

async function analyser(propre: string, precisions: PrecisionDonnee[]): Promise<AnalyseSaisie> {
  let listes, tags;
  try {
    [listes, tags] = await Promise.all([getListes(), getTags()]);
  } catch (err) {
    console.error("[saisie-taches] Lecture des listes/tags impossible.", err);
    return {
      statut: "erreur",
      code: "echec",
      message: MESSAGE_ECHEC,
      detail: "Lecture des listes et des tags impossible.",
    };
  }

  const ctx = {
    aujourdhui: aujourdhuiISO(),
    listes: listes.map((l) => ({ id: l.id, nom: l.nom })),
    tags: tags.map((t) => ({ id: t.id, nom: t.nom })),
  };

  const reponse = await appelerGeminiSaisie(construirePrompt({ texte: propre, precisions, ctx }));
  if (!reponse.ok) {
    return {
      statut: "erreur",
      code: reponse.code,
      message: reponse.code === "quota" ? MESSAGE_QUOTA : MESSAGE_ECHEC,
      detail: reponse.detail,
    };
  }

  const resultat = interpreterReponse(reponse.brut, ctx, MAX_QUESTIONS - precisions.length);
  if (resultat.statut === "vide") {
    return { statut: "erreur", code: "incomprehensible", message: MESSAGE_INCOMPRIS };
  }
  return resultat;
}

// --- Création ---

// Champs réellement lus à la création : le reste de `TachePropose` (noms
// d'affichage, avertissements) n'a pas à transiter. Tout est revalidé par
// parseTacheInput (createTache) : une Server Function est joignable par un
// POST direct, on ne fait pas confiance à ce que le client renvoie.
export type TacheACreer = Pick<
  TachePropose,
  | "titre"
  | "echeance"
  | "heure"
  | "heure_fin"
  | "toute_la_journee"
  | "priorite"
  | "rappel_minutes"
  | "recurrence_frequence"
  | "recurrence_fin"
  | "listeId"
  | "nouvelleListe"
  | "tagIds"
  | "nouveauxTags"
>;

export type ResultatCreation =
  | { index: number; ok: true; id: string; avertissement?: string }
  | { index: number; ok: false; message: string };

type Supabase = ReturnType<typeof createAdminClient>;

// Retrouve une liste par son nom (sans accents ni casse) ou la crée en fin
// de navigation. `cache` évite de créer deux fois la même liste quand
// plusieurs tâches d'un même lot la citent.
async function assurerListe(supabase: Supabase, nom: string, cache: Map<string, string>): Promise<string> {
  const cle = normaliserTexte(nom);
  const enCache = cache.get(cle);
  if (enCache) return enCache;

  const { data: existantes, error } = await supabase.from("listes_taches").select("id, nom, ordre");
  if (error) throw new Error(error.message);

  const trouvee = (existantes ?? []).find((l) => normaliserTexte(l.nom) === cle);
  if (trouvee) {
    cache.set(cle, trouvee.id);
    return trouvee.id;
  }

  const ordre = (existantes ?? []).reduce((max, l) => Math.max(max, l.ordre), -1) + 1;
  const { data, error: erreurInsertion } = await supabase
    .from("listes_taches")
    .insert({ nom: nom.trim().slice(0, 40), ordre })
    .select("id")
    .single();
  if (erreurInsertion) throw new Error(erreurInsertion.message);

  cache.set(cle, data.id);
  revalidatePath("/taches");
  revalidatePath("/taches/listes");
  return data.id;
}

// Crée (ou retrouve) une liste avant d'ouvrir le formulaire pré-rempli d'une
// tâche proposée : le formulaire ne sait choisir qu'une liste existante.
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

// Crée les tâches validées, une à une (l'ordre dans la liste dépend de la
// précédente). Un échec n'arrête pas le lot : chaque tâche a son résultat,
// l'UI garde celles qui ont échoué dans l'aperçu.
export async function creerTachesProposees(
  taches: TacheACreer[]
): Promise<ActionResult<ResultatCreation[]>> {
  if (!Array.isArray(taches) || taches.length === 0 || taches.length > MAX_TACHES) {
    return fail("Aucune tâche à créer.");
  }

  const supabase = createAdminClient();
  const cacheListes = new Map<string, string>();
  const resultats: ResultatCreation[] = [];

  for (const [index, t] of taches.entries()) {
    try {
      const listeId = t.nouvelleListe
        ? await assurerListe(supabase, t.nouvelleListe, cacheListes)
        : t.listeId;
      if (!listeId) {
        resultats.push({ index, ok: false, message: "Liste introuvable." });
        continue;
      }

      const formData = new FormData();
      formData.set("titre", String(t.titre ?? ""));
      formData.set("liste_id", listeId);
      formData.set("echeance", t.echeance ?? "");
      formData.set("heure", t.heure ?? "");
      formData.set("heure_fin", t.heure_fin ?? "");
      formData.set("priorite", String(t.priorite ?? "aucune"));
      formData.set("recurrence_frequence", t.recurrence_frequence ?? "");
      formData.set("recurrence_fin", t.recurrence_fin ?? "");
      formData.set("rappel_minutes", t.rappel_minutes === null ? "" : String(t.rappel_minutes));
      if (t.toute_la_journee) formData.set("toute_la_journee", "on");
      for (const id of Array.isArray(t.tagIds) ? t.tagIds : []) formData.append("tag_ids", String(id));
      // Virgules retirées : createTache découpe `nouveaux_tags` sur ce signe.
      formData.set(
        "nouveaux_tags",
        (Array.isArray(t.nouveauxTags) ? t.nouveauxTags : []).map((n) => String(n).replace(/,/g, " ")).join(",")
      );

      const etat = await createTache({ error: null }, formData);
      if (etat.error || !etat.id) {
        resultats.push({ index, ok: false, message: etat.error ?? "La tâche n'a pas pu être créée." });
      } else {
        resultats.push({
          index,
          ok: true,
          id: etat.id,
          ...(etat.avertissement ? { avertissement: etat.avertissement } : {}),
        });
      }
    } catch (err) {
      console.error("[saisie-taches] Création d'une tâche en échec.", err);
      resultats.push({ index, ok: false, message: "La tâche n'a pas pu être créée. Réessaie." });
    }
  }

  return ok(resultats);
}
