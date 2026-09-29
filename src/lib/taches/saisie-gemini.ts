import { GEMINI_MODEL } from "@/lib/programme/generation";
import { MAX_TACHES } from "./saisie-naturelle";

// Appel Gemini de la saisie naturelle : sortie JSON contrainte par un schéma,
// timeout court, jamais d'exception. `quota` (HTTP 429) est distingué des
// autres échecs : l'UI n'y propose pas « Réessayer » de la même façon. Aucun
// compteur d'appels de notre côté : c'est Google qui renvoie 429 quand le
// quota gratuit (partagé avec le programme du jour) est atteint.

const GEMINI_TIMEOUT_MS = 10_000;

export type ResultatGemini =
  | { ok: true; brut: unknown }
  | { ok: false; code: "quota" | "echec" };

const SCHEMA_REPONSE = {
  type: "object",
  properties: {
    question: {
      type: "object",
      nullable: true,
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
          date: { type: "string", nullable: true },
          heure: { type: "string", nullable: true },
          heure_fin: { type: "string", nullable: true },
          toute_la_journee: { type: "boolean" },
          priorite: { type: "string", enum: ["aucune", "basse", "moyenne", "haute"] },
          rappel_minutes: { type: "integer", nullable: true },
          recurrence_frequence: { type: "string", nullable: true },
          recurrence_non_supportee: { type: "string", nullable: true },
          recurrence_fin: { type: "string", nullable: true },
          liste: { type: "string", nullable: true },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["titre", "toute_la_journee", "priorite", "tags"],
      },
    },
  },
  required: ["question", "taches"],
};

export async function appelerGeminiSaisie(prompt: string): Promise<ResultatGemini> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[saisie-taches] GEMINI_API_KEY absente : analyse impossible.");
    return { ok: false, code: "echec" };
  }

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
      return { ok: false, code: "quota" };
    }
    if (!res.ok) {
      console.error(`[saisie-taches] Gemini a répondu ${res.status}.`);
      return { ok: false, code: "echec" };
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const texte = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof texte !== "string") {
      console.error("[saisie-taches] Réponse Gemini sans texte structuré.");
      return { ok: false, code: "echec" };
    }

    return { ok: true, brut: JSON.parse(texte) };
  } catch (err) {
    console.error("[saisie-taches] Appel Gemini en échec.", err);
    return { ok: false, code: "echec" };
  }
}
