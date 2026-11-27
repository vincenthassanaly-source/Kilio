"use client";

import { Skeleton } from "@/components/skeletons/Skeleton";
import { TransitionLink } from "@/components/TransitionLink";
import { formaterNote, type FilmListe } from "@/lib/films/types";
import { AfficheFilm } from "./AfficheFilm";
import { BoutonListe } from "./BoutonListe";
import { LigneDispo } from "./LigneDispo";

// Rangée à défilement horizontal, collée aux bords de l'écran (même motif que les barres de filtres du dépôt).
// À poser sur un <ul data-swipe-ignore> : un balayage dans la rangée ne doit jamais changer d'onglet.
export const RANGEE_FILMS =
  "-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Affiche, titre, année et note, où regarder, et le bouton d'ajout à la liste qui flotte sur l'affiche. */
export function TuileFilm({
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

/** Silhouette d'une rangée d'affiches, titre de section compris. */
export function SqueletteRangee() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="h-5 w-3/5" />
      <div className={RANGEE_FILMS}>
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
