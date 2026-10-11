"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { showErrorToast, showToast } from "@/components/toast/toast-store";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { ecrireBrouillon, effacerBrouillon, lireBrouillon, synchroniserSeances, terminerSeance } from "@/lib/musculation/brouillon";
import { getRoutine } from "@/app/actions/musculation";
import {
  demarrerDepuisRoutine,
  demarrerSeanceVide,
  exerciceDepuisCatalogue,
  preparerSeancePlanifiee,
  type PreparationSeance,
} from "@/lib/musculation/demarrer";
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
} from "@/lib/musculation/seance";
import { signalerFinRepos, useMinuteurRepos } from "@/lib/musculation/useMinuteurRepos";
import { useWakeLock } from "@/lib/musculation/useWakeLock";
import { queryKeys } from "@/lib/query/keys";
import { cardTight, metaText, nameText, primaryButton, screenTitle, secondaryButton } from "@/lib/ui";
import { BarreRepos } from "./BarreRepos";
import { ExerciceBloc } from "./ExerciceBloc";
import { SelecteurExercices } from "./SelecteurExercices";

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

/**
 * Séance en direct. Le brouillon vit dans Dexie (écrit à chaque modification) ;
 * « Terminer » le convertit en envoi en attente, puis tente l'envoi — sans
 * réseau, la séance reste sur le téléphone et part dès que possible
 * (MusculationSync). `seanceId` : séance planifiée à démarrer si aucune séance
 * n'est déjà en cours (lien « Commencer » de Aujourd'hui et du rappel push).
 */
export function SeanceView({ seanceId }: { seanceId: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // undefined : lecture du stockage local en cours ; null : aucune séance en cours.
  const [brouillon, setBrouillon] = useState<Brouillon | null | undefined>(undefined);
  const [selecteur, setSelecteur] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [envoi, setEnvoi] = useState(false);
  // Plusieurs routines pour le type de la séance planifiée : on laisse choisir.
  const [choix, setChoix] = useState<Extract<PreparationSeance, { choix: unknown }>["choix"] | null>(null);
  // Une fois la séance terminée ou abandonnée, plus aucune écriture du brouillon.
  const clos = useRef(false);

  useEffect(() => {
    let annule = false;
    void (async () => {
      const lu = await lireBrouillon();
      if (annule) return;
      if (lu) {
        setBrouillon(lu);
        return;
      }
      // Pas de séance en cours : on démarre celle du lien, sinon retour à l'accueil du module.
      if (seanceId) {
        const preparation = await preparerSeancePlanifiee(seanceId);
        if (annule) return;
        if ("brouillon" in preparation) setBrouillon(preparation.brouillon);
        else setChoix(preparation.choix);
      } else {
        setBrouillon(null);
      }
    })();
    return () => {
      annule = true;
    };
  }, [seanceId]);

  // Chaque modification est écrite sur le téléphone : fermer l'app, perdre le
  // réseau ou recharger la page ne fait perdre aucune série.
  useEffect(() => {
    if (!brouillon || clos.current) return;
    ecrireBrouillon(brouillon).catch(() => {
      showErrorToast("Impossible de sauvegarder la séance sur le téléphone.");
    });
  }, [brouillon]);

  useEffect(() => {
    if (brouillon === null) router.replace("/musculation");
  }, [brouillon, router]);

  useWakeLock(Boolean(brouillon));
  const restant = useMinuteurRepos(brouillon?.repos ?? null, signalerFinRepos);

  if (choix && brouillon === undefined) {
    const { seanceId: planifiee, type, routines } = choix;
    const demarrer = async (routineId: string | null) => {
      try {
        const routine = routineId ? await getRoutine(routineId) : null;
        setBrouillon(routine ? await demarrerDepuisRoutine(routine, planifiee) : await demarrerSeanceVide(planifiee));
        setChoix(null);
      } catch {
        showErrorToast("Impossible de démarrer la séance. Réessaie.");
      }
    };
    return (
      <div className="flex flex-col gap-4">
        <h1 className={screenTitle}>Séance {type}</h1>
        <p className={metaText}>Quelle routine veux-tu suivre ?</p>
        <ul className="flex flex-col gap-2">
          {routines.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => void demarrer(r.id)} className={`${cardTight} flex w-full flex-col gap-0.5 text-left`}>
                <span className={nameText}>{r.nom}</span>
                <span className={metaText}>
                  {r.nbExercices} exercice{r.nbExercices > 1 ? "s" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={secondaryButton} onClick={() => void demarrer(null)}>
          Séance libre
        </button>
      </div>
    );
  }

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
      queryClient.invalidateQueries({ queryKey: queryKeys.seances });
      queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
      queryClient.invalidateQueries({ queryKey: ["musculation-historique"] });
      showToast("Séance enregistrée");
      // Récapitulatif de la séance : on y retrouve « Enregistrer comme routine » et « Mettre à jour la routine ».
      router.replace(`/musculation/historique/${payload.id}`);
      return;
    } else if (resultat.refus.length > 0) {
      showErrorToast(`${resultat.refus[0]} La séance reste sur ton téléphone.`);
    } else {
      showToast("Séance gardée sur ton téléphone : envoi dès que le réseau revient.", 4500);
    }
    router.replace("/musculation");
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

      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span
            role="timer"
            aria-label="Durée de la séance"
            className="font-display text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink"
          >
            <Chrono debutA={b.debutA} />
          </span>
          <span className={metaText}>
            {faites}/{total} séries{volume > 0 ? ` · ${formaterPoids(volume)} kg` : ""}
          </span>
        </div>
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
          const nouvel = await exerciceDepuisCatalogue(exercice);
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
