// Types et constantes du module Vinted (brouillons d'annonces à publier à la
// main dans l'appli Vinted). Module neutre : importé côté serveur et client.

export const STATUTS = ["brouillon", "pret", "publie", "vendu", "retire"] as const;
export type Statut = (typeof STATUTS)[number];

export const LIBELLE_STATUT: Record<Statut, string> = {
  brouillon: "Brouillon",
  pret: "Prêt",
  publie: "Publié",
  vendu: "Vendu",
  retire: "Retiré",
};

export function estStatut(valeur: unknown): valeur is Statut {
  return typeof valeur === "string" && (STATUTS as readonly string[]).includes(valeur);
}

// Limites de l'appli Vinted : titre 100 caractères, description 2000.
export const TITRE_MAX = 100;
export const DESCRIPTION_MAX = 2000;
export const PHOTOS_MAX = 20;

// Valeurs proposées à titre de suggestion (champs texte libre : la
// nomenclature complète de Vinted n'est pas importée).
export const ETATS_VINTED = [
  "Neuf avec étiquette",
  "Neuf sans étiquette",
  "Très bon état",
  "Bon état",
  "Satisfaisant",
] as const;

export const COLIS_VINTED = ["Petit", "Moyen", "Grand"] as const;

/** Champs éditables d'une annonce (hors statut, géré à part). */
export type ChampsAnnonce = {
  titre: string;
  description: string;
  hashtags: string[];
  categorie: string;
  marque: string;
  taille: string;
  etat: string;
  couleur: string;
  matiere: string;
  prix: number | null;
  colis: string;
};

export type ReglagesVinted = {
  signature: string;
  colis_defaut: string;
  hashtags_communs: string[];
  hashtags_par_categorie: Record<string, string[]>;
};
