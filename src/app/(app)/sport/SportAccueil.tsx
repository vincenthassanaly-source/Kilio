"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  getDerniereSeance,
  getRoutines,
  type DerniereSeance,
  type RoutineAvecExercices,
} from "@/app/actions/sport";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { showErrorToast } from "@/components/toast/toast-store";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { TransitionLink } from "@/components/TransitionLink";
import { queryKeys } from "@/lib/query/keys";
import { lireBrouillon } from "@/lib/sport/brouillon";
import { demarrerDepuisRoutine, demarrerSeanceVide } from "@/lib/sport/demarrer";
import { compterSeries, formaterDureeSeance, formaterPoids, type Brouillon } from "@/lib/sport/seance";
import { card, cardTight, eyebrow, linkButton, metaText, nameText, primaryButton, secondaryButton, sectionTitle } from "@/lib/ui";

const heure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const jourCourt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});

const ICONE_HALTERE = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--accent-sport)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3.5 9.5v5M6.5 7v10M17.5 7v10M20.5 9.5v5M6.5 12h11" />
  </svg>
);

/** Coquille de /sport en attente des routines : partagée par loading.tsx et le <Suspense> de page.tsx. */
export function SportSkeleton() {
  return (
    <>
      <Skeleton className="h-[72px] w-full rounded-[20px]" />
      <Skeleton className="h-36 w-full rounded-[22px]" />
      <Skeleton className="h-36 w-full rounded-[22px]" />
    </>
  );
}

function CarteDerniereSeance({ seance }: { seance: DerniereSeance }) {
  return (
    <section className={`${card} flex flex-col gap-1.5`} aria-label="Dernière séance">
      <span className={eyebrow}>Dernière séance</span>
      <h2 className={sectionTitle}>{seance.nom}</h2>
      <p className={metaText}>
        {jourCourt.format(new Date(seance.debutA))} · {formaterDureeSeance(seance.debutA, seance.finA)} ·{" "}
        {seance.nbExercices} exercice{seance.nbExercices > 1 ? "s" : ""} · {seance.nbSeries} série
        {seance.nbSeries > 1 ? "s" : ""}
        {seance.volumeKg > 0 ? ` · ${formaterPoids(seance.volumeKg)} kg` : ""}
      </p>
    </section>
  );
}

function CarteRoutine({
  routine,
  occupe,
  onDemarrer,
}: {
  routine: RoutineAvecExercices;
  occupe: boolean;
  onDemarrer: () => void;
}) {
  const nbSeries = routine.exercices.reduce((total, e) => total + e.nbSeries, 0);
  return (
    <section className={`${card} flex flex-col gap-3`} aria-label={`Routine ${routine.nom}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className={sectionTitle}>{routine.nom}</h2>
        <TransitionLink href={`/sport/routines/${routine.id}`} className={linkButton}>
          Modifier
        </TransitionLink>
      </div>
      <p className={`${metaText} line-clamp-2`}>{routine.exercices.map((e) => e.nom).join(" · ")}</p>
      <div className="flex items-center justify-between gap-3">
        <span className={metaText}>
          {routine.exercices.length} exercice{routine.exercices.length > 1 ? "s" : ""} · {nbSeries} séries
        </span>
        <button type="button" className={`${primaryButton} h-11 !py-0 text-[14px]`} onClick={onDemarrer} disabled={occupe}>
          Démarrer
        </button>
      </div>
    </section>
  );
}

type Cible = RoutineAvecExercices | "vide";

export function SportAccueil() {
  const router = useRouter();
  const [enCours, setEnCours] = useState<Brouillon | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [aRemplacer, setARemplacer] = useState<Cible | null>(null);

  const { data: routines, isLoading, isError } = useQuery({
    queryKey: queryKeys.sportRoutines,
    queryFn: getRoutines,
  });
  const { data: derniere } = useQuery({ queryKey: queryKeys.sportDerniereSeance, queryFn: getDerniereSeance });

  // Séance restée ouverte sur ce téléphone (stockage local, voir lib/sport/brouillon.ts).
  useEffect(() => {
    let annule = false;
    void lireBrouillon().then((b) => {
      if (!annule) setEnCours(b);
    });
    return () => {
      annule = true;
    };
  }, []);

  async function demarrer(cible: Cible) {
    setOccupe(true);
    try {
      if (cible === "vide") await demarrerSeanceVide();
      else await demarrerDepuisRoutine(cible);
      router.push("/sport/seance");
    } catch {
      setOccupe(false);
      showErrorToast("La séance n'a pas pu démarrer. Réessaie.");
    }
  }

  function demander(cible: Cible) {
    if (enCours) setARemplacer(cible);
    else void demarrer(cible);
  }

  const progression = enCours ? compterSeries(enCours) : null;

  return (
    <div className="flex flex-col gap-4">
      {enCours && progression && (
        <section className={`${card} flex flex-col gap-3 !border-kcal/40`} aria-label="Séance en cours">
          <div className="flex flex-col gap-0.5">
            <span className={eyebrow}>Séance en cours</span>
            <h2 className={sectionTitle}>{enCours.nom}</h2>
            <p className={metaText}>
              Commencée à {heure.format(new Date(enCours.debutA))} · {progression.faites}/{progression.total} séries
            </p>
          </div>
          <TransitionLink href="/sport/seance" className={`${primaryButton} h-11 text-center !py-0 leading-[44px]`}>
            Reprendre la séance
          </TransitionLink>
        </section>
      )}

      {isLoading && <SportSkeleton />}
      {isError && <p className="text-sm text-alert">Impossible de charger tes routines.</p>}

      {routines?.routines.map((routine) => (
        <CarteRoutine key={routine.id} routine={routine} occupe={occupe} onDemarrer={() => demander(routine)} />
      ))}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" className={`${secondaryButton} h-12`} onClick={() => demander("vide")} disabled={occupe}>
          Séance vide
        </button>
        <TransitionLink
          href="/sport/routines/nouvelle"
          className={`${secondaryButton} flex h-12 items-center justify-center !py-0 text-center`}
        >
          Nouvelle routine
        </TransitionLink>
      </div>

      {derniere && <CarteDerniereSeance seance={derniere} />}

      <TransitionLink href="/sport/exercices" className={`${cardTight} flex items-center gap-3`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-surface-alt">
          {ICONE_HALTERE}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={nameText}>Exercices</span>
          <span className={metaText}>Bibliothèque avec démonstration en images</span>
        </span>
      </TransitionLink>

      <AnimatePresence>
        {aRemplacer && (
          <ConfirmDialog
            open
            titre="Une séance est déjà en cours"
            confirmer="Remplacer par la nouvelle"
            onClose={() => setARemplacer(null)}
            onConfirm={() => {
              const cible = aRemplacer;
              setARemplacer(null);
              void demarrer(cible);
            }}
          >
            <p>
              La séance « {enCours?.nom} » et ses séries validées seront supprimées. Pour la garder, choisis « Garder » puis
              « Reprendre la séance ».
            </p>
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </div>
  );
}
