"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  creerDossier,
  getRoutine,
  getRoutines,
  renommerDossier,
  supprimerDossier,
} from "@/app/actions/musculation";
import { Modal } from "@/components/Modal";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { showErrorToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { demarrerDepuisRoutine } from "@/lib/musculation/demarrer";
import type { DossierRoutines, RoutineResume } from "@/lib/musculation/routines";
import { useBrouillonEnCours } from "@/lib/musculation/useBrouillonEnCours";
import { queryKeys } from "@/lib/query/keys";
import { card, dangerButton, errorText, eyebrow, ghostButton, input, metaText, nameText, primaryButton, secondaryButton, sectionTitle } from "@/lib/ui";
import { ErrorInline } from "@/components/ErrorInline";

function LigneRoutine({
  routine,
  seanceEnCours,
  demarrage,
  onDemarrer,
}: {
  routine: RoutineResume;
  seanceEnCours: boolean;
  demarrage: boolean;
  onDemarrer: (id: string) => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <Link
        href={`/musculation/routines/${routine.id}`}
        className="flex min-w-0 flex-1 items-center gap-2"
        aria-label={`Modifier la routine ${routine.nom}`}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={nameText}>{routine.nom}</span>
          <span className={metaText}>
            {routine.typeSeance ? `${routine.typeSeance} · ` : ""}
            {routine.nbExercices} exercice{routine.nbExercices > 1 ? "s" : ""}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-[18px] leading-none text-ink-3">
          ›
        </span>
      </Link>
      <button
        type="button"
        className={ghostButton}
        onClick={() => onDemarrer(routine.id)}
        disabled={seanceEnCours || demarrage || routine.nbExercices === 0}
        aria-label={`Démarrer la routine ${routine.nom}`}
      >
        Démarrer
      </button>
    </li>
  );
}

/** Création, renommage et suppression d'un dossier. `dossier` null : création. */
function DossierModal({ dossier, onClose }: { dossier: DossierRoutines | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nom, setNom] = useState(dossier?.nom ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function lancer(action: () => ReturnType<typeof creerDossier> | ReturnType<typeof supprimerDossier>) {
    setEnCours(true);
    setErreur(null);
    const resultat = await runAction(action, { silencieux: true, onError: setErreur });
    setEnCours(false);
    if (!resultat.ok) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.musculationRoutines });
    onClose();
  }

  return (
    <Modal title={dossier ? "Modifier le dossier" : "Nouveau dossier"} onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void lancer(() => (dossier ? renommerDossier(dossier.id, nom) : creerDossier(nom)));
        }}
      >
        <input
          value={nom}
          maxLength={60}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Ex. Prise de masse"
          aria-label="Nom du dossier"
          autoComplete="off"
          className={input}
        />
        {erreur && (
          <p role="alert" className={errorText}>
            {erreur}
          </p>
        )}
        <button type="submit" className={primaryButton} disabled={enCours}>
          {dossier ? "Renommer" : "Créer le dossier"}
        </button>
        {dossier && (
          <>
            <button type="button" className={dangerButton} disabled={enCours} onClick={() => void lancer(() => supprimerDossier(dossier.id))}>
              Supprimer le dossier
            </button>
            <p className={metaText}>Ses routines ne sont pas supprimées : elles passent « sans dossier ».</p>
          </>
        )}
      </form>
    </Modal>
  );
}

/** Routines rangées par dossier, avec création de routines et de dossiers. */
export function RoutinesSection({ catalogueVide = false }: { catalogueVide?: boolean }) {
  const router = useRouter();
  const enCours = useBrouillonEnCours();
  const [demarrage, setDemarrage] = useState(false);
  // undefined : fermé ; null : nouveau dossier ; sinon dossier à modifier.
  const [dossierOuvert, setDossierOuvert] = useState<DossierRoutines | null | undefined>(undefined);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: queryKeys.musculationRoutines, queryFn: getRoutines });

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

  if (isLoading) {
    return (
      <div className={`${card} flex flex-col gap-2`}>
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return <ErrorInline message="Impossible de charger les routines. Vérifie ta connexion." retry={() => refetch()} />;
  }

  // Sans exercice au catalogue on ne peut rien composer : la page l'explique déjà, inutile d'empiler une seconde carte vide.
  if (catalogueVide && data.routines.length === 0 && data.dossiers.length === 0) return null;

  const sansDossier = data.routines.filter((r) => !r.dossierId || !data.dossiers.some((d) => d.id === r.dossierId));
  const seanceEnCours = Boolean(enCours);
  const ligne = (r: RoutineResume) => (
    <LigneRoutine key={r.id} routine={r} seanceEnCours={seanceEnCours} demarrage={demarrage} onDemarrer={(id) => void demarrer(id)} />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className={sectionTitle}>Routines</h2>
        <div className="flex gap-2">
          <button type="button" className={ghostButton} onClick={() => setDossierOuvert(null)}>
            + Dossier
          </button>
          <Link href="/musculation/routines/nouvelle" className={ghostButton}>
            + Routine
          </Link>
        </div>
      </div>

      {data.routines.length === 0 && data.dossiers.length === 0 && (
        <section className={`${card} flex flex-col gap-1.5`}>
          <p className={eyebrow}>
            Une routine est un modèle de séance : tes exercices et tes séries cibles, à relancer en un tap.
          </p>
          <Link href="/musculation/routines/nouvelle" className={`${secondaryButton} self-start`}>
            Créer ma première routine
          </Link>
        </section>
      )}

      {data.dossiers.map((dossier) => {
        const routines = data.routines.filter((r) => r.dossierId === dossier.id);
        return (
          <section key={dossier.id} className={`${card} flex flex-col gap-3`} aria-label={`Dossier ${dossier.nom}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className={sectionTitle}>{dossier.nom}</h3>
              <button type="button" className={ghostButton} onClick={() => setDossierOuvert(dossier)} aria-label={`Modifier le dossier ${dossier.nom}`}>
                Modifier
              </button>
            </div>
            {routines.length === 0 ? <p className={metaText}>Aucune routine dans ce dossier.</p> : <ul className="flex flex-col divide-y divide-line">{routines.map(ligne)}</ul>}
          </section>
        );
      })}

      {sansDossier.length > 0 && (
        <section className={`${card} flex flex-col gap-3`} aria-label="Routines sans dossier">
          {data.dossiers.length > 0 && <h3 className={sectionTitle}>Sans dossier</h3>}
          <ul className="flex flex-col divide-y divide-line">{sansDossier.map(ligne)}</ul>
        </section>
      )}

      <AnimatePresence>
        {dossierOuvert !== undefined && (
          <DossierModal key={dossierOuvert?.id ?? "nouveau"} dossier={dossierOuvert} onClose={() => setDossierOuvert(undefined)} />
        )}
      </AnimatePresence>
    </div>
  );
}
