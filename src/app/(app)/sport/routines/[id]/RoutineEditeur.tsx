"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  enregistrerRoutine,
  getRoutines,
  supprimerRoutine,
  type RoutineAvecExercices,
} from "@/app/actions/sport";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { TransitionLink } from "@/components/TransitionLink";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import { URL_IMAGES_SPORT } from "@/lib/sport/libelles";
import { formaterMinutes, REPOS_PAR_DEFAUT_S } from "@/lib/sport/seance";
import { card, dangerButton, errorText, eyebrow, input, linkButton, metaText, nameText, primaryButton, screenTitle, secondaryButton } from "@/lib/ui";
import { SelecteurExercices } from "../../SelecteurExercices";

type Ligne = {
  cle: string;
  exerciceId: string;
  nom: string;
  image: string | null;
  nbSeries: number;
  repsCible: number | null;
  reposS: number;
  avecReps: boolean;
};

const boutonPas =
  "flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-lg font-semibold text-ink transition active:scale-[0.95] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal";

function Pas({
  libelle,
  valeur,
  onMoins,
  onPlus,
  moinsDesactive,
  plusDesactive,
}: {
  libelle: string;
  valeur: string;
  onMoins: () => void;
  onPlus: () => void;
  moinsDesactive?: boolean;
  plusDesactive?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1" role="group" aria-label={libelle}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{libelle}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={boutonPas} onClick={onMoins} disabled={moinsDesactive} aria-label={`Moins de ${libelle.toLowerCase()}`}>
          −
        </button>
        <span className="min-w-[44px] text-center text-[15px] font-semibold tabular-nums text-ink" aria-live="polite">
          {valeur}
        </span>
        <button type="button" className={boutonPas} onClick={onPlus} disabled={plusDesactive} aria-label={`Plus de ${libelle.toLowerCase()}`}>
          +
        </button>
      </div>
    </div>
  );
}

function depuisRoutine(routine: RoutineAvecExercices): Ligne[] {
  return routine.exercices.map((e) => ({
    cle: e.id,
    exerciceId: e.exerciceId,
    nom: e.nom,
    image: e.image,
    nbSeries: e.nbSeries,
    repsCible: e.repsCible,
    reposS: e.reposS,
    avecReps: e.typeMesure === "poids_reps" || e.typeMesure === "reps",
  }));
}

function Formulaire({ initial }: { initial: RoutineAvecExercices | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [lignes, setLignes] = useState<Ligne[]>(() => (initial ? depuisRoutine(initial) : []));
  const [selecteur, setSelecteur] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const maj = (index: number, champs: Partial<Ligne>) =>
    setLignes((courantes) => courantes.map((l, i) => (i === index ? { ...l, ...champs } : l)));
  const deplacer = (index: number, sens: -1 | 1) =>
    setLignes((courantes) => {
      const cible = index + sens;
      if (cible < 0 || cible >= courantes.length) return courantes;
      const copie = [...courantes];
      [copie[index], copie[cible]] = [copie[cible], copie[index]];
      return copie;
    });

  const valide = nom.trim().length > 0 && lignes.length > 0;

  async function enregistrer() {
    setEnCours(true);
    const resultat = await runAction(() =>
      enregistrerRoutine({
        id: initial?.id,
        nom,
        exercices: lignes.map((l) => ({
          exerciceId: l.exerciceId,
          nbSeries: l.nbSeries,
          repsCible: l.avecReps ? l.repsCible : null,
          reposS: l.reposS,
        })),
      }),
    );
    if (!resultat.ok) {
      setEnCours(false);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.sportRoutines });
    router.push("/sport");
  }

  async function supprimer() {
    if (!initial) return;
    setEnCours(true);
    const resultat = await runAction(() => supprimerRoutine(initial.id));
    if (!resultat.ok) {
      setEnCours(false);
      setSuppression(false);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.sportRoutines });
    router.push("/sport");
  }

  return (
    <div className="flex flex-col gap-4">
      <TransitionLink href="/sport" className={`${linkButton} self-start`}>
        ‹ Sport
      </TransitionLink>
      <h1 className={screenTitle}>{initial ? "Modifier la routine" : "Nouvelle routine"}</h1>

      <label className="flex flex-col gap-1.5">
        <span className={eyebrow}>Nom</span>
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value.slice(0, 80))}
          placeholder="Push, Pull, Legs…"
          autoComplete="off"
          className={input}
        />
      </label>

      {lignes.length === 0 && (
        <p className={`${metaText} rounded-2xl bg-surface-alt p-4 text-center`}>
          Ajoute au moins un exercice pour enregistrer la routine.
        </p>
      )}

      {lignes.map((ligne, index) => (
        <section key={ligne.cle} className={`${card} flex flex-col gap-3`} aria-label={ligne.nom}>
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-surface-alt">
              {ligne.image && (
                // eslint-disable-next-line @next/next/no-img-element -- images déjà optimisées (WebP 600 px)
                <img src={`${URL_IMAGES_SPORT}/${ligne.image}`} alt="" width={48} height={48} decoding="async" className="h-full w-full object-cover" />
              )}
            </span>
            <h2 className={`${nameText} min-w-0 flex-1 !whitespace-normal`}>{ligne.nom}</h2>
            <div className="flex shrink-0">
              <button type="button" className={boutonPas} onClick={() => deplacer(index, -1)} disabled={index === 0} aria-label={`Monter ${ligne.nom}`}>
                ↑
              </button>
              <button type="button" className={boutonPas} onClick={() => deplacer(index, 1)} disabled={index === lignes.length - 1} aria-label={`Descendre ${ligne.nom}`}>
                ↓
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-around gap-3">
            <Pas
              libelle="Séries"
              valeur={String(ligne.nbSeries)}
              onMoins={() => maj(index, { nbSeries: ligne.nbSeries - 1 })}
              onPlus={() => maj(index, { nbSeries: ligne.nbSeries + 1 })}
              moinsDesactive={ligne.nbSeries <= 1}
              plusDesactive={ligne.nbSeries >= 20}
            />
            {ligne.avecReps && (
              <Pas
                libelle="Reps"
                valeur={ligne.repsCible === null ? "–" : String(ligne.repsCible)}
                onMoins={() => maj(index, { repsCible: Math.max(1, (ligne.repsCible ?? 11) - 1) })}
                onPlus={() => maj(index, { repsCible: Math.min(200, (ligne.repsCible ?? 9) + 1) })}
              />
            )}
            <Pas
              libelle="Repos"
              valeur={formaterMinutes(ligne.reposS)}
              onMoins={() => maj(index, { reposS: Math.max(0, ligne.reposS - 15) })}
              onPlus={() => maj(index, { reposS: Math.min(1800, ligne.reposS + 15) })}
              moinsDesactive={ligne.reposS <= 0}
            />
          </div>
          <button type="button" className={`${dangerButton} self-start`} onClick={() => setLignes((c) => c.filter((_, i) => i !== index))}>
            Retirer
          </button>
        </section>
      ))}

      <button type="button" className={`${secondaryButton} h-12`} onClick={() => setSelecteur(true)}>
        + Ajouter un exercice
      </button>

      <button type="button" className={`${primaryButton} h-12 !py-0`} onClick={() => void enregistrer()} disabled={!valide || enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer la routine"}
      </button>

      {initial && (
        <button type="button" className={`${dangerButton} self-center`} onClick={() => setSuppression(true)} disabled={enCours}>
          Supprimer la routine
        </button>
      )}

      <SelecteurExercices
        ouvert={selecteur}
        onClose={() => setSelecteur(false)}
        onChoisir={(exercice) => {
          setSelecteur(false);
          const avecReps = exercice.typeMesure === "poids_reps" || exercice.typeMesure === "reps";
          setLignes((courantes) => [
            ...courantes,
            {
              cle: crypto.randomUUID(),
              exerciceId: exercice.id,
              nom: exercice.nom_fr,
              image: exercice.image,
              nbSeries: 3,
              repsCible: avecReps ? 10 : null,
              reposS: REPOS_PAR_DEFAUT_S,
              avecReps,
            },
          ]);
        }}
      />

      <AnimatePresence>
        {suppression && (
          <ConfirmDialog
            open
            titre="Supprimer la routine ?"
            confirmer="Supprimer la routine"
            enCours={enCours}
            onClose={() => setSuppression(false)}
            onConfirm={() => void supprimer()}
          >
            <p>
              « {initial?.nom} » sera supprimée. Les séances déjà enregistrées avec cette routine sont conservées.
            </p>
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RoutineEditeur({ id }: { id: string }) {
  const nouvelle = id === "nouvelle";
  const { data, isLoading, isError } = useQuery({ queryKey: queryKeys.sportRoutines, queryFn: getRoutines });
  const existante = nouvelle ? null : (data?.routines.find((r) => r.id === id) ?? null);

  if (!nouvelle && isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-40 w-full rounded-[22px]" />
      </div>
    );
  }

  if (!nouvelle && (isError || !existante)) {
    return (
      <div className="flex flex-col gap-3">
        <TransitionLink href="/sport" className={`${linkButton} self-start`}>
          ‹ Sport
        </TransitionLink>
        <p className={errorText}>{isError ? "Erreur de chargement de la routine." : "Routine introuvable."}</p>
      </div>
    );
  }

  return <Formulaire key={id} initial={existante} />;
}
