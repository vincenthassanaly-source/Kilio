"use client";

import { useState, useTransition } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { decalerSeanceAuProchainJourLibre, getSemaineSeances, marquerSeanceFaite } from "@/app/actions/seances";
import { CheckToggle } from "@/components/CheckToggle";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { showToast } from "@/components/toast/toast-store";
import { useBackClose } from "@/hooks/useBackClose";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import {
  etatSeance,
  heureCourte,
  JOURS_COURTS,
  JOURS_LONGS,
  jourDeSemaine,
  progressionSemaine,
  type Seance,
} from "@/lib/seances/compute";
import type { SemaineSeances } from "@/lib/seances/serveur";
import { card, ghostButton, primaryButton } from "@/lib/ui";
import { PlanningSeancesModal } from "./PlanningSeancesModal";

function libelleJour(seance: Seance, today: string): string {
  if (seance.date === today) return "Aujourd'hui";
  return JOURS_COURTS[jourDeSemaine(seance.date)];
}

function precision(seance: Seance, today: string): string {
  const etat = etatSeance(seance, today);
  if (etat === "faite") return "Faite";
  if (etat === "manquee") return "À replacer";
  return seance.reportee ? "Décalée" : "";
}

/**
 * Séances de sport de la semaine (plan type : créneaux du Planning). Cocher une
 * séance en fait un jour d'entraînement (cible kcal du Journal). « Décaler »
 * replace une séance sur le prochain jour libre de la semaine ; les séances
 * manquées sont déjà replacées à l'ouverture (cf. lireSemaine). Ton neutre :
 * une séance manquée est « à replacer », jamais un échec.
 */
export function SeancesCard({ today }: { today: string }) {
  const queryClient = useQueryClient();
  const cle = queryKeys.seancesSemaine(today);
  const [planningOuvert, setPlanningOuvert] = useState(false);
  const [, startTransition] = useTransition();
  useBackClose(planningOuvert, () => setPlanningOuvert(false));

  const { data, isLoading } = useQuery({
    queryKey: cle,
    queryFn: () => getSemaineSeances(today),
  });

  if (isLoading || !data) {
    return (
      <div className={`${card} flex flex-col gap-2`}>
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    );
  }

  const { creneaux, seances } = data;
  const { faites, total } = progressionSemaine(seances);

  function basculer(seance: Seance) {
    const faite = seance.statut !== "faite";
    const precedent = queryClient.getQueryData<SemaineSeances>(cle);
    queryClient.setQueryData<SemaineSeances>(cle, (courant) =>
      courant
        ? {
            ...courant,
            seances: courant.seances.map((s) => (s.id === seance.id ? { ...s, statut: faite ? "faite" : "prevue" } : s)),
          }
        : courant
    );
    startTransition(async () => {
      const resultat = await runAction(() => marquerSeanceFaite(seance.id, faite), {
        onError: () => queryClient.setQueryData(cle, precedent),
      });
      if (!resultat.ok) return;
      // Le jour devient (ou cesse d'être) un jour d'entraînement : les cartes
      // nutrition lues via TanStack Query relisent leur cible.
      await queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
    });
  }

  function decaler(seance: Seance) {
    startTransition(async () => {
      const resultat = await runAction(() => decalerSeanceAuProchainJourLibre(seance.id));
      if (resultat.ok) {
        showToast(`« ${seance.type} » décalée au ${JOURS_LONGS[jourDeSemaine(resultat.data.date)]}`);
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.seances });
    });
  }

  return (
    <section className={`${card} flex flex-col gap-3`} aria-label="Séances de la semaine">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Séances de la semaine</h2>
        {total > 0 && (
          <span className="text-[13px] font-semibold tabular-nums text-ink-2">
            {faites}/{total} faites
          </span>
        )}
      </div>

      {creneaux.length === 0 ? (
        <>
          <p className="text-[13.5px] leading-snug text-ink-2">
            Planifie tes séances : un rappel t&apos;arrive à l&apos;heure choisie, avec « Commencer » et « Décaler ».
          </p>
          <button type="button" onClick={() => setPlanningOuvert(true)} className={`${primaryButton} self-start`}>
            Planifier mes séances
          </button>
        </>
      ) : (
        <>
          {seances.length === 0 ? (
            <p className="text-[13.5px] leading-snug text-ink-2">Plus de séance prévue cette semaine.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {seances.map((seance) => {
                const etat = etatSeance(seance, today);
                const note = precision(seance, today);
                return (
                  <li key={seance.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <CheckToggle
                      checked={etat === "faite"}
                      onToggle={() => basculer(seance)}
                      label={`Marquer « ${seance.type} » comme ${etat === "faite" ? "non faite" : "faite"}`}
                      hitSlop={6}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[14.5px] font-medium ${etat === "faite" ? "text-ink-2 line-through" : "text-ink"}`}>
                        {seance.type}
                      </p>
                      <p className="text-[12.5px] tabular-nums text-ink-2">
                        {libelleJour(seance, today)} · {heureCourte(seance.heure)}
                        {note && ` · ${note}`}
                      </p>
                    </div>
                    {etat !== "faite" && (
                      <button
                        type="button"
                        onClick={() => decaler(seance)}
                        aria-label={`${etat === "manquee" ? "Replacer" : "Décaler"} la séance ${seance.type}`}
                        className={ghostButton}
                      >
                        {etat === "manquee" ? "Replacer" : "Décaler"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" onClick={() => setPlanningOuvert(true)} className={`${ghostButton} self-start`}>
            Planning
          </button>
        </>
      )}

      <AnimatePresence>
        {planningOuvert && <PlanningSeancesModal key="planning" creneaux={creneaux} onClose={() => setPlanningOuvert(false)} />}
      </AnimatePresence>
    </section>
  );
}
