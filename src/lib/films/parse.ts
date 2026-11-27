// Lecture tolérante des réponses TMDB : l'API est externe, aucune forme n'est
// garantie. Chaque parseur renvoie `null` (ou une liste vide) plutôt que de lever.
import {
  REGION,
  anneeDepuisDate,
  type Disponibilite,
  type FicheFilm,
  type Film,
  type FilmListe,
  type Fournisseur,
  type Genre,
} from "./types";

type Objet = Record<string, unknown>;

function objet(valeur: unknown): Objet | null {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur) ? (valeur as Objet) : null;
}

function tableau(valeur: unknown): unknown[] {
  return Array.isArray(valeur) ? valeur : [];
}

function entier(valeur: unknown): number | null {
  return typeof valeur === "number" && Number.isInteger(valeur) && valeur > 0 ? valeur : null;
}

function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur.trim() : "";
}

function cheminImage(valeur: unknown): string | null {
  return typeof valeur === "string" && valeur.startsWith("/") ? valeur : null;
}

export function parseFilm(brut: unknown): Film | null {
  const o = objet(brut);
  if (!o) return null;
  const id = entier(o.id);
  const titre = texte(o.title) || texte(o.original_title);
  if (id === null || !titre) return null;
  const note = typeof o.vote_average === "number" && o.vote_average > 0 ? o.vote_average : null;
  return {
    id,
    titre,
    annee: anneeDepuisDate(o.release_date),
    affiche: cheminImage(o.poster_path),
    note,
    genreIds: tableau(o.genre_ids).flatMap((g) => {
      const n = entier(g);
      return n === null ? [] : [n];
    }),
    resume: texte(o.overview),
  };
}

function parseFournisseur(brut: unknown): Fournisseur | null {
  const o = objet(brut);
  if (!o) return null;
  const id = entier(o.provider_id);
  const nom = texte(o.provider_name);
  return id === null || !nom ? null : { id, nom, logo: cheminImage(o.logo_path) };
}

function parseFournisseurs(brut: unknown): Fournisseur[] {
  const vus = new Set<number>();
  return tableau(brut).flatMap((f) => {
    const p = parseFournisseur(f);
    if (!p || vus.has(p.id)) return [];
    vus.add(p.id);
    return [p];
  });
}

/** `watch/providers` d'un film : `{ results: { FR: { link, flatrate, rent, buy } } }`. */
export function parseDisponibilite(brut: unknown): Disponibilite {
  const regions = objet(objet(brut)?.results);
  const fr = objet(regions?.[REGION]);
  return {
    abonnement: parseFournisseurs(fr?.flatrate),
    location: parseFournisseurs(fr?.rent),
    achat: parseFournisseurs(fr?.buy),
    lien: typeof fr?.link === "string" && fr.link.startsWith("https://") ? fr.link : null,
  };
}

/** Résultat de `/movie/{id}?append_to_response=watch/providers` (fiche complète). */
export function parseFiche(brut: unknown): FicheFilm | null {
  const o = objet(brut);
  if (!o) return null;
  const base = parseFilm({ ...o, genre_ids: tableau(o.genres).map((g) => objet(g)?.id) });
  if (!base) return null;
  const duree = entier(o.runtime);
  return {
    ...base,
    dureeMin: duree,
    dispo: parseDisponibilite(objet(o["watch/providers"])),
    genres: tableau(o.genres).flatMap((g) => {
      const nom = texte(objet(g)?.name);
      return nom ? [nom] : [];
    }),
    accroche: texte(o.tagline),
    dateSortie: typeof o.release_date === "string" && o.release_date ? o.release_date : null,
  };
}

export function ficheVersListe(fiche: FicheFilm): FilmListe {
  const { genres: _genres, accroche: _accroche, dateSortie: _dateSortie, ...liste } = fiche;
  void _genres;
  void _accroche;
  void _dateSortie;
  return liste;
}

export function parseGenres(brut: unknown): Genre[] {
  return tableau(objet(brut)?.genres).flatMap((g) => {
    const o = objet(g);
    const id = entier(o?.id);
    const nom = texte(o?.name);
    return id === null || !nom ? [] : [{ id, nom }];
  });
}

/** Liste des fournisseurs FR (`/watch/providers/movie`), les plus populaires d'abord. */
export function parseListeFournisseurs(brut: unknown): Fournisseur[] {
  const lignes = tableau(objet(brut)?.results).flatMap((r) => {
    const f = parseFournisseur(r);
    if (!f) return [];
    const priorite = objet(objet(r)?.display_priorities)?.[REGION];
    return [{ f, priorite: typeof priorite === "number" ? priorite : 9999 }];
  });
  lignes.sort((a, b) => a.priorite - b.priorite || a.f.nom.localeCompare(b.f.nom, "fr"));
  return lignes.map((l) => l.f);
}

export type PageFilms = { films: Film[]; page: number; totalPages: number };

/** Réponse paginée de `/search/movie` ou `/discover/movie`. */
export function parsePageFilms(brut: unknown): PageFilms {
  const o = objet(brut);
  return {
    films: tableau(o?.results).flatMap((r) => {
      const f = parseFilm(r);
      return f ? [f] : [];
    }),
    page: entier(o?.page) ?? 1,
    // TMDB plafonne la pagination à 500 pages.
    totalPages: Math.min(entier(o?.total_pages) ?? 1, 500),
  };
}
