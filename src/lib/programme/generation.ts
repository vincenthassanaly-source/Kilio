// Génération du "programme du jour" via l'API Gemini (gemini-3.1-flash-lite,
// tier gratuit) : requête structurée (responseSchema), timeout court, jamais
// d'exception. Il n'existe pas de repli local (rien à générer sans Gemini) :
// un échec est renvoyé avec sa cause (statut HTTP, délai dépassé…) et
// l'appelant (app/actions/programme.ts) l'affiche plutôt que de fabriquer une
// proposition.
//
// Gemini connaît la journée réelle : l'heure, les horaires de travail et les
// plages libres, calculées par l'app (./disponibilites) et non déduites par le
// modèle. Ses créneaux sont revalidés ici : un horaire qui sortirait des
// plages libres (donc qui chevaucherait le travail ou un rendez-vous) est
// retiré, la suggestion est conservée sans créneau.

import { appelerGemini } from "@/lib/gemini/appel";
import {
  dureeTotale,
  enMinutes,
  libelleCreneau,
  libelleDuree,
  seChevauchent,
  validerCreneau,
  type Plage,
} from "./disponibilites";

const GEMINI_TIMEOUT_MS = 8000;

export type TacheSnapshot = {
  titre: string;
  heure: string | null;
  heureFin: string | null;
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

type PropositionProgramme = {
  texte: string;
  source: SourceProposition;
  /** `17:00–18:00`, toujours contenu dans une plage libre ; null sans créneau. */
  creneau: string | null;
};

export type ProgrammeGenere = {
  intro: string;
  propositions: PropositionProgramme[];
};

/** La journée telle que l'app la connaît, pour situer les suggestions. */
export type ContexteJour = {
  /** Heure courante à Paris, `HH:MM`. */
  maintenant: string;
  creneauxTravail: Plage[];
  plagesLibres: Plage[];
  /** Nombre maximal de suggestions (proportionnel au temps libre). */
  plafond: number;
};

export type EntreeProgramme = {
  taches: TacheSnapshot[];
  notes: NoteSnapshot[];
  habitudes: HabitudeSnapshot[];
  contexte: ContexteJour;
};

export type ResultatProgramme =
  | { ok: true; programme: ProgrammeGenere }
  | { ok: false; code: "quota" | "echec"; detail: string };

const SOURCES_VALIDES: readonly SourceProposition[] = ["tache", "note", "habitude", "general"];

export function construirePrompt(input: EntreeProgramme): string {
  const { contexte } = input;
  const jourTravaille = contexte.creneauxTravail.length > 0;

  return [
    "Tu aides Vincent à organiser sa journée à partir des données de son app personnelle Kilio.",
    "",
    `Il est ${contexte.maintenant} à Paris.`,
    jourTravaille
      ? `Aujourd'hui est un jour travaillé (créneaux de travail : ${contexte.creneauxTravail.map(libelleCreneau).join(", ")}).`
      : "Aujourd'hui est un jour de repos (aucun créneau de travail).",
    `Plages libres restantes aujourd'hui, calculées par l'app (JSON) : ${JSON.stringify(contexte.plagesLibres)} — temps libre total : ${libelleDuree(dureeTotale(contexte.plagesLibres))}.`,
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
    `Propose un programme pour aujourd'hui : une phrase d'intro courte et concrète (pas de salutation), puis ${contexte.plafond} suggestions maximum, classées par priorité. Chaque suggestion cite la source qui l'a inspirée ("tache", "note", "habitude", ou "general" si c'est une idée libre sans source précise). Ignore les catégories vides. Reste factuel, aucune invention de tâche ou de note qui n'existe pas dans les données ci-dessus.`,
    "Chaque suggestion a aussi un `creneau` : un horaire au format HH:MM-HH:MM (trait d'union simple) entièrement contenu dans UNE des plages libres ci-dessus, qui ne chevauche aucune autre suggestion, et d'une durée réaliste pour la suggestion (de 30 minutes à 2 heures). Mets une chaîne vide si la suggestion n'a pas besoin d'un horaire précis. N'invente jamais de plage libre.",
    "Les tâches qui ont déjà une heure sont déjà planifiées : ne leur donne pas de créneau.",
    ...(jourTravaille || contexte.plafond < 5
      ? ["Il y a peu de temps libre ou un jour travaillé : propose peu de choses, courtes, plutôt que de remplir la journée."]
      : []),
  ].join("\n");
}

const SCHEMA_PROPOSITION = (plafond: number) => ({
  type: "object",
  properties: {
    intro: { type: "string" },
    propositions: {
      type: "array",
      maxItems: plafond,
      items: {
        type: "object",
        properties: {
          texte: { type: "string" },
          source: { type: "string", enum: SOURCES_VALIDES as unknown as string[] },
          // Chaîne vide plutôt que null : pas de `nullable` dans le schéma.
          creneau: { type: "string" },
        },
        required: ["texte", "source", "creneau"],
      },
    },
  },
  required: ["intro", "propositions"],
});

/**
 * Transforme le JSON de Gemini en programme fiable : sources connues, plafond
 * respecté, créneaux valides (contenus dans une plage libre, sans chevauchement
 * entre suggestions) puis suggestions triées dans l'ordre de la journée, celles
 * sans créneau à la suite. Null si la structure est invalide.
 */
export function interpreterProgramme(brut: unknown, contexte: ContexteJour): ProgrammeGenere | null {
  if (typeof brut !== "object" || brut === null) return null;
  const { intro, propositions } = brut as { intro?: unknown; propositions?: unknown };
  if (typeof intro !== "string" || !Array.isArray(propositions)) return null;

  const valides = propositions
    .filter(
      (p): p is { texte: string; source?: unknown; creneau?: unknown } =>
        typeof p === "object" && p !== null && typeof (p as { texte?: unknown }).texte === "string"
    )
    .slice(0, contexte.plafond);

  const retenus: Plage[] = [];
  const resultat = valides.map((p) => {
    let creneau: Plage | null = validerCreneau(p.creneau, contexte.plagesLibres);
    if (creneau && retenus.some((autre) => seChevauchent(autre, creneau!))) creneau = null;
    if (creneau) retenus.push(creneau);
    return {
      texte: p.texte,
      source: SOURCES_VALIDES.includes(p.source as SourceProposition) ? (p.source as SourceProposition) : "general",
      creneau,
    };
  });

  // Tri stable : d'abord ce qui a un horaire, dans l'ordre de la journée.
  const ordonnees = [...resultat].sort((a, b) => {
    if (a.creneau && b.creneau) return enMinutes(a.creneau.debut) - enMinutes(b.creneau.debut);
    if (a.creneau) return -1;
    if (b.creneau) return 1;
    return 0;
  });

  return {
    intro,
    propositions: ordonnees.map((p) => ({ ...p, creneau: p.creneau ? libelleCreneau(p.creneau) : null })),
  };
}

export async function genererProgrammeParGemini(input: EntreeProgramme): Promise<ResultatProgramme> {
  const reponse = await appelerGemini({
    prompt: construirePrompt(input),
    schema: SCHEMA_PROPOSITION(input.contexte.plafond),
    timeoutMs: GEMINI_TIMEOUT_MS,
    etiquette: "programme/generation",
  });
  if (!reponse.ok) return reponse;

  const programme = interpreterProgramme(reponse.brut, input.contexte);
  if (!programme) {
    const detail = "Réponse Gemini invalide (intro ou propositions manquants).";
    console.error(`[programme/generation] ${detail}`);
    return { ok: false, code: "echec", detail };
  }

  console.log(`[programme/generation] Gemini OK : ${programme.propositions.length} proposition(s).`);
  return { ok: true, programme };
}
