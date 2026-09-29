import { appelerGemini, type ResultatGemini } from "@/lib/gemini/appel";
import { MAX_TACHES } from "./saisie-naturelle";

// Appel Gemini de la saisie naturelle : le client commun (lib/gemini/appel)
// fait le travail — clé, timeout, quota, cause détaillée des échecs — ici on
// ne fournit que le schéma de réponse propre à cette fonction.

const GEMINI_TIMEOUT_MS = 10_000;

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

export function appelerGeminiSaisie(prompt: string): Promise<ResultatGemini> {
  return appelerGemini({
    prompt,
    schema: SCHEMA_REPONSE,
    timeoutMs: GEMINI_TIMEOUT_MS,
    temperature: 0.2,
    etiquette: "saisie-taches",
  });
}
