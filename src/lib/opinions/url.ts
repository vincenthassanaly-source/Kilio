// État de l'écran Opinions porté par l'URL (`?onglet=partis&parti=…`) : au
// retour depuis une idée, un rechargement ou un lien partagé, on retrouve
// l'onglet, les filtres et le parti ouvert. Module neutre (aucun React).

import { estStatut, estTheme, type Statut, type Theme } from "./types";

export const ONGLETS_OPINIONS = ["idees", "partis", "profil"] as const;
export type OngletOpinions = (typeof ONGLETS_OPINIONS)[number];

export type EtatOpinions = {
  onglet: OngletOpinions;
  statut: "tous" | Statut;
  theme: "tous" | Theme;
  /** Identifiant du parti déplié (onglet Partis), ou null. */
  parti: string | null;
};

type LecteurParams = { get(nom: string): string | null };

function estOnglet(valeur: unknown): valeur is OngletOpinions {
  return typeof valeur === "string" && (ONGLETS_OPINIONS as readonly string[]).includes(valeur);
}

/** Lit l'état depuis les paramètres ; une valeur inconnue retombe sur le défaut. */
export function lireEtatOpinions(params: LecteurParams): EtatOpinions {
  const onglet = params.get("onglet");
  const statut = params.get("statut");
  const theme = params.get("theme");
  const parti = params.get("parti")?.trim();
  return {
    onglet: estOnglet(onglet) ? onglet : "idees",
    statut: estStatut(statut) ? statut : "tous",
    theme: estTheme(theme) ? theme : "tous",
    parti: parti ? parti : null,
  };
}

/**
 * Chaîne de requête (`?…`, ou vide) de l'état : les valeurs par défaut sont
 * omises, les filtres ne suivent que leur onglet (statut et thème sur Idées,
 * parti sur Partis) pour garder des URL courtes.
 */
export function ecrireEtatOpinions(etat: EtatOpinions): string {
  const params = new URLSearchParams();
  if (etat.onglet !== "idees") params.set("onglet", etat.onglet);
  if (etat.onglet === "idees") {
    if (etat.statut !== "tous") params.set("statut", etat.statut);
    if (etat.theme !== "tous") params.set("theme", etat.theme);
  }
  if (etat.onglet === "partis" && etat.parti) params.set("parti", etat.parti);
  const texte = params.toString();
  return texte ? `?${texte}` : "";
}

// Lien « retour » d'une idée : l'écran Opinions avec l'onglet et les filtres
// quittés (mémorisés pour la session de l'onglet du navigateur).
const CLE_RETOUR = "kilio:opinions:retour";

export function memoriserRetourOpinions(requete: string) {
  try {
    sessionStorage.setItem(CLE_RETOUR, requete);
  } catch {
    // Stockage indisponible (navigation privée) : le retour ira à /opinions.
  }
}

export function lienRetourOpinions(): string {
  try {
    const requete = sessionStorage.getItem(CLE_RETOUR) ?? "";
    return `/opinions${requete.startsWith("?") ? requete : ""}`;
  } catch {
    return "/opinions";
  }
}
