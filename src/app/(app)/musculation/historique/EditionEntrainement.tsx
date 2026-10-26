"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { enregistrerEntrainement, getEntrainement } from "@/app/actions/musculation";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { aujourdhuiParis, heureParis } from "@/lib/date/paris";
import { exerciceDepuisCatalogue } from "@/lib/musculation/demarrer";
import { brouillonDepuisEntrainement, heureParisDe, instantParis, type EntrainementDetail } from "@/lib/musculation/historique";
import {
  ajouterExercice,
  ajouterSerie,
  ajusterReposExercice,
  modifierSerie,
  retirerExercice,
  retirerSerie,
  validerPayload,
  versPayload,
  type Brouillon,
} from "@/lib/musculation/seance";
import { queryKeys } from "@/lib/query/keys";
import { card, errorText, input, label, nameText, primaryButton, screenTitle, secondaryButton } from "@/lib/ui";
import { ExerciceBloc } from "../seance/ExerciceBloc";
import { SelecteurExercices } from "../seance/SelecteurExercices";
import { ErrorInline } from "@/components/ErrorInline";

/** Toutes les séries d'une séance passée sont faites, horodatées au début de la séance. */
function toutFait(b: Brouillon): Brouillon {
  return {
    ...b,
    exercices: b.exercices.map((e) => ({
      ...e,
      series: e.series.map((s) => (s.fait ? s : { ...s, fait: true, faitA: b.debutA })),
    })),
  };
}

function Formulaire({ detail }: { detail: EntrainementDetail | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const aujourdhui = aujourdhuiParis();
  const [brouillon, setBrouillon] = useState<Brouillon>(() =>
    detail
      ? brouillonDepuisEntrainement(detail)
      : { id: crypto.randomUUID(), nom: "Séance", routineId: null, typeSeance: null, debutA: new Date().toISOString(), exercices: [], repos: null },
  );
  const [date, setDate] = useState(detail?.date ?? aujourdhui);
  const [heure, setHeure] = useState(detail ? heureParisDe(detail.debutA) : heureParis());
  const [dureeMin, setDureeMin] = useState(detail ? String(Math.round(detail.dureeS / 60)) : "60");
  const [selecteur, setSelecteur] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const maj = (f: (b: Brouillon) => Brouillon) => setBrouillon((b) => f(b));

  async function enregistrer() {
    const minutes = Number(dureeMin);
    if (!date || !/^\d{2}:\d{2}$/.test(heure)) return setErreur("Indique la date et l'heure de début.");
    if (date > aujourdhui) return setErreur("La date ne peut pas être dans le futur.");
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1439) return setErreur("La durée doit être comprise entre 1 et 1439 minutes.");

    const debutA = instantParis(date, heure);
    const finA = new Date(Date.parse(debutA) + minutes * 60_000).toISOString();
    const payload = versPayload(toutFait({ ...brouillon, debutA }), finA);
    if (!payload) return setErreur("Ajoute au moins un exercice avec une série.");
    const invalide = validerPayload(payload);
    if (invalide) return setErreur(invalide);

    setErreur(null);
    setEnCours(true);
    const resultat = await runAction(() => enregistrerEntrainement(payload), { silencieux: true, onError: setErreur });
    setEnCours(false);
    if (!resultat.ok) return;
    void queryClient.invalidateQueries({ queryKey: ["musculation-historique"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.musculationEntrainement(payload.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.seances });
    void queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
    showToast("Séance enregistrée");
    router.replace(`/musculation/historique/${payload.id}`);
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <h1 className={screenTitle}>{detail ? "Modifier la séance" : "Séance passée"}</h1>

      <div className={`${card} flex flex-col gap-3`}>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Nom</span>
          <input
            value={brouillon.nom}
            maxLength={80}
            onChange={(e) => maj((b) => ({ ...b, nom: e.target.value }))}
            autoComplete="off"
            className={input}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Date</span>
            <input type="date" value={date} max={aujourdhui} onChange={(e) => setDate(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Début</span>
            <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={input} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Durée (minutes)</span>
          <input
            inputMode="numeric"
            value={dureeMin}
            onChange={(e) => /^\d{0,4}$/.test(e.target.value) && setDureeMin(e.target.value)}
            className={input}
          />
        </label>
      </div>

      {brouillon.exercices.map((exercice) => (
        <ExerciceBloc
          key={exercice.cle}
          edition
          exercice={exercice}
          onModifierSerie={(cle, serieId, champs) => maj((b) => modifierSerie(b, cle, serieId, champs))}
          onBasculer={() => {}}
          onAjouterSerie={(cle) => maj((b) => toutFait(ajouterSerie(b, cle)))}
          onRetirerDerniereSerie={(cle) =>
            maj((b) => {
              const derniere = b.exercices.find((e) => e.cle === cle)?.series.at(-1);
              return derniere ? retirerSerie(b, cle, derniere.id) : b;
            })
          }
          onRetirerExercice={(cle) => maj((b) => retirerExercice(b, cle))}
          onReposExercice={(cle, delta) => maj((b) => ajusterReposExercice(b, cle, delta))}
        />
      ))}

      {brouillon.exercices.length === 0 && <p className={nameText}>Aucun exercice pour l&apos;instant.</p>}

      <button type="button" className={`${secondaryButton} h-12`} onClick={() => setSelecteur(true)}>
        + Ajouter un exercice
      </button>

      {erreur && (
        <p role="alert" className={errorText}>
          {erreur}
        </p>
      )}

      <button type="button" className={`${primaryButton} h-12`} onClick={() => void enregistrer()} disabled={enCours}>
        Enregistrer
      </button>

      <SelecteurExercices
        ouvert={selecteur}
        onClose={() => setSelecteur(false)}
        onChoisir={async (exercice) => {
          setSelecteur(false);
          const nouvel = await exerciceDepuisCatalogue(exercice);
          maj((b) => toutFait(ajouterExercice(b, { ...nouvel, nbSeries: 1 })));
        }}
      />
    </div>
  );
}

/** Modification d'une séance enregistrée (`id`) ou saisie d'une séance passée (`id` null). */
export function EditionEntrainement({ id }: { id: string | null }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.musculationEntrainement(id ?? "nouvelle"),
    queryFn: () => getEntrainement(id!),
    enabled: id !== null,
  });

  if (id === null) return <Formulaire detail={null} />;
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-48 w-full rounded-[22px]" />
      </div>
    );
  }
  if (isError) {
    return <ErrorInline titre="Chargement impossible" message="Impossible de charger la séance. Vérifie ta connexion." retry={() => refetch()} />;
  }
  if (!data) return <ErrorInline titre="Séance introuvable" message="Cette séance n'existe plus." />;
  return <Formulaire detail={data} />;
}
