import { GEMINI_MODEL } from "@/lib/programme/generation";
import { MAX_TACHES } from "./saisie-naturelle";

// Appel Gemini de la saisie naturelle : sortie JSON contrainte par un schéma,
// timeout court, jamais d'exception. `quota` (HTTP 429) est distingué des
// autres échecs : l'UI n'y propose pas « Réessayer » de la même façon. Aucun
// compteur d'appels de notre côté : c'est Google qui renvoie 429 quand le
// quota gratuit (partagé avec le programme du jour) est atteint.
//
// Chaque échec porte un `detail` court, affiché sous le message d'erreur : la
// cause exacte (statut HTTP, message de Google, délai dépassé…) ne se perd plus
// derrière un « L'analyse a échoué » identique pour tous les cas.

const GEMINI_TIMEOUT_MS = 10_000;
const DETAIL_MAX = 200;

export type ResultatGemini =
  | { ok: true; brut: unknown }
  | { ok: false; code: "quota" | "echec"; detail: string };

// Schéma volontairement sans `nullable` : aucune valeur n'est optionnelle,
// « pas de valeur » s'écrit par une chaîne vide (ou 0 pour le rappel). Le
// mot-clé `nullable` du sous-ensemble OpenAPI de Gemini n'est pas garanti
// selon les modèles ; une chaîne vide, elle, l'est toujours. La revalidation
// côté serveur (saisie-naturelle.ts) traite ces valeurs vides comme absentes.
export const SCHEMA_REPONSE = {
  type: "object",
  properties: {
    question: {
      type: "object",
      properties: {
        texte: { type: "string" },
        choix: { type: "array", maxItems: 4, items: { type: "string" } },
      },
      required: ["texte", "choix"],
    },
    taches: {
      type: "array",
      maxItems: MAX_TACHES,
      items: {
        type: "object",
        properties: {
          titre: { type: "string" },
          date: { type: "string" },
          heure: { type: "string" },
          heure_fin: { type: "string" },
          toute_la_journee: { type: "boolean" },
          priorite: { type: "string", enum: ["aucune", "basse", "moyenne", "haute"] },
          rappel_minutes: { type: "integer" },
          recurrence_frequence: { type: "string" },
          recurrence_non_supportee: { type: "string" },
          recurrence_fin: { type: "string" },
          liste: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: [
          "titre",
          "date",
          "heure",
          "heure_fin",
          "toute_la_journee",
          "priorite",
          "rappel_minutes",
          "recurrence_frequence",
          "recurrence_non_supportee",
          "recurrence_fin",
          "liste",
          "tags",
        ],
      },
    },
  },
  required: ["question", "taches"],
};

function echec(detail: string): ResultatGemini {
  console.error(`[saisie-taches] ${detail}`);
  return { ok: false, code: "echec", detail: detail.slice(0, DETAIL_MAX) };
}

// Message d'erreur renvoyé par Google (`{ error: { message } }`), s'il y en a
// un : c'est lui qui dit, par exemple, quel champ du schéma est refusé.
async function messageGoogle(res: Response): Promise<string> {
  try {
    const corps = (await res.json()) as { error?: { message?: unknown } };
    const message = corps.error?.message;
    return typeof message === "string" ? message.replace(/\s+/g, " ").trim() : "";
  } catch {
    return "";
  }
}

export async function appelerGeminiSaisie(prompt: string): Promise<ResultatGemini> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return echec("Clé GEMINI_API_KEY absente sur le serveur.");

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        // Clé en en-tête plutôt qu'en paramètre d'URL : elle ne finit jamais
        // dans un message d'erreur ni dans un journal de requêtes.
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: SCHEMA_REPONSE,
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      }
    );

    if (res.status === 429) {
      console.warn("[saisie-taches] Quota Gemini atteint (429).");
      return { ok: false, code: "quota", detail: "Gemini a répondu 429." };
    }
    if (!res.ok) {
      const message = await messageGoogle(res);
      return echec(`Gemini a répondu ${res.status}${message ? ` : ${message}` : "."}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      promptFeedback?: { blockReason?: string };
    };
    const candidat = data.candidates?.[0];
    const texte = candidat?.content?.parts?.[0]?.text;
    if (typeof texte !== "string") {
      const motif = data.promptFeedback?.blockReason ?? candidat?.finishReason;
      return echec(`Réponse Gemini sans texte${motif ? ` (${motif})` : ""}.`);
    }

    try {
      return { ok: true, brut: JSON.parse(texte) };
    } catch {
      return echec(`Réponse Gemini illisible${candidat?.finishReason ? ` (${candidat.finishReason})` : ""}.`);
    }
  } catch (err) {
    const delaiDepasse = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return echec(
      delaiDepasse
        ? `Délai dépassé (${GEMINI_TIMEOUT_MS / 1000} s) : Gemini n'a pas répondu à temps.`
        : `Appel à Gemini impossible : ${err instanceof Error ? err.message : "erreur inconnue"}.`
    );
  }
}
