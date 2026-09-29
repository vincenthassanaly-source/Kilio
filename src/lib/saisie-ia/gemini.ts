import { appelerGemini, type ResultatGemini } from "@/lib/gemini/appel";

// Appel Gemini de la saisie « Ajouter avec l'IA » : le client commun
// (lib/gemini/appel) fait le travail — clé, timeout, quota, cause détaillée
// des échecs — ici on ne fournit que le schéma de réponse, composé par le
// moteur à partir des modules branchés (moteur.ts).

const GEMINI_TIMEOUT_MS = 10_000;

export function appelerGeminiSaisie(prompt: string, schema: unknown): Promise<ResultatGemini> {
  return appelerGemini({
    prompt,
    schema,
    timeoutMs: GEMINI_TIMEOUT_MS,
    temperature: 0.2,
    etiquette: "saisie-ia",
  });
}
