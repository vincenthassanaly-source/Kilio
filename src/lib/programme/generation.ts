// Génération du "programme du jour" via l'API Gemini (gemini-3.1-flash-lite,
// tier gratuit) : requête structurée (responseSchema), timeout court, jamais
// d'exception. Il n'existe pas de repli local (rien à générer sans Gemini) :
// un échec renvoie `null` et l'appelant (app/actions/programme.ts) affiche un
// message d'échec plutôt qu'une proposition inventée.

export const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_TIMEOUT_MS = 8000;
const MAX_PROPOSITIONS = 5;

export type TacheSnapshot = {
  titre: string;
  heure: string | null;
  priorite: string;
  enRetard: boolean;
};

export type NoteSnapshot = {
  titre: string;
  extrait: string;
};

export type HabitudeSnapshot = {
  nom: string;
  faite: boolean;
};

export type SourceProposition = "tache" | "note" | "habitude" | "general";

export type PropositionProgramme = {
  texte: string;
  source: SourceProposition;
};

export type ProgrammeGenere = {
  intro: string;
  propositions: PropositionProgramme[];
};

const SOURCES_VALIDES: readonly SourceProposition[] = ["tache", "note", "habitude", "general"];

export async function genererProgrammeParGemini(input: {
  taches: TacheSnapshot[];
  notes: NoteSnapshot[];
  habitudes: HabitudeSnapshot[];
}): Promise<ProgrammeGenere | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[programme/generation] GEMINI_API_KEY absente : génération impossible.");
    return null;
  }

  const prompt = [
    "Tu aides Vincent à organiser sa journée à partir des données de son app personnelle Kilio.",
    "",
    `Tâches non terminées, dues aujourd'hui ou en retard (JSON, ${input.taches.length} entrées) :`,
    JSON.stringify(input.taches),
    "",
    `Notes récentes ou épinglées (JSON, ${input.notes.length} entrées) :`,
    JSON.stringify(input.notes),
    "",
    `Habitudes du jour pas encore faites (JSON, ${input.habitudes.length} entrées) :`,
    JSON.stringify(input.habitudes),
    "",
    `Propose un programme pour aujourd'hui : une phrase d'intro courte et concrète (pas de salutation), puis ${MAX_PROPOSITIONS} suggestions maximum, classées par priorité. Chaque suggestion cite la source qui l'a inspirée ("tache", "note", "habitude", ou "general" si c'est une idée libre sans source précise). Ignore les catégories vides. Reste factuel, aucune invention de tâche ou de note qui n'existe pas dans les données ci-dessus.`,
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
                intro: { type: "string" },
                propositions: {
                  type: "array",
                  maxItems: MAX_PROPOSITIONS,
                  items: {
                    type: "object",
                    properties: {
                      texte: { type: "string" },
                      source: { type: "string", enum: SOURCES_VALIDES as unknown as string[] },
                    },
                    required: ["texte", "source"],
                  },
                },
              },
              required: ["intro", "propositions"],
            },
          },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      }
    );

    if (!res.ok) {
      console.error(`[programme/generation] Gemini a répondu ${res.status}.`);
      return null;
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const texte = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof texte !== "string") {
      console.error("[programme/generation] Réponse Gemini sans texte structuré.");
      return null;
    }

    const parsed = JSON.parse(texte) as { intro?: unknown; propositions?: unknown };
    if (typeof parsed.intro !== "string" || !Array.isArray(parsed.propositions)) {
      console.error("[programme/generation] JSON Gemini invalide (intro/propositions manquants).");
      return null;
    }

    const propositions = parsed.propositions
      .filter(
        (p): p is { texte: string; source: string } =>
          typeof p === "object" && p !== null && typeof (p as { texte?: unknown }).texte === "string"
      )
      .map((p) => ({
        texte: p.texte,
        source: SOURCES_VALIDES.includes(p.source as SourceProposition) ? (p.source as SourceProposition) : "general",
      }))
      .slice(0, MAX_PROPOSITIONS);

    console.log(`[programme/generation] Gemini OK : ${propositions.length} proposition(s).`);
    return { intro: parsed.intro, propositions };
  } catch (err) {
    console.error("[programme/generation] Appel Gemini en échec.", err);
    return null;
  }
}
