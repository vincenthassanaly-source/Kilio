// Suggestions du moment : règles pures (aucun réseau, aucune base), testables telles quelles.
import { REGION, type FilmListe } from "./types";

export type IdSection = "populaires" | "recents";

export const TITRES_SECTIONS: Record<IdSection, string> = {
  populaires: "Populaires sur tes plateformes",
  recents: "Sorties récentes sur tes plateformes",
};

/** Nombre de films par rangée : assez pour balayer, peu pour ne pas noyer l'écran. */
const TAILLE_SECTION = 12;

export type SectionSuggestion = { id: IdSection; titre: string; films: FilmListe[] };

/** Premier jour du mois, il y a douze mois (UTC) : les « sorties récentes » couvrent l'année écoulée. */
export function debutSortiesRecentes(maintenant: Date): string {
  const annee = maintenant.getUTCFullYear() - 1;
  const mois = String(maintenant.getUTCMonth() + 1).padStart(2, "0");
  return `${annee}-${mois}-01`;
}

/** Critères `/discover/movie` d'une rangée : films en abonnement sur l'une des plateformes de l'utilisateur.
 * Les identifiants sont triés pour que deux demandes équivalentes partagent la même entrée de cache. */
export function criteresSuggestion(id: IdSection, fournisseurIds: readonly number[], maintenant: Date): string {
  const p = new URLSearchParams();
  p.set("sort_by", "popularity.desc");
  p.set("include_adult", "false");
  // Plancher de votes : écarte les titres confidentiels que quelques notes suffisent à faire monter.
  p.set("vote_count.gte", id === "recents" ? "40" : "150");
  p.set("watch_region", REGION);
  p.set("with_watch_monetization_types", "flatrate");
  p.set("with_watch_providers", [...fournisseurIds].sort((a, b) => a - b).join("|"));
  if (id === "recents") p.set("primary_release_date.gte", debutSortiesRecentes(maintenant));
  return p.toString();
}

/** Candidats « dans le même esprit » : sans le film de la fiche, sans les films exclus (vus), sans doublon,
 * tronqués à `taille`. Le tri par disponibilité se fait ensuite, quand les plateformes sont connues. */
export function composerSimilaires<T extends { id: number }>(
  films: readonly T[],
  idFilm: number,
  exclus: ReadonlySet<number>,
  taille: number
): T[] {
  const dejaVus = new Set<number>([idFilm]);
  const resultat: T[] = [];
  for (const film of films) {
    if (resultat.length >= taille) break;
    if (exclus.has(film.id) || dejaVus.has(film.id)) continue;
    dejaVus.add(film.id);
    resultat.push(film);
  }
  return resultat;
}

/** Retire les films déjà exclus (vus) et ceux déjà proposés dans une rangée précédente, tronque,
 * puis écarte les rangées devenues vides. L'ordre des rangées est conservé. */
export function composerSections<T extends { id: number }>(
  sections: readonly { id: IdSection; films: readonly T[] }[],
  exclus: ReadonlySet<number>,
  taille: number = TAILLE_SECTION
): { id: IdSection; films: T[] }[] {
  const dejaVus = new Set<number>(exclus);
  const resultat: { id: IdSection; films: T[] }[] = [];
  for (const section of sections) {
    const films: T[] = [];
    for (const film of section.films) {
      if (films.length >= taille) break;
      if (dejaVus.has(film.id)) continue;
      dejaVus.add(film.id);
      films.push(film);
    }
    if (films.length > 0) resultat.push({ id: section.id, films });
  }
  return resultat;
}
