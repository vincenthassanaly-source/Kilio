"use client";

import { useState, useTransition } from "react";
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
  // Replié par défaut : poser un jour libre est occasionnel (2 jetons par
  // semaine), il ne doit pas occuper une carte entière de l'écran chaque jour.
  const [ouvert, setOuvert] = useState(false);

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
      <h2 className="-m-1">
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls="jours-libres-detail"
          onClick={() => setOuvert((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
        >
          <span className="min-w-0">
            <span className="block text-body font-semibold tracking-[-0.01em] text-ink">Jours libres</span>
            {lignes[0].libre && <span className="block text-small font-normal text-ink-2">Aujourd&apos;hui : jour libre</span>}
          </span>
          <span className="flex shrink-0 items-center gap-2 text-small font-semibold tabular-nums text-ink-2">
            {restants}/{JETONS_PAR_SEMAINE} jetons
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-ink-3 transition-transform ${ouvert ? "rotate-90" : ""}`}
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      </h2>
      {ouvert && (
        <ul id="jours-libres-detail" className="flex flex-col divide-y divide-line">
          {lignes.map(({ date, titre, libre, refus }) => (
            <li key={date} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-body font-medium text-ink">{titre}</p>
                <p className="text-small text-ink-2">
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
      )}
      {ouvert && restants === 0 && (
        <p className="text-small leading-snug text-ink-2">
          Plus de jeton cette semaine : la limite reste active jusqu&apos;à lundi.
        </p>
      )}
    </section>
  );
}
