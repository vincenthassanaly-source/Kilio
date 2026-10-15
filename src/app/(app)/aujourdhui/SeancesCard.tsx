"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getRoutine } from "@/app/actions/musculation";
import { getSemaineSeances } from "@/app/actions/seances";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { showErrorToast } from "@/components/toast/toast-store";
import { demarrerDepuisRoutine } from "@/lib/musculation/demarrer";
import { useBrouillonEnCours } from "@/lib/musculation/useBrouillonEnCours";
import { queryKeys } from "@/lib/query/keys";
import { LIBELLES_TYPE, progressionSemaine, type GroupeSemaine, type PastilleRoutine } from "@/lib/seances/compute";
import { card } from "@/lib/ui";

function Coche({ faite }: { faite: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
        faite ? "border-kcal bg-kcal text-on-kcal" : "border-line text-transparent"
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

function Pastille({
  routine,
  groupe,
  desactivee,
  onDemarrer,
}: {
  routine: PastilleRoutine;
  groupe: GroupeSemaine;
  desactivee: boolean;
  onDemarrer: (id: string) => void;
}) {
  const vide = routine.nbExercices === 0;
  return (
    <button
      type="button"
      onClick={() => onDemarrer(routine.id)}
      disabled={desactivee || vide}
      aria-label={`Commencer ${routine.nom}${routine.faite ? " (déjà faite cette semaine)" : ""}`}
      title={vide ? `${LIBELLES_TYPE[groupe.type]} ${routine.pastille} n'a pas d'exercice` : undefined}
      className={`flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-full px-3.5 text-[14px] font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal disabled:opacity-40 ${
        routine.faite ? "bg-kcal text-on-kcal" : "bg-surface-alt text-ink-2"
      }`}
    >
      {routine.faite && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
      {routine.pastille}
    </button>
  );
}

/**
 * Séances de la semaine : Push, Pull et Legs, chacun avec ses routines A/B/C.
 * Aucune date ni heure : un type (ou une routine) est « fait » dès qu'un
 * entraînement correspondant est enregistré depuis lundi. Toucher une pastille
 * lance la routine. Ton neutre : rien n'est jamais « en retard ».
 */
export function SeancesCard({ today }: { today: string }) {
  const router = useRouter();
  const enCours = useBrouillonEnCours();
  const [demarrage, setDemarrage] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.seancesSemaine(today),
    queryFn: () => getSemaineSeances(today),
  });

  async function demarrer(id: string) {
    setDemarrage(true);
    try {
      const routine = await getRoutine(id);
      if (!routine) {
        showErrorToast("Cette routine n'existe plus.");
        setDemarrage(false);
        return;
      }
      await demarrerDepuisRoutine(routine);
      router.push("/musculation/seance");
    } catch {
      setDemarrage(false);
      showErrorToast("Impossible de démarrer la routine. Vérifie ta connexion.");
    }
  }

  if (isLoading || !data) {
    return (
      <div className={`${card} flex flex-col gap-2`}>
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    );
  }

  const groupes = data.groupes.filter((g) => g.routines.length > 0 || g.faite);
  const { faites, total } = progressionSemaine(data.groupes);
  const desactivee = Boolean(enCours) || demarrage;

  return (
    <section className={`${card} flex flex-col gap-3`} aria-label="Séances de la semaine">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Séances de la semaine</h2>
        <span className="text-[13px] font-semibold tabular-nums text-ink-2">
          {faites}/{total} faites
        </span>
      </div>

      {enCours && (
        <Link
          href="/musculation/seance"
          className="flex items-center justify-between gap-3 rounded-2xl bg-kcal-soft px-3.5 py-2.5 text-[14px] font-semibold text-ink transition active:scale-[0.985]"
        >
          <span className="truncate">Séance en cours · {enCours.nom}</span>
          <span className="shrink-0 text-kcal">Reprendre</span>
        </Link>
      )}

      {groupes.length === 0 ? (
        <p className="text-[13.5px] leading-snug text-ink-2">
          Aucune routine Push, Pull ou Legs : donne un type à tes routines dans Musculation pour les retrouver ici.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {groupes.map((groupe) => (
            <li
              key={groupe.type}
              data-faite={groupe.faite}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${groupe.faite ? "bg-kcal-soft" : ""}`}
            >
              <Coche faite={groupe.faite} />
              <div className="min-w-0 flex-1">
                <p className={`text-[14.5px] ${groupe.faite ? "font-semibold text-ink" : "font-medium text-ink"}`}>
                  {LIBELLES_TYPE[groupe.type]}
                </p>
                {groupe.faite && <p className="text-[12.5px] font-medium text-kcal">Faite</p>}
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {groupe.routines.map((routine) => (
                  <Pastille key={routine.id} routine={routine} groupe={groupe} desactivee={desactivee} onDemarrer={(id) => void demarrer(id)} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
