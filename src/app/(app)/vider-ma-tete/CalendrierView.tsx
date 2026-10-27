"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listerJoursEcrits, type JourEcrit } from "@/app/actions/vidage";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { TransitionLink } from "@/components/TransitionLink";
import { queryKeys } from "@/lib/query/keys";
import { eyebrow, linkButton, navArrowButton, screenTitle } from "@/lib/ui";
import { premierEtDernierJour } from "@/lib/vidage/jours";
import { BackLink } from "@/components/BackLink";

const JOURS_SEMAINE = ["L", "M", "M", "J", "V", "S", "D"] as const;

function decaler(mois: string, delta: number): string {
  const [annee, m] = mois.split("-").map(Number);
  const d = new Date(Date.UTC(annee, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function libelleMois(mois: string): string {
  const texte = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${mois}-01T12:00:00Z`));
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Calendrier de relecture : les soirs écrits ressortent avec la vignette de leur feuille. */
export function CalendrierView({ aujourdhui }: { aujourdhui: string }) {
  const moisCourant = aujourdhui.slice(0, 7);
  const [mois, setMois] = useState(moisCourant);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.vidageMois(mois),
    queryFn: async (): Promise<JourEcrit[]> => {
      const resultat = await listerJoursEcrits(mois);
      if (!resultat.ok) throw new Error(resultat.error);
      return resultat.data;
    },
    // Toujours recharger à l'ouverture : un mois lu juste avant l'arrivée d'une feuille sur
    // le serveur restait « vide » en cache. L'appel est court, et les URL signées (1 h) sont
    // ainsi toujours neuves.
    staleTime: 0,
    refetchOnMount: "always",
  });

  const ecrits = new Map((data ?? []).map((j) => [j.jour, j]));
  const [premier, dernier] = premierEtDernierJour(mois);
  const nombreDeJours = Number(dernier.slice(8));
  // Lundi en premier : getUTCDay() vaut 0 le dimanche.
  const decalage = (new Date(`${premier}T12:00:00Z`).getUTCDay() + 6) % 7;
  const cases = [...Array<null>(decalage).fill(null), ...Array.from({ length: nombreDeJours }, (_, i) => i + 1)];

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/vider-ma-tete">Feuille du soir</BackLink>
      <h1 className={screenTitle}>Relire</h1>

      <div className="flex items-center justify-between gap-3">
        <button type="button" aria-label="Mois précédent" className={navArrowButton} onClick={() => setMois((m) => decaler(m, -1))}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <p className="text-[17px] font-semibold text-ink" aria-live="polite">
          {libelleMois(mois)}
        </p>
        <button
          type="button"
          aria-label="Mois suivant"
          disabled={mois >= moisCourant}
          className={`${navArrowButton} disabled:opacity-35`}
          onClick={() => setMois((m) => decaler(m, 1))}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center" aria-hidden="true">
        {JOURS_SEMAINE.map((j, i) => (
          <span key={i} className={eyebrow}>
            {j}
          </span>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full rounded-[22px]" />
      ) : isError ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-alert">Le calendrier n&apos;a pas pu être chargé.</p>
          <button type="button" className={linkButton} onClick={() => void refetch()}>
            Réessayer
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-7 gap-1.5">
          {cases.map((numero, i) => {
            if (numero === null) return <li key={`vide-${i}`} aria-hidden="true" />;
            const jour = `${mois}-${String(numero).padStart(2, "0")}`;
            const feuille = ecrits.get(jour);
            const futur = jour > aujourdhui;
            const base = "relative flex aspect-[3/4] items-start justify-start overflow-hidden rounded-xl border p-1 text-[12px] font-medium tabular-nums";
            if (futur) {
              return (
                <li key={jour} className={`${base} border-line/50 text-ink-3`}>
                  {numero}
                </li>
              );
            }
            return (
              <li key={jour}>
                <TransitionLink
                  href={jour === aujourdhui ? "/vider-ma-tete" : `/vider-ma-tete/${jour}`}
                  aria-label={feuille ? `Relire le ${numero}` : `Écrire le ${numero}`}
                  className={`${base} h-full w-full ${feuille ? "border-line bg-surface text-ink" : "border-line/60 text-ink-2"}`}
                >
                  {feuille?.apercuUrl && (
                    // Vignette d'un bucket privé (URL signée) : <img> plutôt que next/image, dont
                    // l'optimiseur mettrait en cache une image intime côté serveur.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={feuille.apercuUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-top" loading="lazy" />
                  )}
                  <span className={feuille?.apercuUrl ? "relative rounded-md bg-surface/85 px-1" : "relative"}>{numero}</span>
                  {feuille && !feuille.apercuUrl && (
                    <span className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full" style={{ background: "var(--accent-vidage)" }} aria-hidden="true" />
                  )}
                </TransitionLink>
              </li>
            );
          })}
        </ul>
      )}

      {data && (
        <p className={`${eyebrow} text-center`}>
          {data.length === 0 ? "Aucune feuille ce mois-ci." : data.length === 1 ? "1 soir écrit ce mois-ci." : `${data.length} soirs écrits ce mois-ci.`}
        </p>
      )}
    </div>
  );
}
