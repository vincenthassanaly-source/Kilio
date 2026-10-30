"use server";

import { appelerGemini, MESSAGE_QUOTA_GEMINI } from "@/lib/gemini/appel";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { aujourdhuiParis, heureParis } from "@/lib/date/paris";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  construirePrompt,
  LONGUEUR_MAX_SAISIE,
  normaliserReponse,
  SCHEMA_SAISIE,
  type ElementSaisie,
} from "@/lib/saisie/compute";

// Saisie en langage naturel : une phrase devient des tâches et événements
// PROPOSÉS. Rien n'est écrit ici : l'aperçu côté client valide, puis appelle
// createTache / createEvenement comme les formulaires.

const TIMEOUT_MS = 20_000;
const MAX_ESSAIS = 2;

// Plafond de débit par instance (best effort), pour protéger le quota gratuit
// partagé avec le Réveil, le tri de documents et le carnet.
const FENETRE_MS = 60_000;
const MAX_APPELS_PAR_FENETRE = 8;
let appelsRecents: number[] = [];

function limiteAtteinte(maintenant: number): boolean {
  appelsRecents = appelsRecents.filter((t) => maintenant - t < FENETRE_MS);
  if (appelsRecents.length >= MAX_APPELS_PAR_FENETRE) return true;
  appelsRecents.push(maintenant);
  return false;
}

export async function interpreterSaisie(texte: string): Promise<ActionResult<ElementSaisie[]>> {
  const phrase = typeof texte === "string" ? texte.trim() : "";
  if (!phrase) return fail("Écris ce que tu veux ajouter.");
  if (phrase.length > LONGUEUR_MAX_SAISIE) {
    return fail(`Phrase trop longue (${LONGUEUR_MAX_SAISIE} caractères au plus).`);
  }
  if (limiteAtteinte(Date.now())) return fail("Trop de demandes, réessaie dans une minute.");

  const supabase = createAdminClient();
  const [listesRes, tagsRes] = await Promise.all([
    supabase.from("listes_taches").select("id, nom").order("ordre", { ascending: true }),
    supabase.from("tags").select("id, nom").order("nom", { ascending: true }),
  ]);
  if (listesRes.error) return fail("Impossible de lire tes listes de tâches. Réessaie.");

  const contexte = {
    aujourdhui: aujourdhuiParis(),
    heure: heureParis(),
    listes: listesRes.data ?? [],
    // Les tags ne sont qu'un confort : une erreur de lecture n'empêche pas la saisie.
    tags: tagsRes.error ? [] : (tagsRes.data ?? []),
  };
  const prompt = construirePrompt(phrase, contexte);

  let detail = "";
  for (let essai = 1; essai <= MAX_ESSAIS; essai++) {
    const resultat = await appelerGemini({
      prompt,
      schema: SCHEMA_SAISIE,
      timeoutMs: TIMEOUT_MS,
      temperature: 0,
      etiquette: "saisie-naturelle",
    });
    if (!resultat.ok) {
      if (resultat.code === "quota") return fail(MESSAGE_QUOTA_GEMINI);
      detail = resultat.detail;
      continue;
    }
    const elements = normaliserReponse(resultat.brut, contexte);
    if (elements === null) {
      detail = "Réponse inattendue.";
      continue;
    }
    if (elements.length === 0) return fail("Je n'ai trouvé ni tâche ni événement dans cette phrase.");
    return ok(elements);
  }
  return fail(`Gemini n'a pas pu interpréter la phrase (${detail}). Réessaie.`);
}
