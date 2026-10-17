// Logique pure du « kit de publication » : normalisation des hashtags,
// assemblage de la description finale (texte + signature + hashtags) et
// vérification qu'une annonce est complète avant de la passer en « Prêt ».

import { DESCRIPTION_MAX, TITRE_MAX, type ChampsAnnonce, type ReglagesVinted } from "./types";

/** `"#Jean Levi's"` → `"#jeanlevis"` : minuscules, sans espaces ni ponctuation, préfixé de #. */
export function normaliserHashtag(brut: string): string | null {
  const mot = brut
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]/g, "");
  return mot ? `#${mot}` : null;
}

/** Découpe une saisie libre (« #a, b  #c ») en hashtags uniques, ordre conservé. */
export function parserHashtags(saisie: string): string[] {
  const vus = new Set<string>();
  const resultat: string[] = [];
  for (const morceau of saisie.split(/[\s,;]+/)) {
    const tag = normaliserHashtag(morceau);
    if (tag && !vus.has(tag)) {
      vus.add(tag);
      resultat.push(tag);
    }
  }
  return resultat;
}

/**
 * Hashtags à ajouter à une annonce : ceux de la catégorie (clé en minuscules,
 * sans accents) puis les communs, sans doublon avec ceux déjà présents.
 */
export function hashtagsSuggeres(
  categorie: string,
  deja: readonly string[],
  reglages: Pick<ReglagesVinted, "hashtags_communs" | "hashtags_par_categorie">
): string[] {
  const cle = categorie.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const deCategorie = cle ? (reglages.hashtags_par_categorie[cle] ?? []) : [];
  const vus = new Set(deja);
  const resultat: string[] = [];
  for (const tag of [...deCategorie, ...reglages.hashtags_communs]) {
    if (!vus.has(tag)) {
      vus.add(tag);
      resultat.push(tag);
    }
  }
  return resultat;
}

/** Description telle qu'elle doit être collée dans Vinted. */
export function descriptionFinale(
  annonce: Pick<ChampsAnnonce, "description" | "hashtags">,
  reglages: Pick<ReglagesVinted, "signature">
): string {
  const blocs = [annonce.description.trim(), reglages.signature.trim(), annonce.hashtags.join(" ")].filter(Boolean);
  return blocs.join("\n\n");
}

export type Manquant = "photos" | "titre" | "description" | "categorie" | "etat" | "prix" | "colis" | "taille";

const LIBELLE_MANQUANT: Record<Manquant, string> = {
  photos: "au moins une photo",
  titre: "un titre",
  description: "une description",
  categorie: "une catégorie",
  etat: "l'état",
  prix: "un prix",
  colis: "la taille de colis",
  taille: "la taille",
};

/** Champs obligatoires encore vides pour pouvoir publier. La taille n'est exigée que si la catégorie l'implique (non gérée : jamais bloquante). */
export function champsManquants(
  annonce: Pick<ChampsAnnonce, "titre" | "description" | "categorie" | "etat" | "prix" | "colis">,
  nbPhotos: number,
  reglages?: Pick<ReglagesVinted, "signature" | "colis_defaut">
): Manquant[] {
  const manquants: Manquant[] = [];
  if (nbPhotos < 1) manquants.push("photos");
  if (!annonce.titre.trim()) manquants.push("titre");
  if (!annonce.description.trim()) manquants.push("description");
  if (!annonce.categorie.trim()) manquants.push("categorie");
  if (!annonce.etat.trim()) manquants.push("etat");
  if (annonce.prix === null || annonce.prix <= 0) manquants.push("prix");
  if (!annonce.colis.trim() && !reglages?.colis_defaut.trim()) manquants.push("colis");
  return manquants;
}

export function messageManquants(manquants: readonly Manquant[]): string {
  return `Il manque : ${manquants.map((m) => LIBELLE_MANQUANT[m]).join(", ")}.`;
}

/** Longueurs vs limites Vinted, pour les compteurs et la validation. */
export function depasseLimites(annonce: Pick<ChampsAnnonce, "titre" | "description" | "hashtags">, signature: string) {
  return {
    titre: annonce.titre.length > TITRE_MAX,
    description: descriptionFinale(annonce, { signature }).length > DESCRIPTION_MAX,
  };
}

/** Prix saisi (« 12,5 ») → nombre à 2 décimales, null si vide ou invalide. */
export function parserPrix(saisie: string): number | null {
  const texte = saisie.trim().replace(",", ".");
  if (!texte) return null;
  const n = Number(texte);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}
