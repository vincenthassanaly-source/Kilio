"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { showErrorToast, showToast } from "@/components/toast/toast-store";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { ecrireBrouillon, effacerBrouillon, lireBrouillon, synchroniserSeances, terminerSeance } from "@/lib/musculation/brouillon";
import { exerciceDepuisCatalogue } from "@/lib/musculation/demarrer";
import {
  ajouterExercice,
  ajouterSerie,
  ajusterRepos,
  ajusterReposExercice,
  basculerSerie,
  compterSeries,
  deplacerExercice,
  dureeMarcheFinale,
  formaterMinutes,
  formaterPoids,
  modifierSerie,
  prochaineSerie,
  remplacerExercice,
  retirerExercice,
  retirerSerie,
  terminerRepos,
  versPayload,
  volumeTotal,
  type Brouillon,
} from "@/lib/musculation/seance";
import { synchroniserRappelRepos } from "@/lib/musculation/rappelRepos";
import { signalerFinRepos, useMinuteurRepos } from "@/lib/musculation/useMinuteurRepos";
import { useWakeLock } from "@/lib/musculation/useWakeLock";
import { queryKeys } from "@/lib/query/keys";
import { LIBELLES_TYPE, ORDRE_TYPES } from "@/lib/seances/compute";
import { metaText, primaryButton, secondaryButton } from "@/lib/ui";
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

type Confirmation = "abandonner" | "vide" | "partiel" | "marche" | null;

/**
 * Séance en direct. Le brouillon vit dans Dexie (écrit à chaque modification) ;
 * « Terminer » le convertit en envoi en attente, puis tente l'envoi — sans
 * réseau, la séance reste sur le téléphone et part dès que possible
 * (MusculationSync). Une séance libre peut recevoir un type (Push / Pull / Legs) :
 * c'est lui qui la compte dans la semaine d'Aujourd'hui.
 */
export function SeanceView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // undefined : lecture du stockage local en cours ; null : aucune séance en cours.
  const [brouillon, setBrouillon] = useState<Brouillon | null | undefined>(undefined);
  const [selecteur, setSelecteur] = useState(false);
  // Clé de l'exercice à remplacer : le sélecteur du catalogue sert alors au remplacement.
  const [remplacementPour, setRemplacementPour] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [envoi, setEnvoi] = useState(false);
  // Durée (s) de la marche qui vient d'être validée en dernier : ajoutée au temps de la séance si on termine.
  const [marcheFinaleS, setMarcheFinaleS] = useState(0);
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
      // Pas de séance en cours : retour à l'accueil du module.
      setBrouillon(null);
    })();
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
    if (brouillon === null) router.replace("/musculation");
  }, [brouillon, router]);

  // Notification push de fin de repos (téléphone verrouillé) : suit le repos en cours,
  // l'annule quand il est passé, ajusté ou que la séance disparaît.
  useEffect(() => {
    if (brouillon !== undefined && !clos.current) synchroniserRappelRepos(brouillon);
  }, [brouillon]);

  // Ramène la série à faire au centre de l'écran : à l'ouverture de la séance (retour depuis
  // une autre page ou l'app rouverte) puis après chaque série cochée.
  const serieCourante = brouillon ? (prochaineSerie(brouillon)?.serieId ?? null) : null;
  const dejaAffichee = useRef(false);
  useEffect(() => {
    if (!serieCourante) return;
    const cible = document.querySelector(`[data-serie-id="${CSS.escape(serieCourante)}"]`);
    if (!cible) return;
    const animer = dejaAffichee.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cible.scrollIntoView({ block: "center", behavior: animer ? "smooth" : "auto" });
    dejaAffichee.current = true;
  }, [serieCourante]);

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

  async function finir(ajoutS = 0) {
    const payload = versPayload(b, new Date(Date.now() + ajoutS * 1000).toISOString());
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
    synchroniserRappelRepos(null);
    let resultat: Awaited<ReturnType<typeof synchroniserSeances>>;
    try {
      resultat = await synchroniserSeances();
    } catch {
      // La séance est déjà en sécurité sur le téléphone (terminerSeance) : on
      // quitte l'écran proprement, MusculationSync réessaiera.
      showToast("Séance gardée sur ton téléphone : envoi dès que possible.", 4500);
      router.replace("/musculation");
      return;
    }
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
    synchroniserRappelRepos(null);
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

      {b.routineId === null && (
        <div className="flex flex-col gap-1.5" role="group" aria-label="Type de séance">
          <span className={metaText}>Type de séance (facultatif)</span>
          <div className="flex flex-wrap gap-2">
            {ORDRE_TYPES.map((type) => {
              const actif = b.typeSeance === type;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => maj((courant) => ({ ...courant, typeSeance: actif ? null : type }))}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
                    actif ? "bg-kcal text-on-kcal" : "bg-surface-alt text-ink-2"
                  }`}
                >
                  {LIBELLES_TYPE[type]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {b.exercices.length === 0 && (
        <p className={`${metaText} rounded-2xl bg-surface-alt p-4 text-center`}>
          Séance vide : ajoute ton premier exercice pour commencer.
        </p>
      )}

      {b.exercices.map((exercice, index) => (
        <ExerciceBloc
          key={exercice.cle}
          exercice={exercice}
          premier={index === 0}
          dernier={index === b.exercices.length - 1}
          onRemplacer={setRemplacementPour}
          onDeplacer={(cle, sens) => maj((courant) => deplacerExercice(courant, cle, sens))}
          onModifierSerie={(cle, serieId, champs) => maj((courant) => modifierSerie(courant, cle, serieId, champs))}
          onBasculer={(cle, serieId) => {
            const apres = basculerSerie(b, cle, serieId, new Date().toISOString());
            setBrouillon(apres);
            // Dernière série = la marche de fin : on propose de terminer la séance tout de suite.
            const marche = dureeMarcheFinale(apres, cle, serieId);
            if (marche !== null) {
              setMarcheFinaleS(marche);
              setConfirmation("marche");
            }
          }}
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

      {b.exercices.length > 0 && (
        <button type="button" className={`${primaryButton} h-12`} onClick={demanderFin} disabled={envoi}>
          Terminer la séance
        </button>
      )}

      <SelecteurExercices
        ouvert={selecteur}
        onClose={() => setSelecteur(false)}
        onChoisir={async (exercice) => {
          setSelecteur(false);
          const nouvel = await exerciceDepuisCatalogue(exercice);
          maj((courant) => ajouterExercice(courant, nouvel));
        }}
      />

      <SelecteurExercices
        ouvert={remplacementPour !== null}
        titre="Remplacer l'exercice"
        onClose={() => setRemplacementPour(null)}
        onChoisir={async (exercice) => {
          const cle = remplacementPour;
          setRemplacementPour(null);
          if (!cle) return;
          const nouvel = await exerciceDepuisCatalogue(exercice);
          maj((courant) => remplacerExercice(courant, cle, nouvel));
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
        open={confirmation === "marche"}
        titre="Terminer la séance ?"
        confirmer="Terminer et enregistrer"
        destructif={false}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          setConfirmation(null);
          void finir(marcheFinaleS);
        }}
      >
        <p>
          La marche de {Math.round(marcheFinaleS / 60)} min est ajoutée à la durée de la séance. Choisis « Garder » pour
          continuer la séance et la terminer plus tard.
        </p>
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
