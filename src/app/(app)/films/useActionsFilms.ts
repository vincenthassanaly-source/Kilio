"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ajouterALaListe,
  changerStatutFilm,
  restaurerDansLaListe,
  retirerDeLaListe,
  type FilmAAjouter,
} from "@/app/actions/films";
import { showActionToast, dismissInfoToasts } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import type { FilmWatchlist, StatutFilm } from "@/lib/films/types";
import { queryKeys } from "@/lib/query/keys";

type Statuts = Record<number, StatutFilm>;
type DonneesListe = { films: FilmWatchlist[]; mesPlateformes: number[] };

/**
 * Écritures de la liste « à voir / vus », avec mise à jour immédiate du cache
 * (le tap se voit tout de suite) et retour arrière si le serveur refuse.
 * Retirer un film est annulable par un toast, comme partout dans l'app.
 */
export function useActionsFilms() {
  const queryClient = useQueryClient();

  const resynchroniser = useCallback(
    (id: number) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.filmsStatuts });
      void queryClient.invalidateQueries({ queryKey: queryKeys.filmsListe });
      void queryClient.invalidateQueries({ queryKey: queryKeys.filmsFiche(id) });
    },
    [queryClient]
  );

  const fixerStatut = useCallback(
    (id: number, statut: StatutFilm | null) => {
      queryClient.setQueryData<Statuts>(queryKeys.filmsStatuts, (avant) => {
        const suivant = { ...(avant ?? {}) };
        if (statut === null) delete suivant[id];
        else suivant[id] = statut;
        return suivant;
      });
      queryClient.setQueryData<DonneesListe>(queryKeys.filmsListe, (avant) => {
        if (!avant) return avant;
        return {
          ...avant,
          films: statut === null ? avant.films.filter((f) => f.id !== id) : avant.films.map((f) => (f.id === id ? { ...f, statut } : f)),
        };
      });
    },
    [queryClient]
  );

  const statutActuel = useCallback(
    (id: number): StatutFilm | null => queryClient.getQueryData<Statuts>(queryKeys.filmsStatuts)?.[id] ?? null,
    [queryClient]
  );

  const ajouter = useCallback(
    async (film: FilmAAjouter) => {
      const avant = statutActuel(film.id);
      fixerStatut(film.id, "a_voir");
      const r = await runAction(() => ajouterALaListe(film), { onError: () => fixerStatut(film.id, avant) });
      resynchroniser(film.id);
      return r.ok;
    },
    [fixerStatut, resynchroniser, statutActuel]
  );

  const marquer = useCallback(
    async (id: number, statut: StatutFilm) => {
      const avant = statutActuel(id);
      fixerStatut(id, statut);
      const r = await runAction(() => changerStatutFilm(id, statut), { onError: () => fixerStatut(id, avant) });
      resynchroniser(id);
      return r.ok;
    },
    [fixerStatut, resynchroniser, statutActuel]
  );

  const retirer = useCallback(
    async (film: FilmAAjouter) => {
      const avant = statutActuel(film.id) ?? "a_voir";
      fixerStatut(film.id, null);
      const r = await runAction(() => retirerDeLaListe(film.id), { onError: () => fixerStatut(film.id, avant) });
      resynchroniser(film.id);
      if (!r.ok) return false;
      dismissInfoToasts();
      showActionToast(`« ${film.titre} » retiré de ta liste`, {
        onAction: () => {
          fixerStatut(film.id, avant);
          void runAction(() => restaurerDansLaListe(film, avant), { onError: () => fixerStatut(film.id, null) }).then(() =>
            resynchroniser(film.id)
          );
        },
      });
      return true;
    },
    [fixerStatut, resynchroniser, statutActuel]
  );

  return { ajouter, marquer, retirer };
}
