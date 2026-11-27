"use client";

import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFiche, getStatutsFilms } from "@/app/actions/films";
import { BackLink } from "@/components/BackLink";
import { ErrorInline } from "@/components/ErrorInline";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { lireResultat } from "@/lib/films/lire";
import { LIBELLE_STATUT, metaFilm, urlLogo, type Fournisseur, type StatutFilm } from "@/lib/films/types";
import { queryKeys } from "@/lib/query/keys";
import { card, emptyState, linkButton, metaText, pillTag, primaryButton, sectionTitle, textButton } from "@/lib/ui";
import { AfficheFilm } from "../AfficheFilm";
import { AttributionTmdb } from "../AttributionTmdb";
import { SimilairesFilms } from "../SimilairesFilms";
import { useActionsFilms } from "../useActionsFilms";

function LogoFournisseur({ fournisseur }: { fournisseur: Fournisseur }) {
  const url = urlLogo(fournisseur.logo);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={36} height={36} loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-ink/10" />
  ) : (
    <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-xl bg-surface-alt" />
  );
}

function NomsFournisseurs({ titre, fournisseurs }: { titre: string; fournisseurs: Fournisseur[] }) {
  if (fournisseurs.length === 0) return null;
  return (
    <p className="text-small text-ink-2 text-pretty">
      <span className="font-semibold text-ink">{titre}</span> · {fournisseurs.map((f) => f.nom).join(", ")}
    </p>
  );
}

export function FicheFilmView({ id }: { id: number }) {
  const idDispo = useId();
  const { ajouter, marquer, retirer } = useActionsFilms();
  const fiche = useQuery({ queryKey: queryKeys.filmsFiche(id), queryFn: () => lireResultat(getFiche(id)) });
  const statuts = useQuery({ queryKey: queryKeys.filmsStatuts, queryFn: () => lireResultat(getStatutsFilms()) });

  const retour = <BackLink href="/films">Films</BackLink>;

  if (fiche.isError) {
    return (
      <div className="flex flex-col gap-4">
        {retour}
        <ErrorInline titre="Film indisponible" message={fiche.error.message} retry={() => void fiche.refetch()} />
      </div>
    );
  }

  if (!fiche.data) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        {retour}
        <div className="flex gap-4">
          <Skeleton className="h-[168px] w-28 shrink-0 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-3.5 w-2/5" />
          </div>
        </div>
        <Skeleton className="h-11 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-card" />
      </div>
    );
  }

  const { fiche: film, mesPlateformes } = fiche.data;
  const mesIds = new Set(mesPlateformes);
  // Le cache des statuts reçoit les mises à jour immédiates : la fiche suit le tap sans attendre le serveur.
  const statut: StatutFilm | null = statuts.data ? (statuts.data[id] ?? null) : fiche.data.statut;
  const aAjouter = { id: film.id, titre: film.titre, annee: film.annee, affiche: film.affiche };
  const meta = metaFilm(film);
  const dispo = film.dispo;
  const abonnement = dispo ? [...dispo.abonnement].sort((a, b) => Number(mesIds.has(b.id)) - Number(mesIds.has(a.id))) : [];
  const aucuneOffre = !!dispo && abonnement.length === 0 && dispo.location.length === 0 && dispo.achat.length === 0;

  return (
    <div className="flex flex-col gap-5">
      {retour}

      <header className="flex gap-4">
        <AfficheFilm chemin={film.affiche} className="h-[168px] w-28" taille="w342" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="font-display text-heading font-semibold leading-[1.15] tracking-[-0.02em] text-ink text-balance">{film.titre}</h1>
          {film.accroche && <p className="text-small text-ink-2 text-pretty">{film.accroche}</p>}
          {meta && <p className={metaText}>{meta}</p>}
          {film.genres.length > 0 && (
            <ul className="mt-auto flex flex-wrap gap-1.5">
              {film.genres.map((g) => (
                <li key={g} className={pillTag}>
                  {g}
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {statut === null ? (
        <button type="button" onClick={() => void ajouter(aAjouter)} className={`${primaryButton} w-full`}>
          Ajouter à ma liste
        </button>
      ) : (
        <div className="flex flex-col gap-1">
          <SegmentedControl<StatutFilm>
            ariaLabel="Statut du film dans ma liste"
            value={statut}
            onChange={(s) => void marquer(id, s)}
            glissant
            options={[
              { value: "a_voir", label: LIBELLE_STATUT.a_voir },
              { value: "vu", label: LIBELLE_STATUT.vu },
            ]}
          />
          <button type="button" onClick={() => void retirer(aAjouter)} className={`${textButton} self-start`}>
            Retirer de ma liste
          </button>
        </div>
      )}

      <section aria-labelledby={idDispo} className={`${card} flex flex-col gap-3`}>
        <h2 id={idDispo} className={sectionTitle}>
          Où le regarder en France
        </h2>

        {dispo === null || aucuneOffre ? (
          <p className={emptyState}>
            {dispo === null ? "Disponibilité inconnue pour le moment." : "Ce film n'est proposé sur aucune plateforme en France."}
          </p>
        ) : (
          <>
            {abonnement.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-small font-semibold text-ink-2">En abonnement</h3>
                <ul className="flex flex-col gap-2">
                  {abonnement.map((f) => (
                    <li key={f.id} className="flex min-h-11 items-center gap-3">
                      <LogoFournisseur fournisseur={f} />
                      <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">{f.nom}</span>
                      {mesIds.has(f.id) && <span className="shrink-0 rounded-full bg-kcal-soft px-2.5 py-1 text-micro font-semibold text-kcal">Ma plateforme</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <NomsFournisseurs titre="Location" fournisseurs={dispo.location} />
            <NomsFournisseurs titre="Achat" fournisseurs={dispo.achat} />
          </>
        )}

        {dispo?.lien && (
          <a href={dispo.lien} target="_blank" rel="noopener noreferrer" className={`${linkButton} self-start`}>
            Voir toutes les offres (JustWatch)
          </a>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Synopsis</h2>
        <p className="max-w-prose text-body text-ink-2 text-pretty">{film.resume || "Pas de synopsis en français pour ce film."}</p>
      </section>

      <SimilairesFilms id={id} mesIds={mesIds} />

      <AttributionTmdb />
    </div>
  );
}
