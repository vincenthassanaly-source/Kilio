// Types et règles pures du module Films (aucun accès réseau ni base ici : ce
// fichier est importable côté client comme côté serveur).

export const REGION = "FR";
export const LANGUE = "fr-FR";

export type StatutFilm = "a_voir" | "vu";
export const LIBELLE_STATUT: Record<StatutFilm, string> = { a_voir: "À voir", vu: "Vu" };

export function estStatutFilm(valeur: unknown): valeur is StatutFilm {
  return valeur === "a_voir" || valeur === "vu";
}

export type Fournisseur = { id: number; nom: string; logo: string | null };
export type Genre = { id: number; nom: string };

/** Film tel que listé : de quoi l'afficher et le filtrer. */
export type Film = {
  id: number;
  titre: string;
  annee: number | null;
  affiche: string | null;
  note: number | null;
  genreIds: number[];
  resume: string;
};

/** Où regarder un film en France (données JustWatch via TMDB). */
export type Disponibilite = {
  abonnement: Fournisseur[];
  location: Fournisseur[];
  achat: Fournisseur[];
  /** Page JustWatch du film, quand TMDB la fournit. */
  lien: string | null;
};

/** Ligne de résultat ou de liste : le film, sa durée et ses plateformes. */
export type FilmListe = Film & {
  dureeMin: number | null;
  /** `null` : disponibilité inconnue (TMDB n'a pas répondu), à ne pas confondre avec « nulle part ». */
  dispo: Disponibilite | null;
};

export type FicheFilm = FilmListe & {
  genres: string[];
  accroche: string;
  dateSortie: string | null;
};

export type FilmWatchlist = {
  id: number;
  titre: string;
  annee: number | null;
  affiche: string | null;
  statut: StatutFilm;
  ajouteLe: string;
  /** Plateformes d'abonnement à jour (`null` si TMDB est injoignable). */
  dispo: Disponibilite | null;
};

// --- Filtres de recherche ---

export type Decennie = "2020" | "2010" | "2000" | "1990" | "avant";
export const DECENNIES: readonly { value: Decennie; label: string; de: number; a: number }[] = [
  { value: "2020", label: "Années 2020", de: 2020, a: 2099 },
  { value: "2010", label: "Années 2010", de: 2010, a: 2019 },
  { value: "2000", label: "Années 2000", de: 2000, a: 2009 },
  { value: "1990", label: "Années 1990", de: 1990, a: 1999 },
  { value: "avant", label: "Avant 1990", de: 1888, a: 1989 },
];

export const NOTES_MIN: readonly number[] = [5, 6, 7, 8];
export const DUREES_MAX: readonly number[] = [90, 120, 150];

export type FiltresFilms = {
  requete: string;
  genre: number | null;
  decennie: Decennie | null;
  noteMin: number | null;
  dureeMax: number | null;
  /** Ne garder que les films en abonnement sur l'une des plateformes de l'utilisateur. */
  mesPlateformes: boolean;
};

export const FILTRES_VIDES: FiltresFilms = {
  requete: "",
  genre: null,
  decennie: null,
  noteMin: null,
  dureeMax: null,
  mesPlateformes: false,
};

const REQUETE_MAX = 100;

export function nombreFiltresActifs(filtres: FiltresFilms): number {
  return [filtres.genre, filtres.decennie, filtres.noteMin, filtres.dureeMax].filter((v) => v !== null).length;
}

export function estDecennie(valeur: unknown): valeur is Decennie {
  return DECENNIES.some((d) => d.value === valeur);
}

/** Valide des filtres venus du client (non fiables) et les ramène à des valeurs connues. */
export function nettoyerFiltres(brut: unknown): FiltresFilms {
  const f = (typeof brut === "object" && brut !== null ? brut : {}) as Record<string, unknown>;
  const entierPositif = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 && v < 1_000_000 ? v : null);
  const dans = (v: unknown, valeurs: readonly number[]) => (typeof v === "number" && valeurs.includes(v) ? v : null);
  return {
    requete: typeof f.requete === "string" ? f.requete.trim().slice(0, REQUETE_MAX) : "",
    genre: entierPositif(f.genre),
    decennie: estDecennie(f.decennie) ? f.decennie : null,
    noteMin: dans(f.noteMin, NOTES_MIN),
    dureeMax: dans(f.dureeMax, DUREES_MAX),
    mesPlateformes: f.mesPlateformes === true,
  };
}

/** Un film passe-t-il les filtres de contenu ? (utilisé après une recherche par titre,
 * que TMDB ne sait pas filtrer lui-même). Une donnée absente ne disqualifie pas… sauf
 * pour la note et la durée, où « inconnu » ne prouve rien : le film est écarté. */
export function passeFiltres(film: FilmListe, filtres: FiltresFilms): boolean {
  if (filtres.genre !== null && !film.genreIds.includes(filtres.genre)) return false;
  if (filtres.decennie !== null) {
    const d = DECENNIES.find((x) => x.value === filtres.decennie);
    if (!d || film.annee === null || film.annee < d.de || film.annee > d.a) return false;
  }
  if (filtres.noteMin !== null && (film.note === null || film.note < filtres.noteMin)) return false;
  if (filtres.dureeMax !== null && (film.dureeMin === null || film.dureeMin > filtres.dureeMax)) return false;
  return true;
}

// --- Plateformes ---

/** Plateformes d'abonnement d'un film, celles de l'utilisateur d'abord. */
export function abonnementsTries(dispo: Disponibilite | null, mesIds: ReadonlySet<number>): Fournisseur[] {
  if (!dispo) return [];
  return [...dispo.abonnement].sort((a, b) => Number(mesIds.has(b.id)) - Number(mesIds.has(a.id)));
}

/** Le film est-il en abonnement sur au moins une plateforme de l'utilisateur ? */
export function surMesPlateformes(dispo: Disponibilite | null, mesIds: ReadonlySet<number>): boolean {
  return !!dispo && dispo.abonnement.some((f) => mesIds.has(f.id));
}

// --- Affichage ---

const BASE_IMAGES = "https://image.tmdb.org/t/p";

export function urlAffiche(chemin: string | null, largeur: "w185" | "w342" = "w185"): string | null {
  return chemin && chemin.startsWith("/") ? `${BASE_IMAGES}/${largeur}${chemin}` : null;
}

export function urlLogo(chemin: string | null): string | null {
  return chemin && chemin.startsWith("/") ? `${BASE_IMAGES}/w92${chemin}` : null;
}

/** 112 min → « 1 h 52 » ; 45 min → « 45 min ». */
export function formaterDuree(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** 7.43 → « 7,4 » (virgule française). */
export function formaterNote(note: number | null): string | null {
  return note === null || note <= 0 ? null : note.toFixed(1).replace(".", ",");
}

/** Ligne de méta d'un film : « 2019 · 1 h 52 · 7,4/10 ». */
export function metaFilm(film: Pick<FilmListe, "annee" | "dureeMin" | "note">): string {
  return [film.annee, formaterDuree(film.dureeMin), film.note !== null && film.note > 0 ? `${formaterNote(film.note)}/10` : null]
    .filter((v) => v !== null && v !== "")
    .join(" · ");
}

export function anneeDepuisDate(date: unknown): number | null {
  if (typeof date !== "string") return null;
  const m = /^(\d{4})-/.exec(date);
  return m ? Number(m[1]) : null;
}
