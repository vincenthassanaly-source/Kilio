"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { showErrorToast, showToast } from "@/components/toast/toast-store";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { queryKeys } from "@/lib/query/keys";
import { ecrireBrouillon, effacerBrouillon, lireBrouillon, synchroniserSeances, terminerSeance } from "@/lib/sport/brouillon";
import { exerciceDepuisBibliotheque } from "@/lib/sport/demarrer";
import {
  ajouterExercice,
  ajouterSerie,
  ajusterRepos,
  ajusterReposExercice,
  basculerSerie,
  compterSeries,
  formaterMinutes,
  formaterPoids,
  modifierSerie,
  retirerExercice,
  retirerSerie,
  terminerRepos,
  versPayload,
  volumeTotal,
  type Brouillon,
} from "@/lib/sport/seance";
import { signalerFinRepos, useMinuteurRepos } from "@/lib/sport/useMinuteurRepos";
import { useWakeLock } from "@/lib/sport/useWakeLock";
import { metaText, primaryButton, secondaryButton } from "@/lib/ui";
import { SelecteurExercices } from "../SelecteurExercices";
import { BarreRepos } from "./BarreRepos";
import { ExerciceBloc } from "./ExerciceBloc";

/** Temps écoulé depuis le début de la séance, rafraîchi chaque seconde. */
function Chrono({ debutA }: { debutA: string }) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const intervalle = window.setInterval(() => setMaintenant(Date.now()), 1000);
    return () => window.clearInterval(intervalle);
  }, []);
  const secondes = Math.max(0, (maintenant - new Date(debutA).getTime()) / 1000);
  return <span className="tabular-nums">{formaterMinutes(secondes)}</span>;
}

type Confirmation = "abandonner" | "vide" | "partiel" | null;

export function SeanceView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // undefined : lecture du stockage local en cours ; null : aucune séance en cours.
  const [brouillon, setBrouillon] = useState<Brouillon | null | undefined>(undefined);
  const [selecteur, setSelecteur] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [envoi, setEnvoi] = useState(false);
  // Une fois la séance terminée ou abandonnée, plus aucune écriture du brouillon.
  const clos = useRef(false);

  useEffect(() => {
    let annule = false;
    void lireBrouillon().then((lu) => {
      if (!annule) setBrouillon(lu);
    });
    return () => {
      annule = true;
    };
  }, []);

  // Chaque modification est écrite sur le téléphone : fermer l'app, perdre le
  // réseau ou recharger la page ne fait perdre aucune série.
  useEffect(() => {
    if (!brouillon || clos.current) return;
    ecrireBrouillon(brouillon).catch(() => {
      showErrorToast("Impossible de sauvegarder la séance sur le téléphone.");
    });
  }, [brouillon]);

  useEffect(() => {
    if (brouillon === null) router.replace("/sport");
  }, [brouillon, router]);

  useWakeLock(Boolean(brouillon));
  const restant = useMinuteurRepos(brouillon?.repos ?? null, signalerFinRepos);

  if (brouillon === undefined || brouillon === null) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-64 w-full rounded-[22px]" />
      </div>
    );
  }

  const b = brouillon;
  const maj = (f: (courant: Brouillon) => Brouillon) => setBrouillon((courant) => (courant ? f(courant) : courant));
  const { faites, total } = compterSeries(b);
  const volume = Math.round(volumeTotal(b));

  async function finir() {
    const payload = versPayload(b, new Date().toISOString());
    if (!payload) return;
    setEnvoi(true);
    clos.current = true;
    try {
      await terminerSeance(payload);
    } catch {
      clos.current = false;
      setEnvoi(false);
      showErrorToast("La séance n'a pas pu être enregistrée sur le téléphone. Réessaie.");
      return;
    }
    const resultat = await synchroniserSeances();
    if (resultat.restantes === 0) {
      queryClient.invalidateQueries({ queryKey: queryKeys.sportDerniereSeance });
      showToast("Séance enregistrée");
    } else if (resultat.refus.length > 0) {
      showErrorToast(`${resultat.refus[0]} La séance reste sur ton téléphone.`);
    } else {
      showToast("Séance gardée sur ton téléphone : envoi dès que le réseau revient.", 4500);
    }
    router.replace("/sport");
  }

  async function abandonner() {
    clos.current = true;
    await effacerBrouillon();
    setBrouillon(null);
  }

  function demanderFin() {
    if (faites === 0) setConfirmation("vide");
    else if (faites < total) setConfirmation("partiel");
    else void finir();
  }

  return (
    <div className="flex flex-col gap-4 pb-44">
      {/* La taille vient du conteneur : sur écran tactile, globals.css impose
          `font-size: max(16px, 1em)` aux champs, où 1em est celle du parent. */}
      <div className="font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
        <input
          value={b.nom}
          onChange={(e) => maj((courant) => ({ ...courant, nom: e.target.value.slice(0, 80) }))}
          aria-label="Nom de la séance"
          className="w-full rounded-xl bg-transparent pr-14 outline-none focus-visible:ring-2 focus-visible:ring-kcal"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className={`${metaText} flex flex-wrap items-center gap-x-2`}>
          <span className="font-semibold text-ink">
            <Chrono debutA={b.debutA} />
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {faites}/{total} séries
          </span>
          {volume > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{formaterPoids(volume)} kg</span>
            </>
          )}
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" className={`${secondaryButton} h-11 !py-0 text-[14px]`} onClick={() => setConfirmation("abandonner")}>
            Quitter
          </button>
          <button type="button" className={`${primaryButton} h-11 !py-0 text-[14px]`} onClick={demanderFin} disabled={envoi}>
            Terminer
          </button>
        </div>
      </div>

      {b.exercices.length === 0 && (
        <p className={`${metaText} rounded-2xl bg-surface-alt p-4 text-center`}>
          Séance vide : ajoute ton premier exercice pour commencer.
        </p>
      )}

      {b.exercices.map((exercice) => (
        <ExerciceBloc
          key={exercice.cle}
          exercice={exercice}
          onModifierSerie={(cle, serieId, champs) => maj((courant) => modifierSerie(courant, cle, serieId, champs))}
          onBasculer={(cle, serieId) => maj((courant) => basculerSerie(courant, cle, serieId, new Date().toISOString()))}
          onAjouterSerie={(cle) => maj((courant) => ajouterSerie(courant, cle))}
          onRetirerDerniereSerie={(cle) =>
            maj((courant) => {
              const derniere = courant.exercices.find((e) => e.cle === cle)?.series.at(-1);
              return derniere ? retirerSerie(courant, cle, derniere.id) : courant;
            })
          }
          onRetirerExercice={(cle) => maj((courant) => retirerExercice(courant, cle))}
          onReposExercice={(cle, delta) => maj((courant) => ajusterReposExercice(courant, cle, delta))}
        />
      ))}

      <button type="button" className={`${secondaryButton} h-12`} onClick={() => setSelecteur(true)}>
        + Ajouter un exercice
      </button>

      <SelecteurExercices
        ouvert={selecteur}
        onClose={() => setSelecteur(false)}
        onChoisir={async (exercice) => {
          setSelecteur(false);
          const nouvel = await exerciceDepuisBibliotheque(exercice);
          maj((courant) => ajouterExercice(courant, nouvel));
        }}
      />

      <BarreRepos
        repos={b.repos}
        restant={restant}
        onAjuster={(delta) => maj((courant) => ajusterRepos(courant, delta))}
        onFermer={() => maj(terminerRepos)}
      />

      <ConfirmDialog
        open={confirmation === "abandonner" || confirmation === "vide"}
        titre={confirmation === "vide" ? "Aucune série validée" : "Quitter la séance ?"}
        confirmer="Quitter sans enregistrer"
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          setConfirmation(null);
          void abandonner();
        }}
      >
        {confirmation === "vide" ? (
          <p>Tu n&apos;as validé aucune série : la séance ne sera pas enregistrée.</p>
        ) : (
          <p>
            La séance en cours{faites > 0 ? ` et ses ${faites} série${faites > 1 ? "s" : ""} validée${faites > 1 ? "s" : ""}` : ""} sera
            supprimée. Pour la garder, choisis « Terminer ».
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmation === "partiel"}
        titre="Terminer la séance ?"
        confirmer="Terminer et enregistrer"
        destructif={false}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          setConfirmation(null);
          void finir();
        }}
      >
        <p>
          {total - faites} série{total - faites > 1 ? "s" : ""} non validée{total - faites > 1 ? "s" : ""} ne seront pas
          enregistrées. Seules les {faites} série{faites > 1 ? "s" : ""} cochée{faites > 1 ? "s" : ""} comptent.
        </p>
      </ConfirmDialog>
    </div>
  );
}
