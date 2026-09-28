import type { Tables } from "@/lib/supabase/types";

export type Skill = Tables<"skills_catalogue">;

const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_TIMEOUT_MS = 6000;

// Mode « je ne sais pas quoi choisir » — matching par mots communs entre le
// besoin décrit et nom/description/exemples. Filet de sécurité si l'appel
// Gemini échoue (voir suggererSkillsParGemini) : c'est la logique V1,
// conservée telle quelle.
export function suggererSkillsParMotsCles(besoin: string, skills: Skill[]): Skill[] {
  const mots = besoin
    .toLowerCase()
    .split(/[^a-zàâäéèêëïîôöùûüç0-9]+/)
    .filter((mot) => mot.length >= 3);

  if (mots.length === 0) return [];

  const scores = skills.map((skill) => {
    const texte = `${skill.nom} ${skill.description} ${skill.exemples.join(" ")}`.toLowerCase();
    const score = mots.reduce((acc, mot) => acc + (texte.includes(mot) ? 1 : 0), 0);
    return { skill, score };
  });

  return scores
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.skill);
}

type FicheCompacte = { id: string; nom: string; description: string; exemples: string[]; categorie: string };

/**
 * Matching sémantique via l'API Gemini (gemini-3.1-flash-lite, tier gratuit).
 * Renvoie `null` quand l'appel doit être considéré en échec — clé absente,
 * requête réseau en erreur ou trop lente (timeout court, on est sur Vercel
 * Hobby), réponse HTTP non-2xx, ou JSON structuré invalide/inattendu — pour
 * que l'appelant retombe sur `suggererSkillsParMotsCles`. Un tableau vide
 * est en revanche une réponse valide : le modèle n'a trouvé aucune fiche
 * pertinente.
 */
export async function suggererSkillsParGemini(besoin: string, skills: Skill[]): Promise<Skill[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[skills/matching] GEMINI_API_KEY absente : repli sur le matching par mots-clés.");
    return null;
  }
  if (skills.length === 0) return [];

  const fiches: FicheCompacte[] = skills.map((skill) => ({
    id: skill.id,
    nom: skill.nom,
    description: skill.description,
    exemples: skill.exemples,
    categorie: skill.categorie,
  }));

  const prompt = [
    `Besoin décrit par l'utilisateur : "${besoin}"`,
    "",
    `Catalogue de fiches disponibles (JSON, ${fiches.length} entrées) :`,
    JSON.stringify(fiches),
    "",
    'Renvoie les identifiants ("id") des 2 à 3 fiches les plus pertinentes pour ce besoin, du plus au moins pertinent. Si vraiment aucune fiche ne convient, renvoie une liste vide.',
  ].join("\n");

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                suggestions: { type: "array", items: { type: "string" }, maxItems: 3 },
              },
              required: ["suggestions"],
            },
          },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      }
    );

    if (!res.ok) {
      console.error(`[skills/matching] Gemini a répondu ${res.status} : repli sur le matching par mots-clés.`);
      return null;
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const texte = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof texte !== "string") {
      console.error("[skills/matching] Réponse Gemini sans texte structuré : repli sur le matching par mots-clés.");
      return null;
    }

    const parsed = JSON.parse(texte) as { suggestions?: unknown };
    if (!Array.isArray(parsed.suggestions)) {
      console.error("[skills/matching] JSON Gemini sans champ suggestions[] : repli sur le matching par mots-clés.");
      return null;
    }

    const parId = new Map(skills.map((skill) => [skill.id, skill]));

    const resultats = parsed.suggestions
      .filter((id): id is string => typeof id === "string")
      .map((id) => parId.get(id))
      .filter((skill): skill is Skill => skill !== undefined)
      .slice(0, 3);

    console.log(`[skills/matching] Gemini OK : ${resultats.length} suggestion(s) pour "${besoin}".`);
    return resultats;
  } catch (err) {
    // Réseau, timeout (AbortSignal.timeout déclenche une AbortError) ou
    // JSON.parse invalide : dans tous les cas, l'appelant retombe sur le
    // matching par mots-clés.
    console.error("[skills/matching] Appel Gemini en échec : repli sur le matching par mots-clés.", err);
    return null;
  }
}
