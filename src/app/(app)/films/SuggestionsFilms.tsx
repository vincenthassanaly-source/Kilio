"use client";

import { useQuery } from "@tanstack/react-query";
import { getStatutsFilms, getSuggestions } from "@/app/actions/films";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { TransitionLink } from "@/components/TransitionLink";
import { lireResultat } from "@/lib/films/lire";
import { formaterNote, type FilmListe } from "@/lib/films/types";
import { queryKeys } from "@/lib/query/keys";
import { sectionTitle, textButton } from "@/lib/ui";
import { AfficheFilm } from "./AfficheFilm";
import { BoutonListe } from "./BoutonListe";
import { LigneDispo } from "./LigneDispo";
import { useActionsFilms } from "./useActionsFilms";

// Rangée à défilement horizontal, collée aux bords de l'écran (même motif que les barres de filtres du dépôt).
// `data-swipe-ignore` : un balayage dans la rangée ne doit jamais changer d'onglet.
const RANGEE =
  "-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function Tuile({
  film,
  mesIds,
  dansListe,
  onToggle,
}: {
  film: FilmListe;
  mesIds: ReadonlySet<number>;
  dansListe: boolean;
  onToggle: () => void;
}) {
  const note = formaterNote(film.note);
  return (
    <li className="relative w-28 shrink-0 snap-start">
      <TransitionLink
        href={`/films/${film.id}`}
        className="flex flex-col gap-2 rounded-xl transition-opacity active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
      >
        <AfficheFilm chemin={film.affiche} className="h-[168px] w-28" taille="w342" />
        <div className="flex flex-col gap-0.5">
          <p className="line-clamp-2 text-small font-semibold leading-snug text-ink text-balance">{film.titre}</p>
          <p className="text-caption tabular-nums text-ink-2">{[film.annee, note && `${note}/10`].filter(Boolean).join(" · ")}</p>
          <LigneDispo dispo={film.dispo} mesIds={mesIds} sansLogos className="text-caption" />
        </div>
      </TransitionLink>
      {/* Le bouton flotte sur l'affiche : fond de carte opaque pour rester lisible sur n'importe quelle image. */}
      <span className="absolute right-1 top-1 rounded-xl bg-surface shadow-card">
        <BoutonListe titre={film.titre} dansListe={dansListe} onToggle={onToggle} />
      </span>
    </li>
  );
}

function SqueletteSuggestions() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="h-5 w-3/5" />
      <div className={RANGEE}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex w-28 shrink-0 flex-col gap-2">
            <Skeleton className="h-[168px] w-28 rounded-xl" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

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

  if (suggestions.isLoading) return <SqueletteSuggestions />;

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
          <ul className={RANGEE} data-swipe-ignore>
            {section.films.map((film) => {
              const dansListe = statuts.data?.[film.id] !== undefined;
              const aAjouter = { id: film.id, titre: film.titre, annee: film.annee, affiche: film.affiche };
              return (
                <Tuile
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
