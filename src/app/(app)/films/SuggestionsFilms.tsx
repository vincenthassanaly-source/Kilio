"use client";

import { useQuery } from "@tanstack/react-query";
import { getStatutsFilms, getSuggestions } from "@/app/actions/films";
import { lireResultat } from "@/lib/films/lire";
import { queryKeys } from "@/lib/query/keys";
import { sectionTitle, textButton } from "@/lib/ui";
import { RANGEE_FILMS, SqueletteRangee, TuileFilm } from "./TuileFilm";
import { useActionsFilms } from "./useActionsFilms";

/** Suggestions du moment : ce que l'utilisateur peut regarder tout de suite chez lui, en rangées d'affiches.
 * Les films déjà vus n'y figurent pas ; l'ajout à la liste se fait d'un tap sur l'affiche. */
export function SuggestionsFilms({ mesIds }: { mesIds: ReadonlySet<number> }) {
  const { ajouter, retirer } = useActionsFilms();
  const suggestions = useQuery({
    queryKey: queryKeys.filmsSuggestions,
    queryFn: () => lireResultat(getSuggestions()),
    staleTime: 10 * 60_000,
  });
  const statuts = useQuery({ queryKey: queryKeys.filmsStatuts, queryFn: () => lireResultat(getStatutsFilms()) });

  if (suggestions.isLoading) return <SqueletteRangee />;

  if (suggestions.isError) {
    // La liste complète juste dessous porte déjà l'erreur bloquante ; ici, une ligne discrète suffit.
    return (
      <p className="text-small text-ink-2">
        Suggestions indisponibles.{" "}
        <button type="button" onClick={() => void suggestions.refetch()} className={textButton}>
          Réessayer
        </button>
      </p>
    );
  }

  const sections = suggestions.data?.sections ?? [];
  if (sections.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <section key={section.id} aria-label={section.titre} className="flex flex-col gap-3">
          <h2 className={sectionTitle}>{section.titre}</h2>
          <ul className={RANGEE_FILMS} data-swipe-ignore>
            {section.films.map((film) => {
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
      ))}
    </div>
  );
}
