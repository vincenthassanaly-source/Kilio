"use client";

import { useQuery } from "@tanstack/react-query";
import { getSimilaires, getStatutsFilms } from "@/app/actions/films";
import { lireResultat } from "@/lib/films/lire";
import { queryKeys } from "@/lib/query/keys";
import { sectionTitle, textButton } from "@/lib/ui";
import { RANGEE_FILMS, SqueletteRangee, TuileFilm } from "./TuileFilm";
import { useActionsFilms } from "./useActionsFilms";

const TITRE = "Dans le même esprit";

/** Films proches de celui de la fiche (recommandations TMDB), ceux qu'on peut regarder chez soi d'abord.
 * Les films déjà vus n'y figurent pas. Une rangée vide ne laisse aucune trace à l'écran. */
export function SimilairesFilms({ id, mesIds }: { id: number; mesIds: ReadonlySet<number> }) {
  const { ajouter, retirer } = useActionsFilms();
  const similaires = useQuery({
    queryKey: queryKeys.filmsSimilaires(id),
    queryFn: () => lireResultat(getSimilaires(id)),
    staleTime: 10 * 60_000,
  });
  const statuts = useQuery({ queryKey: queryKeys.filmsStatuts, queryFn: () => lireResultat(getStatutsFilms()) });

  if (similaires.isLoading) return <SqueletteRangee />;

  if (similaires.isError) {
    return (
      <p className="text-small text-ink-2">
        Films similaires indisponibles.{" "}
        <button type="button" onClick={() => void similaires.refetch()} className={textButton}>
          Réessayer
        </button>
      </p>
    );
  }

  const films = similaires.data ?? [];
  if (films.length === 0) return null;

  return (
    <section aria-label={TITRE} className="flex flex-col gap-3">
      <h2 className={sectionTitle}>{TITRE}</h2>
      <ul className={RANGEE_FILMS} data-swipe-ignore>
        {films.map((film) => {
          const dansListe = statuts.data?.[film.id] !== undefined;
          const aAjouter = { id: film.id, titre: film.titre, annee: film.annee, affiche: film.affiche };
          return (
            <TuileFilm
              key={film.id}
              film={film}
              mesIds={mesIds}
              dansListe={dansListe}
              onToggle={() => void (dansListe ? retirer(aAjouter) : ajouter(aAjouter))}
            />
          );
        })}
      </ul>
    </section>
  );
}
