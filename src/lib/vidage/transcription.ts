// Transcription d'une feuille manuscrite en texte (API Gemini, à la demande).
// Logique pure : découpage de la feuille en tranches d'images, consigne et
// lecture de la réponse. Le rendu des images est dans apercu.ts (client) et
// l'appel dans actions/vidage.ts (serveur).
import type { Trait } from "./traits";

/** Hauteur logique d'une tranche d'image envoyée à Gemini. */
export const HAUTEUR_TRANCHE = 1400;
/** Recouvrement entre deux tranches : une ligne coupée au bord se lit en entier dans l'une des deux. */
export const CHEVAUCHEMENT = 100;
/** Au-delà, la feuille est tronquée (quota gratuit, taille de requête). */
export const MAX_TRANCHES = 8;
/** Même limite que la contrainte de la colonne `transcription`. */
export const LONGUEUR_MAX_TEXTE = 50_000;

// Marge sous le dernier trait : le dernier mot n'est jamais coupé.
const MARGE_BAS = 60;

/** Hauteur logique qui contient l'écriture (0 pour une feuille vide). */
export function hauteurUtile(traits: Trait[]): number {
  let maxY = 0;
  for (const { p } of traits) for (let i = 1; i < p.length; i += 3) maxY = Math.max(maxY, p[i]);
  return maxY === 0 ? 0 : maxY + MARGE_BAS;
}

/** Ordonnées (hautes) des tranches à rendre, de haut en bas, avec recouvrement. */
export function tranchesDeFeuille(traits: Trait[]): { tops: number[]; tronquee: boolean } {
  const pas = HAUTEUR_TRANCHE - CHEVAUCHEMENT;
  const utile = hauteurUtile(traits);
  const necessaires = Math.max(1, Math.ceil((utile - CHEVAUCHEMENT) / pas));
  const nombre = Math.min(MAX_TRANCHES, necessaires);
  return { tops: Array.from({ length: nombre }, (_, i) => i * pas), tronquee: necessaires > MAX_TRANCHES };
}

export const PROMPT_TRANSCRIPTION = [
  "Les images jointes sont les tranches successives, de haut en bas, d'une même feuille d'écriture manuscrite, en français.",
  "Les tranches se chevauchent légèrement : si le bas d'une tranche réapparaît en haut de la suivante, ne le recopie qu'une seule fois.",
  "Recopie fidèlement ce qui est écrit : garde les mots, la ponctuation, les retours à la ligne et le style de l'auteur. Ne réécris pas, ne corrige pas, ne résume pas, n'ajoute rien.",
  "Quand un mot ou un passage est incertain, écris [illisible] à sa place plutôt que de deviner. Pour un dessin ou un schéma, écris [dessin].",
  "Ignore les lignes d'écriture du fond de la feuille. S'il n'y a aucune écriture lisible, renvoie un texte vide.",
].join(" ");

export const SCHEMA_TRANSCRIPTION = {
  type: "OBJECT",
  properties: { texte: { type: "STRING" } },
  required: ["texte"],
};

/** Texte de la réponse de Gemini, nettoyé et borné ; null si elle n'a pas la forme attendue. */
export function lireTranscription(brut: unknown): string | null {
  if (typeof brut !== "object" || brut === null) return null;
  const { texte } = brut as { texte?: unknown };
  if (typeof texte !== "string") return null;
  return texte.trim().slice(0, LONGUEUR_MAX_TEXTE);
}
