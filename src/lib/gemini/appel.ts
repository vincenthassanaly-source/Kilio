// Appel unique à l'API Gemini pour toutes les fonctions de l'app (programme du
// jour, saisie de tâches en langage naturel) : sortie JSON contrainte par un
// schéma, timeout, jamais d'exception. Un seul endroit donc pour la clé, le
// modèle et surtout le diagnostic : chaque échec porte un `detail` court
// (statut HTTP et message de Google, délai dépassé, réponse bloquée ou
// tronquée, clé absente…), affiché à l'écran plutôt que perdu dans un
// « ça a échoué » identique pour toutes les causes.
//
// `quota` (HTTP 429) est distingué des autres échecs. Aucun compteur d'appels
// de notre côté : c'est Google qui renvoie 429 quand le quota gratuit,
// partagé entre les fonctions, est atteint.

export const GEMINI_MODEL = "gemini-3.1-flash-lite";
export const MESSAGE_QUOTA_GEMINI = "Le quota gratuit de Gemini est atteint pour le moment. Réessaie plus tard.";
const DETAIL_MAX = 200;

export type ResultatGemini =
  | { ok: true; brut: unknown }
  | { ok: false; code: "quota" | "echec"; detail: string };

export type AppelGemini = {
  prompt: string;
  /** Schéma de réponse (sous-ensemble OpenAPI de Gemini). */
  schema: unknown;
  timeoutMs: number;
  temperature?: number;
  /** Préfixe des logs serveur, ex. `saisie-taches`. */
  etiquette: string;
};

function echec(etiquette: string, detail: string): ResultatGemini {
  console.error(`[${etiquette}] ${detail}`);
  return { ok: false, code: "echec", detail: detail.slice(0, DETAIL_MAX) };
}

// Message d'erreur renvoyé par Google (`{ error: { message } }`), s'il y en a
// un : c'est lui qui dit, par exemple, quel champ du schéma est refusé ou que
// la clé est invalide.
async function messageGoogle(res: Response): Promise<string> {
  try {
    const corps = (await res.json()) as { error?: { message?: unknown } };
    const message = corps.error?.message;
    return typeof message === "string" ? message.replace(/\s+/g, " ").trim() : "";
  } catch {
    return "";
  }
}

export async function appelerGemini(appel: AppelGemini): Promise<ResultatGemini> {
  const { prompt, schema, timeoutMs, temperature, etiquette } = appel;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return echec(etiquette, "Clé GEMINI_API_KEY absente sur le serveur.");

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
            responseSchema: schema,
            ...(temperature === undefined ? {} : { temperature }),
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      }
    );

    if (res.status === 429) {
      console.warn(`[${etiquette}] Quota Gemini atteint (429).`);
      return { ok: false, code: "quota", detail: "Gemini a répondu 429." };
    }
    if (!res.ok) {
      const message = await messageGoogle(res);
      return echec(etiquette, `Gemini a répondu ${res.status}${message ? ` : ${message}` : "."}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      promptFeedback?: { blockReason?: string };
    };
    const candidat = data.candidates?.[0];
    const texte = candidat?.content?.parts?.[0]?.text;
    if (typeof texte !== "string") {
      const motif = data.promptFeedback?.blockReason ?? candidat?.finishReason;
      return echec(etiquette, `Réponse Gemini sans texte${motif ? ` (${motif})` : ""}.`);
    }

    try {
      return { ok: true, brut: JSON.parse(texte) };
    } catch {
      return echec(
        etiquette,
        `Réponse Gemini illisible${candidat?.finishReason ? ` (${candidat.finishReason})` : ""}.`
      );
    }
  } catch (err) {
    const delaiDepasse = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return echec(
      etiquette,
      delaiDepasse
        ? `Délai dépassé (${timeoutMs / 1000} s) : Gemini n'a pas répondu à temps.`
        : `Appel à Gemini impossible : ${err instanceof Error ? err.message : "erreur inconnue"}.`
    );
  }
}
