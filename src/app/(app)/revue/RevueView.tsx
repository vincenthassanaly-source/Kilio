"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { getEvenements } from "@/app/actions/evenements";
import { getTachesAvecRelations } from "@/app/actions/taches";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { TransitionLink } from "@/components/TransitionLink";
import { tachesEnRetard } from "@/lib/aujourdhui/compute";
import { parseISODate, shiftDate } from "@/lib/date/iso";
import { queryKeys } from "@/lib/query/keys";
import { bilanSemaine, nbSansDate, semaineProchaine } from "@/lib/revue/compute";
import { libelleDuree } from "@/lib/taches/compute";
import { card, sectionTitle } from "@/lib/ui";
import { EnRetardSection } from "../aujourdhui/EnRetardSection";

const NB_TERMINEES_VISIBLES = 5;

function Chiffre({ valeur, libelle, alerte = false }: { valeur: number; libelle: string; alerte?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-surface-alt px-2 py-3">
      <span className={`text-[22px] font-semibold tabular-nums ${alerte && valeur > 0 ? "text-alert" : "text-ink"}`}>
        {valeur}
      </span>
      <span className="text-center text-[11.5px] leading-tight text-ink-2">{libelle}</span>
    </div>
  );
}

/**
 * Revue guidée : 1) bilan des 7 derniers jours, 2) retards à replanifier,
 * 3) les 7 jours à venir (charge estimée), 4) tâches sans date. Les actions
 * (reporter) réutilisent celles de l'écran Aujourd'hui.
 */
export function RevueView({ today }: { today: string }) {
  const passeDebut = shiftDate(today, -6);
  const avenirDebut = shiftDate(today, 1);
  const avenirFin = shiftDate(today, 7);

  const { data: taches, isLoading: tachesChargent } = useQuery({
    queryKey: queryKeys.taches,
    queryFn: getTachesAvecRelations,
  });
  const { data: evenementsPasses = [] } = useQuery({
    queryKey: queryKeys.evenementsPlage(passeDebut, today),
    queryFn: () => getEvenements(passeDebut, today),
  });
  const { data: evenementsAvenir = [] } = useQuery({
    queryKey: queryKeys.evenementsPlage(avenirDebut, avenirFin),
    queryFn: () => getEvenements(avenirDebut, avenirFin),
  });

  const liste = useMemo(() => taches ?? [], [taches]);
  const bilan = useMemo(() => bilanSemaine(liste, today), [liste, today]);
  const enRetard = useMemo(() => tachesEnRetard(liste, today), [liste, today]);
  const jours = useMemo(() => semaineProchaine(liste, evenementsAvenir, today), [liste, evenementsAvenir, today]);
  const sansDate = nbSansDate(liste);

  if (tachesChargent) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full rounded-[22px]" />
        <Skeleton className="h-56 w-full rounded-[22px]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-[calc(env(safe-area-inset-bottom)+110px)]">
      <section aria-labelledby="revue-bilan" className={`${card} flex flex-col gap-3`}>
        <h2 id="revue-bilan" className={sectionTitle}>
          1. Bilan des 7 derniers jours
        </h2>
        <div className="flex gap-2">
          <Chiffre valeur={bilan.terminees.length} libelle="tâches terminées" />
          <Chiffre valeur={evenementsPasses.length} libelle="rendez-vous" />
          <Chiffre valeur={bilan.nbEnRetard} libelle="en retard" alerte />
        </div>
        {bilan.terminees.length > 0 && (
          <ul className="flex flex-col gap-1 text-[13.5px] text-ink-2">
            {bilan.terminees.slice(0, NB_TERMINEES_VISIBLES).map((t) => (
              <li key={t.id} className="truncate">
                ✓ {t.titre}
              </li>
            ))}
            {bilan.terminees.length > NB_TERMINEES_VISIBLES && (
              <li className="text-ink-3">et {bilan.terminees.length - NB_TERMINEES_VISIBLES} autres</li>
            )}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <h2 className={sectionTitle}>2. Retards à replanifier</h2>
        {enRetard.length > 0 ? (
          <EnRetardSection taches={enRetard} today={today} />
        ) : (
          <p className={`${card} text-[14px] text-ink-2`}>Rien en retard. Bien joué.</p>
        )}
      </div>

      <section aria-labelledby="revue-semaine" className={`${card} flex flex-col gap-3`}>
        <h2 id="revue-semaine" className={sectionTitle}>
          3. Les 7 prochains jours
        </h2>
        <ul className="flex flex-col gap-2">
          {jours.map((jour) => {
            const vide = jour.taches.length === 0 && jour.evenements.length === 0;
            const total = jour.minutesTaches + jour.minutesEvenements;
            return (
              <li key={jour.date} className="flex flex-col gap-1 rounded-xl bg-surface-alt px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold capitalize text-ink">
                    {format(parseISODate(jour.date), "EEEE d MMM", { locale: fr })}
                  </span>
                  {jour.charge && (
                    <span className="rounded-full bg-alert/10 px-2 py-0.5 text-[11px] font-bold text-alert">Chargé</span>
                  )}
                  {!jour.charge && total > 0 && (
                    <span className="text-[11.5px] tabular-nums text-ink-3">{libelleDuree(total)}</span>
                  )}
                </div>
                {vide ? (
                  <span className="text-[12.5px] text-ink-3">Libre</span>
                ) : (
                  <ul className="flex flex-col gap-0.5 text-[13px] text-ink-2">
                    {jour.evenements.map((e, i) => (
                      <li key={`${e.id}-${i}`} className="truncate">
                        <span className="tabular-nums">{e.toute_la_journee ? "Journée" : e.heure.slice(0, 5)}</span> {e.titre}
                      </li>
                    ))}
                    {jour.taches.map((t) => (
                      <li key={t.id} className="truncate">
                        ☐ {t.titre}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {sansDate > 0 && (
        <section aria-labelledby="revue-sans-date" className={`${card} flex items-center justify-between gap-3`}>
          <div>
            <h2 id="revue-sans-date" className={sectionTitle}>
              4. Sans date
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-2">
              {sansDate === 1 ? "1 tâche n'a pas d'échéance" : `${sansDate} tâches n'ont pas d'échéance`} : à dater ou à
              abandonner.
            </p>
          </div>
          <TransitionLink href="/taches" className="shrink-0 text-sm font-semibold text-kcal">
            Voir
          </TransitionLink>
        </section>
      )}
    </div>
  );
}
