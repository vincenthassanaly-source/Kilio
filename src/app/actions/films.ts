"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { ficheVersListe } from "@/lib/films/parse";
import {
  ErreurTmdb,
  MESSAGES_TMDB,
  criteresDecouverte,
  decouvrirEnCache,
  ficheEnCache,
  fournisseursEnCache,
  genresEnCache,
  rechercherEnCache,
} from "@/lib/films/tmdb";
import {
  estStatutFilm,
  nettoyerFiltres,
  passeFiltres,
  surMesPlateformes,
  type FicheFilm,
  type Film,
  type FilmListe,
  type FilmWatchlist,
  type Fournisseur,
  type Genre,
  type StatutFilm,
} from "@/lib/films/types";
import {
  TITRES_SECTIONS,
  composerSections,
  criteresSuggestion,
  type IdSection,
  type SectionSuggestion,
} from "@/lib/films/suggestions";
import { createAdminClient } from "@/lib/supabase/admin";

const TITRE_MAX = 300;
const PAGE_MAX = 500;

export type ResultatRecherche = {
  films: FilmListe[];
  page: number;
  totalPages: number;
  /** Le filtre « sur mes plateformes » a bien été appliqué (il l'est seulement si des plateformes sont choisies). */
  plateformesAppliquees: boolean;
};

export type FicheEtStatut = { fiche: FicheFilm; statut: StatutFilm | null; mesPlateformes: number[] };

export type FilmAAjouter = { id: number; titre: string; annee: number | null; affiche: string | null };

function messageErreur(err: unknown): string {
  if (err instanceof ErreurTmdb) return err.message;
  return MESSAGES_TMDB.indisponible;
}

// PGRST205 / 42P01 : la table n'existe pas (migration pas encore appliquée).
function messageBase(error: { code?: string; message: string }): string {
  if (error.code === "PGRST205" || error.code === "42P01") {
    return "Les tables du module Films n'existent pas encore : la migration scripts/migration-films-2026-11-27.sql reste à appliquer.";
  }
  return "La base de données ne répond pas. Réessaie dans un instant.";
}

function revalider(id?: number) {
  revalidatePath("/films");
  if (id !== undefined) revalidatePath(`/films/${id}`);
}

function idValide(valeur: unknown): valeur is number {
  return typeof valeur === "number" && Number.isInteger(valeur) && valeur > 0 && valeur < 1_000_000_000;
}

// --- Plateformes de l'utilisateur ---

async function lirePlateformes(): Promise<{ ok: true; data: Fournisseur[] } | { ok: false; error: string }> {
  const { data, error } = await createAdminClient()
    .from("films_plateformes")
    .select("fournisseur_id, nom, logo")
    .order("nom");
  if (error) return fail(messageBase(error));
  return ok(data.map((l) => ({ id: l.fournisseur_id, nom: l.nom, logo: l.logo })));
}

export async function getMesPlateformes(): Promise<ActionResult<Fournisseur[]>> {
  return lirePlateformes();
}

export async function definirPlateforme(fournisseur: Fournisseur, actif: boolean): Promise<ActionResult> {
  if (!idValide(fournisseur?.id) || typeof fournisseur.nom !== "string" || !fournisseur.nom.trim()) {
    return fail("Plateforme invalide.");
  }
  const supabase = createAdminClient();
  const { error } = actif
    ? await supabase.from("films_plateformes").upsert({
        fournisseur_id: fournisseur.id,
        nom: fournisseur.nom.trim().slice(0, 100),
        logo: typeof fournisseur.logo === "string" && fournisseur.logo.startsWith("/") ? fournisseur.logo.slice(0, 200) : null,
      })
    : await supabase.from("films_plateformes").delete().eq("fournisseur_id", fournisseur.id);
  if (error) return fail(messageBase(error));
  revalider();
  return ok();
}

/** Toutes les plateformes de streaming présentes en France, les plus populaires d'abord. */
export async function getFournisseursFr(): Promise<ActionResult<Fournisseur[]>> {
  try {
    return ok(await fournisseursEnCache());
  } catch (err) {
    return fail(messageErreur(err));
  }
}

export async function getGenres(): Promise<ActionResult<Genre[]>> {
  try {
    return ok(await genresEnCache());
  } catch (err) {
    return fail(messageErreur(err));
  }
}

// --- Recherche ---

/** Complète un film de liste avec sa durée et ses plateformes (un appel TMDB mis en cache par film). */
async function enrichir(films: Film[]): Promise<FilmListe[]> {
  const fiches = await Promise.allSettled(films.map((f) => ficheEnCache(f.id)));
  // Clé absente ou refusée : inutile de masquer, on remonte l'erreur à l'écran.
  for (const r of fiches) {
    if (r.status === "rejected" && r.reason instanceof ErreurTmdb && (r.reason.code === "cle_manquante" || r.reason.code === "cle_refusee")) {
      throw r.reason;
    }
  }
  return films.map((film, i) => {
    const r = fiches[i];
    const fiche = r.status === "fulfilled" ? r.value : null;
    return { ...film, dureeMin: fiche?.dureeMin ?? null, dispo: fiche?.dispo ?? null };
  });
}

export async function chercherFilms(filtresBruts: unknown, pageBrute: number): Promise<ActionResult<ResultatRecherche>> {
  const filtres = nettoyerFiltres(filtresBruts);
  const page = idValide(pageBrute) ? Math.min(pageBrute, PAGE_MAX) : 1;

  const plateformes = await lirePlateformes();
  if (!plateformes.ok) return fail(plateformes.error);
  const mesIds = plateformes.data.map((p) => p.id);
  const appliquer = filtres.mesPlateformes && mesIds.length > 0;

  try {
    const resultat = filtres.requete
      ? await rechercherEnCache(filtres.requete, page)
      : await decouvrirEnCache(criteresDecouverte(filtres, appliquer ? mesIds : []), page);

    let films = await enrichir(resultat.films);
    if (filtres.requete) {
      // TMDB ne filtre pas une recherche par titre : on applique les filtres ici.
      films = films.filter((f) => passeFiltres(f, filtres));
      if (appliquer) {
        const ensemble = new Set(mesIds);
        films = films.filter((f) => surMesPlateformes(f.dispo, ensemble));
      }
    }
    return ok({ films, page: resultat.page, totalPages: resultat.totalPages, plateformesAppliquees: appliquer });
  } catch (err) {
    return fail(messageErreur(err));
  }
}

// --- Suggestions du moment ---

export type ResultatSuggestions = {
  sections: SectionSuggestion[];
  /** Faux tant qu'aucune plateforme n'est choisie : il n'y a alors rien à suggérer « sur tes plateformes ». */
  plateformesChoisies: boolean;
};

const ORDRE_SECTIONS: readonly IdSection[] = ["populaires", "recents"];

/** Films en abonnement sur les plateformes de l'utilisateur : les plus populaires, puis les sorties de
 * l'année. Les films déjà vus ne sont jamais proposés, et un film n'apparaît que dans une seule rangée. */
export async function getSuggestions(): Promise<ActionResult<ResultatSuggestions>> {
  const plateformes = await lirePlateformes();
  if (!plateformes.ok) return fail(plateformes.error);
  const ids = plateformes.data.map((p) => p.id);
  if (ids.length === 0) return ok({ sections: [], plateformesChoisies: false });

  const vus = await createAdminClient().from("films_watchlist").select("tmdb_id").eq("statut", "vu");
  if (vus.error) return fail(messageBase(vus.error));
  const exclus = new Set(vus.data.map((l) => l.tmdb_id));

  try {
    const maintenant = new Date();
    const pages = await Promise.all(ORDRE_SECTIONS.map((id) => decouvrirEnCache(criteresSuggestion(id, ids, maintenant), 1)));
    const sections = composerSections(
      ORDRE_SECTIONS.map((id, i) => ({ id, films: pages[i].films })),
      exclus
    );
    // On n'enrichit (un appel TMDB en cache par film) qu'après le tri et la troncature.
    const enrichies = await Promise.all(
      sections.map(async (s) => ({ id: s.id, titre: TITRES_SECTIONS[s.id], films: await enrichir(s.films) }))
    );
    return ok({ sections: enrichies, plateformesChoisies: true });
  } catch (err) {
    return fail(messageErreur(err));
  }
}

// --- Fiche ---

export async function getFiche(id: number): Promise<ActionResult<FicheEtStatut>> {
  if (!idValide(id)) return fail(MESSAGES_TMDB.introuvable);
  const supabase = createAdminClient();
  const [ligne, plateformes] = await Promise.all([
    supabase.from("films_watchlist").select("statut").eq("tmdb_id", id).maybeSingle(),
    lirePlateformes(),
  ]);
  if (ligne.error) return fail(messageBase(ligne.error));
  if (!plateformes.ok) return fail(plateformes.error);

  try {
    const fiche = await ficheEnCache(id);
    if (!fiche) return fail(MESSAGES_TMDB.introuvable);
    const statut = ligne.data && estStatutFilm(ligne.data.statut) ? ligne.data.statut : null;
    return ok({ fiche, statut, mesPlateformes: plateformes.data.map((p) => p.id) });
  } catch (err) {
    return fail(messageErreur(err));
  }
}

// --- Liste « à voir / vus » ---

export async function getWatchlist(): Promise<ActionResult<{ films: FilmWatchlist[]; mesPlateformes: number[] }>> {
  const supabase = createAdminClient();
  const [lignes, plateformes] = await Promise.all([
    supabase.from("films_watchlist").select("*").order("created_at", { ascending: false }),
    lirePlateformes(),
  ]);
  if (lignes.error) return fail(messageBase(lignes.error));
  if (!plateformes.ok) return fail(plateformes.error);

  // Les plateformes ne servent que pour les films encore à voir ; TMDB en panne
  // ne doit jamais empêcher d'afficher sa propre liste.
  const fiches = await Promise.allSettled(
    lignes.data.map((l) => (l.statut === "a_voir" ? ficheEnCache(l.tmdb_id) : Promise.resolve(null)))
  );
  const films: FilmWatchlist[] = lignes.data.map((l, i) => {
    const r = fiches[i];
    const fiche = r.status === "fulfilled" ? r.value : null;
    return {
      id: l.tmdb_id,
      titre: l.titre,
      annee: l.annee,
      affiche: l.affiche,
      statut: estStatutFilm(l.statut) ? l.statut : "a_voir",
      ajouteLe: l.created_at,
      dispo: fiche ? ficheVersListe(fiche).dispo : null,
    };
  });
  return ok({ films, mesPlateformes: plateformes.data.map((p) => p.id) });
}

/** Statut de chaque film de la liste, par id TMDB : sert à marquer les résultats déjà ajoutés. */
export async function getStatutsFilms(): Promise<ActionResult<Record<number, StatutFilm>>> {
  const { data, error } = await createAdminClient().from("films_watchlist").select("tmdb_id, statut");
  if (error) return fail(messageBase(error));
  const statuts: Record<number, StatutFilm> = {};
  for (const l of data) statuts[l.tmdb_id] = estStatutFilm(l.statut) ? l.statut : "a_voir";
  return ok(statuts);
}

export async function ajouterALaListe(film: FilmAAjouter): Promise<ActionResult> {
  const titre = typeof film?.titre === "string" ? film.titre.trim().slice(0, TITRE_MAX) : "";
  if (!idValide(film?.id) || !titre) return fail("Film invalide.");
  const annee = typeof film.annee === "number" && Number.isInteger(film.annee) && film.annee > 1800 && film.annee < 2200 ? film.annee : null;
  const affiche = typeof film.affiche === "string" && film.affiche.startsWith("/") ? film.affiche.slice(0, 200) : null;

  // Un film déjà dans la liste garde son statut : on ne remet pas un film « vu » à « à voir ».
  const { error } = await createAdminClient()
    .from("films_watchlist")
    .upsert({ tmdb_id: film.id, titre, annee, affiche }, { onConflict: "tmdb_id", ignoreDuplicates: true });
  if (error) return fail(messageBase(error));
  revalider(film.id);
  return ok();
}

export async function changerStatutFilm(id: number, statut: StatutFilm): Promise<ActionResult> {
  if (!idValide(id) || !estStatutFilm(statut)) return fail("Film invalide.");
  const { error } = await createAdminClient()
    .from("films_watchlist")
    .update({ statut, vu_le: statut === "vu" ? new Date().toISOString() : null })
    .eq("tmdb_id", id);
  if (error) return fail(messageBase(error));
  revalider(id);
  return ok();
}

export async function retirerDeLaListe(id: number): Promise<ActionResult> {
  if (!idValide(id)) return fail("Film invalide.");
  const { error } = await createAdminClient().from("films_watchlist").delete().eq("tmdb_id", id);
  if (error) return fail(messageBase(error));
  revalider(id);
  return ok();
}

/** Remet un film retiré dans la liste avec son statut d'origine (action « Annuler » du toast). */
export async function restaurerDansLaListe(film: FilmAAjouter, statut: StatutFilm): Promise<ActionResult> {
  const ajout = await ajouterALaListe(film);
  if (!ajout.ok) return ajout;
  return statut === "vu" ? changerStatutFilm(film.id, "vu") : ok();
}
