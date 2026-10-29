// Tri du vrac par Gemini : consigne, schéma de réponse, et lecture
// défensive de la réponse. Module neutre (ni "use server" ni "use client") :
// utilisé par l'action serveur et par l'aperçu côté client.
import { normalizeSearch } from "@/lib/normalize";

/** Nombre de documents analysés par clic sur « Trier ». */
export const TAILLE_LOT_TRI = 10;
/** Au-delà, le fichier est trop lourd pour être envoyé à Gemini (requête plafonnée à ~20 Mo en base64). */
export const TAILLE_MAX_ANALYSE_OCTETS = 14 * 1024 * 1024;
/** Un document peut avoir plusieurs fichiers (recto/verso) : on n'en lit que les premiers. */
export const FICHIERS_MAX_ANALYSE = 3;
export const NOM_MAX = 100;
export const CATEGORIE_MAX = 40;

/**
 * Catégories d'origine (avant la table documents_categories). Sert de repli
 * tant que scripts/migration-documents-vrac-2026-10-29.sql n'est pas appliquée :
 * l'app se comporte alors comme avant, sans planter.
 */
export const CATEGORIES_PAR_DEFAUT = ["Identité", "Véhicule", "Logement", "Santé", "Assurance", "Autre"] as const;

export type PropositionTri = {
  /** Nom proposé (titre descriptif), jamais vide. */
  nom: string;
  /** Catégorie proposée, ou null si rien ne convient et que « Autre » n'existe pas. */
  categorie: string | null;
  /** Catégorie absente de la liste actuelle : créée seulement à l'application. */
  nouvelleCategorie: boolean;
};

export const SCHEMA_TRI = {
  type: "OBJECT",
  properties: {
    nom: { type: "STRING" },
    categorie: { type: "STRING" },
  },
  required: ["nom", "categorie"],
};

export function nettoyerTexte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur.replace(/\s+/g, " ").trim() : "";
}

/**
 * Doublon repéré pendant le tri : le même fichier (octet pour octet, certain)
 * ou un titre identique à celui d'un document existant (probable).
 */
export type DoublonDetecte = { type: "fichier" | "titre"; documentId: string; nom: string };

/** Clé de comparaison de deux titres : casse, accents et ponctuation ignorés. */
export function cleTitre(nom: string): string {
  return normalizeSearch(nom).replace(/[^a-z0-9]+/g, " ").trim();
}

/** Premier document de `existants` portant le même titre que `nom`, ou null. */
export function trouverDoublonParTitre(
  nom: string,
  existants: readonly { id: string; nom: string }[]
): DoublonDetecte | null {
  const cle = cleTitre(nom);
  if (!cle) return null;
  const trouve = existants.find((document) => cleTitre(document.nom) === cle);
  return trouve ? { type: "titre", documentId: trouve.id, nom: trouve.nom } : null;
}

/** Catégorie de la liste équivalente à `nom` (casse et accents ignorés), ou null. */
export function trouverCategorie(nom: string, categories: readonly string[]): string | null {
  const cle = normalizeSearch(nom);
  if (!cle) return null;
  return categories.find((c) => normalizeSearch(c) === cle) ?? null;
}

/** Nom de départ d'un fichier partagé : « Facture_EDF-mars.pdf » → « Facture EDF mars ». */
export function nomDepuisFichier(nomFichier: string): string {
  const base = nomFichier
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (base || "Document").slice(0, NOM_MAX);
}

export function construirePromptTri(categories: readonly string[], nomActuel: string): string {
  return [
    "Tu classes un document personnel (scan, photo ou PDF) pour une application de gestion de documents, en français.",
    `Nom actuel du fichier : « ${nomActuel} » (souvent peu parlant : ne t'y fie pas si le contenu dit autre chose).`,
    "",
    "Réponds avec :",
    "- nom : un titre descriptif court (60 caractères maximum) qui dit ce qu'est le document, en général type + émetteur + période ou personne si utile. Exemples : « Facture EDF - mars 2026 », « Carte d'identité - Vincent », « Attestation mutuelle 2026 ». Pas d'extension, pas de guillemets, pas de numéro de dossier ni de référence interminable.",
    `- categorie : UNE catégorie. Choisis-la telle quelle dans cette liste si l'une correspond franchement au document : ${categories.map((c) => `« ${c} »`).join(", ")}.`,
    "  Si aucune ne correspond franchement, CRÉE une nouvelle catégorie : un ou deux mots, large, commençant par une majuscule, qui peut regrouper plusieurs types de documents (ex. « Travail », « Banque », « Impôts », « Scolarité », « Voyage »). Ce n'est pas un type de document : écris « Travail », pas « Fiche de paie ». Une catégorie qui a le même sens qu'une catégorie de la liste doit réutiliser celle de la liste, pas en créer une voisine.",
    "  « Autre » est un dernier recours : seulement si le document est illisible ou impossible à classer. Ne l'utilise jamais simplement parce qu'aucune catégorie de la liste ne convient exactement : crée alors une catégorie.",
  ].join("\n");
}

/**
 * Lit la réponse brute de Gemini sans lui faire confiance : nom vide → nom
 * actuel, catégorie reconnue (casse/accents ignorés) → nom exact de la liste,
 * catégorie inconnue → proposée comme nouvelle, catégorie vide → « Autre ».
 */
export function lireReponseTri(brut: unknown, categories: readonly string[], nomActuel: string): PropositionTri {
  const objet = typeof brut === "object" && brut !== null ? (brut as Record<string, unknown>) : {};
  const nom = nettoyerTexte(objet.nom).replace(/^[«"“]\s*|\s*[»"”]$/g, "").slice(0, NOM_MAX).trim() || nomActuel;

  const categorieBrute = nettoyerTexte(objet.categorie).slice(0, CATEGORIE_MAX).trim();
  const existante = trouverCategorie(categorieBrute, categories);
  if (existante) return { nom, categorie: existante, nouvelleCategorie: false };
  if (categorieBrute) return { nom, categorie: categorieBrute, nouvelleCategorie: true };
  return { nom, categorie: trouverCategorie("Autre", categories), nouvelleCategorie: false };
}
