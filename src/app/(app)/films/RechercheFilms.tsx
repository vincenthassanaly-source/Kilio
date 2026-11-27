"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { chercherFilms, getGenres, getMesPlateformes, getStatutsFilms } from "@/app/actions/films";
import { ErrorInline } from "@/components/ErrorInline";
import { TransitionLink } from "@/components/TransitionLink";
import { lireResultat } from "@/lib/films/lire";
import {
  DECENNIES,
  DUREES_MAX,
  NOTES_MIN,
  estDecennie,
  formaterDuree,
  metaFilm,
  nombreFiltresActifs,
  type FilmListe,
  type FiltresFilms,
} from "@/lib/films/types";
import { queryKeys } from "@/lib/query/keys";
import { emptyState, inputAvecIcone, input, label, metaText, secondaryButton, sectionTitle, textButton } from "@/lib/ui";
import { AfficheFilm } from "./AfficheFilm";
import { BoutonListe } from "./BoutonListe";
import { lireEtatFilms, memoriserEtatFilms } from "./etatFilms";
import { HumeurFilms } from "./HumeurFilms";
import { LigneDispo } from "./LigneDispo";
import { SqueletteFilms } from "./SqueletteFilms";
import { SuggestionsFilms } from "./SuggestionsFilms";
import { useActionsFilms } from "./useActionsFilms";

const DELAI_SAISIE_MS = 350;
// Une recherche par titre filtrée peut rendre des pages vides : on enchaîne les pages, mais pas indéfiniment.
const PAGES_VIDES_MAX = 5;

const boutonFiltre = (actif: boolean) =>
  `inline-flex min-h-11 items-center gap-1.5 rounded-2xl border px-3.5 text-small font-semibold transition-[color,background-color,border-color,transform] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2 ${
    actif ? "border-transparent bg-kcal-soft text-kcal" : "border-line bg-surface text-ink hover:bg-surface-alt"
  }`;

function IconeLoupe() {
  return (
    <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.5-4.5" />
    </svg>
  );
}

function IconeFiltres() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  );
}

function LigneResultat({
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
  const meta = metaFilm(film);
  return (
    <li className="flex gap-2 rounded-row border border-line bg-surface p-3 shadow-card">
      <TransitionLink
        href={`/films/${film.id}`}
        className="flex min-w-0 flex-1 gap-3 rounded-xl transition-colors active:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
      >
        <AfficheFilm chemin={film.affiche} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="line-clamp-2 text-body font-semibold leading-snug text-ink text-balance">{film.titre}</p>
          {meta && <p className={metaText}>{meta}</p>}
          <LigneDispo dispo={film.dispo} mesIds={mesIds} className="mt-auto pt-1" />
        </div>
      </TransitionLink>
      <BoutonListe titre={film.titre} dansListe={dansListe} onToggle={onToggle} />
    </li>
  );
}

export function RechercheFilms() {
  const idPanneau = useId();
  const initial = lireEtatFilms();
  const [saisie, setSaisie] = useState(initial.saisie);
  const [filtres, setFiltres] = useState<FiltresFilms>(initial.filtres);
  const [panneauOuvert, setPanneauOuvert] = useState(() => nombreFiltresActifs(initial.filtres) > 0);
  const { ajouter, retirer } = useActionsFilms();

  // La requête suit la saisie avec un léger délai : une frappe ne déclenche pas un appel.
  useEffect(() => {
    const t = setTimeout(() => {
      const requete = saisie.trim();
      setFiltres((f) => (f.requete === requete ? f : { ...f, requete }));
    }, DELAI_SAISIE_MS);
    return () => clearTimeout(t);
  }, [saisie]);

  useEffect(() => {
    memoriserEtatFilms({ saisie, filtres });
  }, [saisie, filtres]);

  const plateformes = useQuery({ queryKey: queryKeys.filmsPlateformes, queryFn: () => lireResultat(getMesPlateformes()) });
  const genres = useQuery({ queryKey: queryKeys.filmsGenres, queryFn: () => lireResultat(getGenres()), staleTime: 24 * 3600_000 });
  const statuts = useQuery({ queryKey: queryKeys.filmsStatuts, queryFn: () => lireResultat(getStatutsFilms()) });

  const mesIds = useMemo(() => new Set((plateformes.data ?? []).map((p) => p.id)), [plateformes.data]);
  const nbPlateformes = mesIds.size;

  const recherche = useInfiniteQuery({
    queryKey: queryKeys.filmsRecherche(filtres),
    queryFn: ({ pageParam }) => lireResultat(chercherFilms(filtres, pageParam)),
    initialPageParam: 1,
    getNextPageParam: (derniere) => (derniere.page < derniere.totalPages ? derniere.page + 1 : undefined),
    staleTime: 5 * 60_000,
  });

  const films = useMemo(() => {
    const vus = new Map<number, FilmListe>();
    for (const page of recherche.data?.pages ?? []) for (const f of page.films) if (!vus.has(f.id)) vus.set(f.id, f);
    return [...vus.values()];
  }, [recherche.data]);

  const { hasNextPage, isFetching, fetchNextPage } = recherche;
  const nbPages = recherche.data?.pages.length ?? 0;
  useEffect(() => {
    if (!isFetching && films.length === 0 && hasNextPage && nbPages > 0 && nbPages < PAGES_VIDES_MAX) void fetchNextPage();
  }, [isFetching, films.length, hasNextPage, nbPages, fetchNextPage]);

  function majFiltres(partiel: Partial<FiltresFilms>) {
    setFiltres((f) => ({ ...f, ...partiel }));
  }

  function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    majFiltres({ requete: saisie.trim() });
    // Referme le clavier : le résultat est visible dessous.
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function reinitialiser() {
    majFiltres({ genre: null, decennie: null, noteMin: null, dureeMax: null });
  }

  const nbActifs = nombreFiltresActifs(filtres);
  const platformesActives = filtres.mesPlateformes && nbPlateformes > 0;
  const enRecherche = filtres.requete !== "";
  // Les suggestions n'ont de sens que sans recherche ni filtre : sinon l'utilisateur cherche quelque chose de précis.
  const montrerSuggestions = !enRecherche && nbActifs === 0 && !filtres.mesPlateformes && nbPlateformes > 0;
  const titreListe = enRecherche
    ? "Résultats"
    : nbActifs > 0 || platformesActives
      ? "Films"
      : montrerSuggestions
        ? "Tout explorer"
        : "Les plus populaires";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <form role="search" onSubmit={soumettre} className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
            <IconeLoupe />
          </span>
          <input
            type="search"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Titre d'un film…"
            aria-label="Rechercher un film par titre"
            autoComplete="off"
            enterKeyHint="search"
            className={`${inputAvecIcone} w-full`}
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {nbPlateformes === 0 ? (
            <TransitionLink href="/films/plateformes" className={boutonFiltre(false)}>
              Choisir mes plateformes
            </TransitionLink>
          ) : (
            <>
              <button
                type="button"
                aria-pressed={filtres.mesPlateformes}
                onClick={() => majFiltres({ mesPlateformes: !filtres.mesPlateformes })}
                className={boutonFiltre(filtres.mesPlateformes)}
              >
                Sur mes plateformes
              </button>
              <TransitionLink href="/films/plateformes" className={textButton}>
                Modifier
              </TransitionLink>
            </>
          )}
          <button
            type="button"
            aria-expanded={panneauOuvert}
            aria-controls={idPanneau}
            onClick={() => setPanneauOuvert((o) => !o)}
            className={`${boutonFiltre(nbActifs > 0)} ml-auto`}
          >
            <IconeFiltres />
            Filtres
            {nbActifs > 0 && <span className="tabular-nums">· {nbActifs}</span>}
          </button>
        </div>

        {panneauOuvert && (
          <div id={idPanneau} className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-card border border-line bg-surface p-4">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={label}>Genre</span>
              <select
                className={`${input} min-w-0`}
                value={filtres.genre ?? ""}
                onChange={(e) => majFiltres({ genre: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Tous</option>
                {(genres.data ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={label}>Époque</span>
              <select
                className={`${input} min-w-0`}
                value={filtres.decennie ?? ""}
                onChange={(e) => majFiltres({ decennie: estDecennie(e.target.value) ? e.target.value : null })}
              >
                <option value="">Toutes</option>
                {DECENNIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={label}>Note minimale</span>
              <select
                className={`${input} min-w-0`}
                value={filtres.noteMin ?? ""}
                onChange={(e) => majFiltres({ noteMin: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Toutes</option>
                {NOTES_MIN.map((n) => (
                  <option key={n} value={n}>
                    {n}/10 et plus
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={label}>Durée maximale</span>
              <select
                className={`${input} min-w-0`}
                value={filtres.dureeMax ?? ""}
                onChange={(e) => majFiltres({ dureeMax: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Toutes</option>
                {DUREES_MAX.map((m) => (
                  <option key={m} value={m}>
                    {formaterDuree(m)} ou moins
                  </option>
                ))}
              </select>
            </label>
            {nbActifs > 0 && (
              <button type="button" onClick={reinitialiser} className={`${textButton} col-span-2 justify-self-start`}>
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}
      </div>

      {!enRecherche && nbActifs === 0 && <HumeurFilms mesIds={mesIds} />}

      {montrerSuggestions && <SuggestionsFilms mesIds={mesIds} />}

      <section aria-labelledby={`${idPanneau}-titre`} className="flex flex-col gap-3">
        <h2 id={`${idPanneau}-titre`} className={sectionTitle}>
          {titreListe}
        </h2>

        {recherche.isError && films.length === 0 ? (
          <ErrorInline niveau={2} message={recherche.error.message} retry={() => void recherche.refetch()} />
        ) : recherche.isLoading ? (
          <SqueletteFilms />
        ) : films.length === 0 ? (
          <div className={emptyState}>
            {recherche.hasNextPage || recherche.isFetching ? (
              "Recherche en cours…"
            ) : platformesActives ? (
              <>
                Aucun film de cette recherche n&apos;est en abonnement sur tes plateformes.
                <br />
                <button type="button" onClick={() => majFiltres({ mesPlateformes: false })} className={textButton}>
                  Voir tous les films
                </button>
              </>
            ) : (
              "Aucun film ne correspond. Essaie d'élargir la recherche ou les filtres."
            )}
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2.5">
              {films.map((film) => {
                const dansListe = statuts.data?.[film.id] !== undefined;
                const aAjouter = { id: film.id, titre: film.titre, annee: film.annee, affiche: film.affiche };
                return (
                  <LigneResultat
                    key={film.id}
                    film={film}
                    mesIds={mesIds}
                    dansListe={dansListe}
                    onToggle={() => void (dansListe ? retirer(aAjouter) : ajouter(aAjouter))}
                  />
                );
              })}
            </ul>
            {recherche.isFetchNextPageError && (
              <ErrorInline niveau={2} message={recherche.error?.message ?? "Chargement impossible."} retry={() => void recherche.fetchNextPage()} />
            )}
            {recherche.hasNextPage && (
              <button
                type="button"
                onClick={() => void recherche.fetchNextPage()}
                disabled={recherche.isFetchingNextPage}
                className={`${secondaryButton} w-full`}
              >
                {recherche.isFetchingNextPage ? "Chargement…" : "Voir plus de films"}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
