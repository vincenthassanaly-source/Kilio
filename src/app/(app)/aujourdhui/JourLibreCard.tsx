"use client";

import { useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getJoursLibresAutour, poserJourLibre, retirerJourLibre } from "@/app/actions/jours-libres";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { showToast } from "@/components/toast/toast-store";
import { shiftDate } from "@/lib/date/iso";
import { runAction } from "@/lib/actions/runAction";
import { JETONS_PAR_SEMAINE, erreurPoseJourLibre, jetonsRestants } from "@/lib/nutrition/libres";
import { queryKeys } from "@/lib/query/keys";
import { card, ghostButton, secondaryButton } from "@/lib/ui";

/**
 * Jours libres : 2 jetons par semaine qui suspendent la limite kcal d'un jour.
 * On les pose le jour même ou la veille (jamais après coup) ; un jour libre à
 * venir se retire et rend son jeton. Le plafond quotidien reste la règle : le
 * jour libre est l'exception décidée à l'avance, pas un rattrapage.
 */
export function JourLibreCard({ today }: { today: string }) {
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();

  const { data: joursLibres, isLoading } = useQuery({
    queryKey: queryKeys.joursLibresAutour(today),
    queryFn: () => getJoursLibresAutour(today),
  });

  if (isLoading || !joursLibres) {
    return (
      <div className={`${card} flex flex-col gap-2`}>
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    );
  }

  const restants = jetonsRestants(joursLibres, today);

  function appliquer(action: () => ReturnType<typeof poserJourLibre>, message: string) {
    startTransition(async () => {
      const resultat = await runAction(action);
      if (resultat.ok) showToast(message);
      // Les cartes nutrition (anneau, repas restants) relisent leur résumé.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.joursLibres }),
        queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] }),
      ]);
    });
  }

  const lignes = [
    { date: today, titre: "Aujourd'hui" },
    { date: shiftDate(today, 1), titre: "Demain" },
  ].map(({ date, titre }) => {
    const libre = joursLibres.includes(date);
    return { date, titre, libre, refus: libre ? null : erreurPoseJourLibre(date, today, joursLibres) };
  });

  return (
    <section className={`${card} flex flex-col gap-3`} aria-label="Jours libres">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Jours libres</h2>
        <span className="text-[13px] font-semibold tabular-nums text-ink-2">
          {restants}/{JETONS_PAR_SEMAINE} jetons cette semaine
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {lignes.map(({ date, titre, libre, refus }) => (
          <li key={date} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-[14.5px] font-medium text-ink">{titre}</p>
              <p className="text-[12.5px] text-ink-2">
                {libre ? "Jour libre · limite kcal suspendue" : "Limite kcal active"}
              </p>
            </div>
            {libre ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => appliquer(() => retirerJourLibre(date), `${titre} n'est plus un jour libre`)}
                aria-label={`Retirer le jour libre : ${titre.toLowerCase()}`}
                className={ghostButton}
              >
                Retirer
              </button>
            ) : (
              <button
                type="button"
                disabled={pending || refus !== null}
                onClick={() => appliquer(() => poserJourLibre(date), `${titre} : jour libre posé`)}
                aria-label={`Poser un jour libre : ${titre.toLowerCase()}`}
                className={secondaryButton}
              >
                Poser
              </button>
            )}
          </li>
        ))}
      </ul>
      {restants === 0 && (
        <p className="text-[12.5px] leading-snug text-ink-2">
          Plus de jeton cette semaine : la limite reste active jusqu&apos;à lundi.
        </p>
      )}
    </section>
  );
}
