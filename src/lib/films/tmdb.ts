// Client TMDB, côté serveur uniquement (la clé ne doit jamais atteindre le
// navigateur). Les lectures stables passent par `"use cache"` : la fiche et la
// disponibilité d'un film vivent ~12 h (les catalogues de streaming bougent peu
// dans la journée), les listes de genres et de fournisseurs plusieurs jours.
import { cacheLife } from "next/cache";
import {
  parseFiche,
  parseGenres,
  parseListeFournisseurs,
  parsePageFilms,
  type PageFilms,
} from "./parse";
import { DECENNIES, LANGUE, REGION, type FiltresFilms, type FicheFilm, type Fournisseur, type Genre } from "./types";

const BASE = "https://api.themoviedb.org/3";
const DELAI_MS = 6000;

export type CodeErreurTmdb = "cle_manquante" | "cle_refusee" | "introuvable" | "indisponible";

export class ErreurTmdb extends Error {
  constructor(
    readonly code: CodeErreurTmdb,
    message: string
  ) {
    super(message);
  }
}

export const MESSAGES_TMDB: Record<CodeErreurTmdb, string> = {
  cle_manquante: "Le module Films n'est pas configuré : la clé TMDB_API_KEY est absente.",
  cle_refusee: "TMDB a refusé la clé TMDB_API_KEY. Vérifie qu'elle est valide.",
  introuvable: "Film introuvable sur TMDB.",
  indisponible: "TMDB ne répond pas pour le moment. Réessaie dans un instant.",
};

/** Une clé « v3 » fait 32 caractères hexadécimaux (paramètre `api_key`) ; le
 * « jeton d'accès en lecture » v4 est un JWT bien plus long (en-tête Bearer). */
function authentification(): { headers: Record<string, string>; cle: string | null } {
  const cle = process.env.TMDB_API_KEY?.trim();
  if (!cle) throw new ErreurTmdb("cle_manquante", MESSAGES_TMDB.cle_manquante);
  return cle.length > 40 ? { headers: { Authorization: `Bearer ${cle}` }, cle: null } : { headers: {}, cle };
}

async function tmdb(chemin: string, params: Record<string, string | number | undefined> = {}): Promise<unknown> {
  const { headers, cle } = authentification();
  const url = new URL(`${BASE}${chemin}`);
  url.searchParams.set("language", LANGUE);
  for (const [nom, valeur] of Object.entries(params)) {
    if (valeur !== undefined && valeur !== "") url.searchParams.set(nom, String(valeur));
  }
  if (cle) url.searchParams.set("api_key", cle);

  let reponse: Response;
  try {
    reponse = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(DELAI_MS) });
  } catch {
    throw new ErreurTmdb("indisponible", MESSAGES_TMDB.indisponible);
  }
  if (reponse.status === 401) throw new ErreurTmdb("cle_refusee", MESSAGES_TMDB.cle_refusee);
  if (reponse.status === 404) throw new ErreurTmdb("introuvable", MESSAGES_TMDB.introuvable);
  if (!reponse.ok) throw new ErreurTmdb("indisponible", MESSAGES_TMDB.indisponible);
  try {
    return await reponse.json();
  } catch {
    throw new ErreurTmdb("indisponible", MESSAGES_TMDB.indisponible);
  }
}

// --- Lectures en cache ---

export async function genresEnCache(): Promise<Genre[]> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 7 * 86400, expire: 30 * 86400 });
  return parseGenres(await tmdb("/genre/movie/list"));
}

export async function fournisseursEnCache(): Promise<Fournisseur[]> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86400, expire: 7 * 86400 });
  return parseListeFournisseurs(await tmdb("/watch/providers/movie", { watch_region: REGION }));
}

/** Fiche complète d'un film avec ses plateformes françaises, en un seul appel. */
export async function ficheEnCache(id: number): Promise<FicheFilm | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 12 * 3600, expire: 24 * 3600 });
  try {
    return parseFiche(await tmdb(`/movie/${id}`, { append_to_response: "watch/providers" }));
  } catch (err) {
    if (err instanceof ErreurTmdb && err.code === "introuvable") return null;
    throw err;
  }
}

export async function rechercherEnCache(requete: string, page: number): Promise<PageFilms> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 3600, expire: 12 * 3600 });
  return parsePageFilms(await tmdb("/search/movie", { query: requete, page, include_adult: "false" }));
}

/** Films que TMDB recommande à partir d'un film (page 1). Un film inconnu n'a simplement aucune recommandation. */
export async function recommandationsEnCache(id: number): Promise<PageFilms> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 12 * 3600, expire: 24 * 3600 });
  try {
    return parsePageFilms(await tmdb(`/movie/${id}/recommendations`, { page: 1 }));
  } catch (err) {
    if (err instanceof ErreurTmdb && err.code === "introuvable") return { films: [], page: 1, totalPages: 1 };
    throw err;
  }
}

/** Critères de `/discover/movie` sérialisés en chaîne : la clé de cache d'une fonction `"use cache"`. */
export function criteresDecouverte(filtres: FiltresFilms, fournisseurIds: readonly number[]): string {
  const p = new URLSearchParams();
  p.set("sort_by", "popularity.desc");
  p.set("include_adult", "false");
  // Sans ce plancher, la liste se remplit de films à 10/10 notés par deux personnes.
  p.set("vote_count.gte", "150");
  if (filtres.genre !== null) p.set("with_genres", String(filtres.genre));
  const decennie = DECENNIES.find((d) => d.value === filtres.decennie);
  if (decennie) {
    p.set("primary_release_date.gte", `${decennie.de}-01-01`);
    p.set("primary_release_date.lte", `${Math.min(decennie.a, 2099)}-12-31`);
  }
  if (filtres.noteMin !== null) p.set("vote_average.gte", String(filtres.noteMin));
  if (filtres.dureeMax !== null) p.set("with_runtime.lte", String(filtres.dureeMax));
  if (fournisseurIds.length > 0) {
    p.set("watch_region", REGION);
    p.set("with_watch_monetization_types", "flatrate");
    p.set("with_watch_providers", fournisseurIds.join("|"));
  }
  return p.toString();
}

export async function decouvrirEnCache(criteres: string, page: number): Promise<PageFilms> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 3600, expire: 12 * 3600 });
  const params = Object.fromEntries(new URLSearchParams(criteres));
  return parsePageFilms(await tmdb("/discover/movie", { ...params, page }));
}
