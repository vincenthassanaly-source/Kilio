import { FILTRES_VIDES, type FiltresFilms, type StatutFilm } from "@/lib/films/types";

export type OngletFilms = "decouvrir" | "liste";

type EtatFilms = { onglet: OngletFilms; sousOnglet: StatutFilm; saisie: string; filtres: FiltresFilms };

// Mémoire de l'écran le temps d'une session : en revenant d'une fiche, on retrouve
// l'onglet, la recherche et les filtres. Portée du module : elle survit aux
// navigations côté client et repart de zéro au rechargement de l'app. Elle n'est
// lue que dans l'état initial de composants clients et écrite que depuis des
// effets ou des gestionnaires : le rendu serveur voit toujours les valeurs par défaut.
let etat: EtatFilms = { onglet: "decouvrir", sousOnglet: "a_voir", saisie: "", filtres: FILTRES_VIDES };

export function lireEtatFilms(): EtatFilms {
  return etat;
}

export function memoriserEtatFilms(partiel: Partial<EtatFilms>): void {
  etat = { ...etat, ...partiel };
}
