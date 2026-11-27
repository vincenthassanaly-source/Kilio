"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWatchlist } from "@/app/actions/films";
import { CheckToggle } from "@/components/CheckToggle";
import { ErrorInline } from "@/components/ErrorInline";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TransitionLink } from "@/components/TransitionLink";
import { lireResultat } from "@/lib/films/lire";
import { LIBELLE_STATUT, surMesPlateformes, type FilmWatchlist, type StatutFilm } from "@/lib/films/types";
import { queryKeys } from "@/lib/query/keys";
import { actionTuile, emptyState, metaText } from "@/lib/ui";
import { AfficheFilm } from "./AfficheFilm";
import { lireEtatFilms, memoriserEtatFilms } from "./etatFilms";
import { LigneDispo } from "./LigneDispo";
import { SqueletteFilms } from "./SqueletteFilms";
import { useActionsFilms } from "./useActionsFilms";

function LigneListe({
  film,
  mesIds,
  onBasculer,
  onRetirer,
}: {
  film: FilmWatchlist;
  mesIds: ReadonlySet<number>;
  onBasculer: () => void;
  onRetirer: () => void;
}) {
  const vu = film.statut === "vu";
  return (
    <li className="flex gap-3 rounded-row border border-line bg-surface p-3 shadow-card">
      <TransitionLink
        href={`/films/${film.id}`}
        className="flex min-w-0 flex-1 gap-3 rounded-xl transition-colors active:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
      >
        <AfficheFilm chemin={film.affiche} className="h-24 w-16" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="line-clamp-2 text-body font-semibold leading-snug text-ink text-balance">{film.titre}</p>
          {film.annee !== null && <p className={metaText}>{film.annee}</p>}
          {!vu && <LigneDispo dispo={film.dispo} mesIds={mesIds} className="mt-auto pt-1" />}
        </div>
      </TransitionLink>
      <div className="flex shrink-0 flex-col items-end justify-between gap-2 py-0.5">
        <CheckToggle
          checked={vu}
          onToggle={onBasculer}
          label={vu ? `Remettre « ${film.titre} » à voir` : `Marquer « ${film.titre} » comme vu`}
          hitSlop={11}
        />
        <button type="button" onClick={onRetirer} className={`${actionTuile} text-ink-2 hover:text-alert`}>
          Retirer
        </button>
      </div>
    </li>
  );
}

export function ListeFilms({ onDecouvrir }: { onDecouvrir: () => void }) {
  const [sousOnglet, setSousOnglet] = useState<StatutFilm>(() => lireEtatFilms().sousOnglet);
  const { marquer, retirer } = useActionsFilms();
  const liste = useQuery({ queryKey: queryKeys.filmsListe, queryFn: () => lireResultat(getWatchlist()) });

  const mesIds = useMemo(() => new Set(liste.data?.mesPlateformes ?? []), [liste.data]);

  const { aVoir, vus } = useMemo(() => {
    const tous = liste.data?.films ?? [];
    // À voir : ce qu'on peut regarder tout de suite (abonnement chez soi) d'abord, puis les ajouts récents.
    const aVoir = tous
      .filter((f) => f.statut === "a_voir")
      .sort((a, b) => Number(surMesPlateformes(b.dispo, mesIds)) - Number(surMesPlateformes(a.dispo, mesIds)));
    return { aVoir, vus: tous.filter((f) => f.statut === "vu") };
  }, [liste.data, mesIds]);

  function choisir(valeur: StatutFilm) {
    setSousOnglet(valeur);
    memoriserEtatFilms({ sousOnglet: valeur });
  }

  const affiches = sousOnglet === "a_voir" ? aVoir : vus;

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl<StatutFilm>
        ariaLabel="Filtrer ma liste"
        value={sousOnglet}
        onChange={choisir}
        glissant
        options={[
          { value: "a_voir", label: `${LIBELLE_STATUT.a_voir} · ${aVoir.length}` },
          { value: "vu", label: `${LIBELLE_STATUT.vu} · ${vus.length}` },
        ]}
      />

      {liste.isError ? (
        <ErrorInline niveau={2} message={liste.error.message} retry={() => void liste.refetch()} />
      ) : liste.isLoading ? (
        <SqueletteFilms count={4} />
      ) : affiches.length === 0 ? (
        <div className={emptyState}>
          {sousOnglet === "a_voir" ? (
            <>
              Ta liste est vide. Ajoute des films avec le bouton + dans « Découvrir ».
              <br />
              <button type="button" onClick={onDecouvrir} className="relative inline-flex min-h-11 items-center text-label font-semibold text-kcal underline">
                Découvrir des films
              </button>
            </>
          ) : (
            "Aucun film vu pour l'instant. Coche un film de ta liste une fois regardé."
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {affiches.map((film) => {
            const aAjouter = { id: film.id, titre: film.titre, annee: film.annee, affiche: film.affiche };
            return (
              <LigneListe
                key={film.id}
                film={film}
                mesIds={mesIds}
                onBasculer={() => void marquer(film.id, film.statut === "vu" ? "a_voir" : "vu")}
                onRetirer={() => void retirer(aAjouter)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
