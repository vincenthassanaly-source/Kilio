"use server";

import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { aujourdhuiISO } from "@/lib/budget/compute";
import { heureParis } from "@/lib/date/paris";
import { MESSAGE_QUOTA_GEMINI } from "@/lib/gemini/appel";
import { appelerGeminiSaisie } from "@/lib/saisie-ia/gemini";
import { construirePrompt, construireSchema, interpreterReponse } from "@/lib/saisie-ia/moteur";
import { MODULES_SERVEUR } from "@/lib/saisie-ia/registre";
import {
  MAX_ELEMENTS,
  MAX_QUESTIONS,
  MAX_TEXTE,
  type ElementACreer,
  type ElementPropose,
  type PrecisionDonnee,
  type ResultatCreation,
} from "@/lib/saisie-ia/types";

// Actions de « Ajouter avec l'IA » : analyse d'un texte libre puis création des
// éléments validés, pour tous les modules branchés (lib/saisie-ia/registre).

export type AnalyseSaisie =
  | { statut: "elements"; elements: ElementPropose[] }
  | { statut: "question"; question: string; choix: string[] }
  // `detail` : cause technique courte (statut HTTP, délai dépassé…), affichée
  // sous le message pour qu'un échec ne reste pas un mystère.
  | { statut: "erreur"; code: "quota" | "echec" | "incomprehensible"; message: string; detail?: string };

const MESSAGE_ECHEC = "L'analyse a échoué. Réessaie.";
const MESSAGE_INCOMPRIS = "Je n'ai rien trouvé à ajouter dans ce texte. Reformule ou crée-le à la main.";

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
// éléments à valider, ou une question de précision, ou une erreur typée. Rien
// n'est écrit en base ici : la création n'a lieu qu'au tap de validation.
export async function analyserSaisie(
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
    console.error("[saisie-ia] Exception inattendue pendant l'analyse.", err);
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
  const aujourdhui = aujourdhuiISO();

  let contextes;
  try {
    contextes = await Promise.all(MODULES_SERVEUR.map((m) => m.preparer(aujourdhui)));
  } catch (err) {
    console.error("[saisie-ia] Lecture du contexte des modules impossible.", err);
    return {
      statut: "erreur",
      code: "echec",
      message: MESSAGE_ECHEC,
      detail: "Lecture du contexte impossible (listes, tags…).",
    };
  }

  const prompt = construirePrompt({
    texte: propre,
    precisions,
    aujourdhui,
    heure: heureParis(),
    modules: MODULES_SERVEUR,
    contextes,
  });
  const reponse = await appelerGeminiSaisie(prompt, construireSchema(MODULES_SERVEUR));
  if (!reponse.ok) {
    return {
      statut: "erreur",
      code: reponse.code,
      message: reponse.code === "quota" ? MESSAGE_QUOTA_GEMINI : MESSAGE_ECHEC,
      detail: reponse.detail,
    };
  }

  const resultat = interpreterReponse(reponse.brut, MODULES_SERVEUR, contextes, MAX_QUESTIONS - precisions.length);
  if (resultat.statut === "vide") {
    return { statut: "erreur", code: "incomprehensible", message: MESSAGE_INCOMPRIS };
  }
  return resultat;
}

// Crée les éléments validés, module par module (chaque module sait écrire les
// siens). Un échec n'arrête pas le lot : chaque élément a son résultat, indexé
// comme la requête, et l'UI garde ceux qui ont échoué dans l'aperçu.
export async function creerElementsProposes(
  elements: ElementACreer[]
): Promise<ActionResult<ResultatCreation[]>> {
  if (!Array.isArray(elements) || elements.length === 0 || elements.length > MAX_ELEMENTS) {
    return fail("Rien à créer.");
  }

  const resultats: ResultatCreation[] = [];
  for (const moduleIA of MODULES_SERVEUR) {
    const indexes: number[] = [];
    const ceModule: ElementACreer[] = [];
    elements.forEach((e, index) => {
      if (e?.type === moduleIA.type) {
        indexes.push(index);
        ceModule.push(e);
      }
    });
    if (ceModule.length === 0) continue;

    let issues;
    try {
      issues = await moduleIA.creer(ceModule);
    } catch (err) {
      console.error(`[saisie-ia] Création impossible (${moduleIA.type}).`, err);
      issues = ceModule.map(() => ({ ok: false as const, message: "La création a échoué. Réessaie." }));
    }
    issues.forEach((issue, i) => resultats.push({ ...issue, index: indexes[i] }));
  }

  // Un type inconnu (requête forgée) n'a de résultat dans aucun module.
  const traites = new Set(resultats.map((r) => r.index));
  elements.forEach((_, index) => {
    if (!traites.has(index)) resultats.push({ index, ok: false, message: "Type d'élément inconnu." });
  });
  resultats.sort((a, b) => a.index - b.index);
  return ok(resultats);
}
