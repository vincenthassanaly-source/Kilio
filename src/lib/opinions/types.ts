// Types et constantes du module Opinions (idées politiques classées sur cinq
// axes). Module neutre : importé côté serveur et client.
import type { Tables } from "@/lib/supabase/types";

// --- Axes -------------------------------------------------------------------
// Convention d'affichage, sans portée normative : -2 = pôle de gauche de
// l'axe (`gauche`), +2 = pôle de droite (`droite`). Un score `null` veut dire
// « axe non concerné » (≠ 0, qui est une position neutre assumée).

export const AXES = [
  { id: "economique", label: "Économique", gauche: "État", droite: "Marché" },
  { id: "societal", label: "Sociétal", gauche: "Progressiste", droite: "Conservateur" },
  { id: "autorite", label: "Autorité", gauche: "Libertés", droite: "Autorité" },
  { id: "ecologie", label: "Écologie", gauche: "Écologie", droite: "Productivisme" },
  { id: "identite", label: "Identité", gauche: "Ouverture", droite: "Souveraineté" },
] as const;

export type Axe = (typeof AXES)[number];
export type AxeId = Axe["id"];
export type Scores = Record<AxeId, number | null>;

export const SCORE_MIN = -2;
export const SCORE_MAX = 2;

export function estScore(valeur: unknown): valeur is number {
  return typeof valeur === "number" && Number.isInteger(valeur) && valeur >= SCORE_MIN && valeur <= SCORE_MAX;
}

export function scoresVides(): Scores {
  return { economique: null, societal: null, autorite: null, ecologie: null, identite: null };
}

/** « +1 », « −2 » (vrai signe moins), « 0 ». */
export function formaterScore(score: number): string {
  if (score > 0) return `+${score}`;
  if (score < 0) return `−${Math.abs(score)}`;
  return "0";
}

/** Libellé en toutes lettres, pour les lecteurs d'écran et les pastilles. */
export function libelleScore(axe: Axe, score: number | null): string {
  if (score === null) return "Non concerné";
  if (score === 0) return "Neutre";
  const pole = score < 0 ? axe.gauche : axe.droite;
  return `${Math.abs(score) === 2 ? "Fortement" : "Plutôt"} ${pole.toLowerCase()}`;
}

// --- Thèmes -----------------------------------------------------------------

export const THEMES = [
  "economie",
  "fiscalite",
  "travail",
  "sante",
  "education",
  "immigration",
  "ecologie",
  "securite",
  "institutions",
  "international",
  "culture",
  "numerique",
] as const;
export type Theme = (typeof THEMES)[number];

export const LIBELLE_THEME: Record<Theme, string> = {
  economie: "Économie",
  fiscalite: "Fiscalité",
  travail: "Travail",
  sante: "Santé",
  education: "Éducation",
  immigration: "Immigration",
  ecologie: "Écologie",
  securite: "Sécurité",
  institutions: "Institutions",
  international: "International",
  culture: "Culture",
  numerique: "Numérique",
};

export function estTheme(valeur: unknown): valeur is Theme {
  return typeof valeur === "string" && (THEMES as readonly string[]).includes(valeur);
}

// --- Conviction -------------------------------------------------------------

export const CONVICTIONS = ["hesitant", "plutot", "certain"] as const;
export type Conviction = (typeof CONVICTIONS)[number];

export const LIBELLE_CONVICTION: Record<Conviction, string> = {
  hesitant: "Hésitant",
  plutot: "Plutôt",
  certain: "Certain",
};

export function estConviction(valeur: unknown): valeur is Conviction {
  return typeof valeur === "string" && (CONVICTIONS as readonly string[]).includes(valeur);
}

// --- Statut -----------------------------------------------------------------

const STATUTS = ["brouillon", "validee", "rejetee"] as const;
export type Statut = (typeof STATUTS)[number];

export const LIBELLE_STATUT: Record<Statut, string> = {
  brouillon: "Brouillon",
  validee: "Validée",
  rejetee: "Rejetée",
};

export function estStatut(valeur: unknown): valeur is Statut {
  return typeof valeur === "string" && (STATUTS as readonly string[]).includes(valeur);
}

// --- Champs éditables ---------------------------------------------------------

export const POSITION_MAX = 280;
export const ARGUMENTS_MAX = 2000;
export const SOURCE_MAX = 500;

/** Champs de fond d'une idée (hors statut, géré à part). */
export type ChampsIdee = {
  position: string;
  theme: Theme | null;
  conviction: Conviction;
  arguments_pour: string;
  arguments_contre: string;
  source: string;
  scores: Scores;
};

type LigneChamps = Pick<
  Tables<"opinions_idees">,
  | "position"
  | "theme"
  | "conviction"
  | "arguments_pour"
  | "arguments_contre"
  | "source"
  | "score_economique"
  | "score_societal"
  | "score_autorite"
  | "score_ecologie"
  | "score_identite"
>;

/** Lecture tolérante d'une ligne SQL : une valeur hors domaine devient neutre. */
export function champsDepuisLigne(ligne: LigneChamps): ChampsIdee {
  const score = (valeur: number | null) => (estScore(valeur) ? valeur : null);
  return {
    position: ligne.position,
    theme: estTheme(ligne.theme) ? ligne.theme : null,
    conviction: estConviction(ligne.conviction) ? ligne.conviction : "plutot",
    arguments_pour: ligne.arguments_pour,
    arguments_contre: ligne.arguments_contre,
    source: ligne.source,
    scores: {
      economique: score(ligne.score_economique),
      societal: score(ligne.score_societal),
      autorite: score(ligne.score_autorite),
      ecologie: score(ligne.score_ecologie),
      identite: score(ligne.score_identite),
    },
  };
}

/** Colonnes SQL correspondantes (écriture d'une idée ou d'un instantané). */
export function colonnesDepuisChamps(champs: ChampsIdee) {
  return {
    position: champs.position,
    theme: champs.theme,
    conviction: champs.conviction,
    arguments_pour: champs.arguments_pour,
    arguments_contre: champs.arguments_contre,
    source: champs.source,
    score_economique: champs.scores.economique,
    score_societal: champs.scores.societal,
    score_autorite: champs.scores.autorite,
    score_ecologie: champs.scores.ecologie,
    score_identite: champs.scores.identite,
  };
}

export function champsIdentiques(a: ChampsIdee, b: ChampsIdee): boolean {
  return (
    a.position === b.position &&
    a.theme === b.theme &&
    a.conviction === b.conviction &&
    a.arguments_pour === b.arguments_pour &&
    a.arguments_contre === b.arguments_contre &&
    a.source === b.source &&
    AXES.every((axe) => a.scores[axe.id] === b.scores[axe.id])
  );
}
