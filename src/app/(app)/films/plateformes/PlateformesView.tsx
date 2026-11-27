"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { definirPlateforme, getFournisseursFr, getMesPlateformes } from "@/app/actions/films";
import { ErrorInline } from "@/components/ErrorInline";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { Switch } from "@/components/Switch";
import { runAction } from "@/lib/actions/runAction";
import { lireResultat } from "@/lib/films/lire";
import { urlLogo, type Fournisseur } from "@/lib/films/types";
import { queryKeys } from "@/lib/query/keys";
import { emptyState, input, secondaryButton } from "@/lib/ui";
import { AttributionTmdb } from "../AttributionTmdb";

// Au-delà, la liste TMDB de la France se noie dans des chaînes marginales : on affiche les plus
// populaires et les choisies, le reste se trouve par la recherche ou « Tout afficher ».
const POPULAIRES = 24;

const sansAccent = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

export function PlateformesView() {
  const queryClient = useQueryClient();
  const [recherche, setRecherche] = useState("");
  const [toutAfficher, setToutAfficher] = useState(false);

  const fournisseurs = useQuery({
    queryKey: queryKeys.filmsFournisseurs,
    queryFn: () => lireResultat(getFournisseursFr()),
    staleTime: 24 * 3600_000,
  });
  const choisies = useQuery({ queryKey: queryKeys.filmsPlateformes, queryFn: () => lireResultat(getMesPlateformes()) });

  const mesIds = useMemo(() => new Set((choisies.data ?? []).map((p) => p.id)), [choisies.data]);

  const visibles = useMemo(() => {
    const tous = fournisseurs.data ?? [];
    const q = sansAccent(recherche.trim());
    if (q) return tous.filter((f) => sansAccent(f.nom).includes(q));
    if (toutAfficher) return tous;
    return tous.filter((f, i) => i < POPULAIRES || mesIds.has(f.id));
  }, [fournisseurs.data, recherche, toutAfficher, mesIds]);

  async function basculer(f: Fournisseur, actif: boolean) {
    queryClient.setQueryData<Fournisseur[]>(queryKeys.filmsPlateformes, (avant = []) =>
      actif ? [...avant.filter((x) => x.id !== f.id), f] : avant.filter((x) => x.id !== f.id)
    );
    await runAction(() => definirPlateforme(f, actif), {
      onError: () => void queryClient.invalidateQueries({ queryKey: queryKeys.filmsPlateformes }),
    });
    // Les recherches mémorisées dépendent des plateformes choisies : elles se rechargeront à la prochaine ouverture.
    void queryClient.invalidateQueries({ queryKey: queryKeys.films });
  }

  const erreur = fournisseurs.error ?? choisies.error;
  const total = fournisseurs.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-body text-ink-2 text-pretty">
        Coche tes abonnements. « Sur mes plateformes » ne garde alors que les films que tu peux regarder sans payer en plus.
      </p>

      {erreur ? (
        <ErrorInline
          niveau={2}
          message={erreur.message}
          retry={() => {
            void fournisseurs.refetch();
            void choisies.refetch();
          }}
        />
      ) : !fournisseurs.data || !choisies.data ? (
        <div className="flex flex-col gap-2.5" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-row" />
          ))}
        </div>
      ) : (
        <>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher une plateforme…"
            aria-label="Chercher une plateforme"
            autoComplete="off"
            enterKeyHint="search"
            className={`${input} w-full`}
          />

          {visibles.length === 0 ? (
            <p className={emptyState}>Aucune plateforme ne porte ce nom.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibles.map((f) => (
                <li key={f.id} className="flex min-h-16 items-center gap-3 rounded-row border border-line bg-surface px-3 py-2.5 shadow-card">
                  {urlLogo(f.logo) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urlLogo(f.logo) ?? undefined} alt="" width={40} height={40} loading="lazy" decoding="async" className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-ink/10" />
                  ) : (
                    <span aria-hidden="true" className="h-10 w-10 shrink-0 rounded-xl bg-surface-alt" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">{f.nom}</span>
                  <Switch checked={mesIds.has(f.id)} onToggle={() => void basculer(f, !mesIds.has(f.id))} label={f.nom} />
                </li>
              ))}
            </ul>
          )}

          {!recherche.trim() && !toutAfficher && total > visibles.length && (
            <button type="button" onClick={() => setToutAfficher(true)} className={`${secondaryButton} w-full`}>
              Tout afficher ({total})
            </button>
          )}
        </>
      )}

      <AttributionTmdb />
    </div>
  );
}
