"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { enregistrerRoutine, getRoutine, getRoutines, supprimerRoutine } from "@/app/actions/musculation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import {
  CHAMPS_PAR_MODE,
  TYPES_SEANCE,
  TYPES_SERIE,
  TYPE_SERIE_LABELS,
  type ChampSerie,
  type ModeSaisie,
  type TypeSeance,
} from "@/lib/musculation/constantes";
import {
  NB_EXERCICES_ROUTINE_MAX,
  NB_SERIES_EXERCICE_MAX,
  validerRoutine,
  type RoutineDetail,
  type RoutineExerciceDetail,
  type RoutineSerie,
} from "@/lib/musculation/routines";
import { formaterMinutes } from "@/lib/musculation/seance";
import type { ExerciceCatalogue } from "@/lib/musculation/serveur";
import { queryKeys } from "@/lib/query/keys";
import { card, dangerButton, errorText, ghostButton, input, label, metaText, nameText, primaryButton, screenTitle, secondaryButton } from "@/lib/ui";
import { ChampNombre } from "../../seance/ChampNombre";
import { SelecteurExercices } from "../../seance/SelecteurExercices";

const CLE_SERIE = { poids_kg: "poids", reps: "reps", duree_s: "duree", distance_m: "distance" } as const;
const REPOS_PAR_DEFAUT_AFFICHE_S = 90;

const serieVide = (): RoutineSerie => ({ type: "normale", poids: null, reps: null, duree: null, distance: null });

function enteteChamp(champ: ChampSerie, mode: ModeSaisie): string {
  if (champ === "poids_kg") return mode === "poids_corps_reps" ? "+kg" : "kg";
  if (champ === "reps") return "reps";
  if (champ === "duree_s") return "sec";
  return "m";
}

function exerciceDepuisCatalogue(e: ExerciceCatalogue): RoutineExerciceDetail {
  return {
    exerciceId: e.id,
    nom: e.nom,
    mode: e.mode,
    reposS: null,
    reposExerciceS: e.reposDefautS,
    series: [serieVide(), serieVide(), serieVide()],
  };
}

function Formulaire({ initial }: { initial: RoutineDetail | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [typeSeance, setTypeSeance] = useState<TypeSeance | null>(initial?.typeSeance ?? null);
  const [dossierId, setDossierId] = useState<string | null>(initial?.dossierId ?? null);
  const [exercices, setExercices] = useState<RoutineExerciceDetail[]>(initial?.exercices ?? []);
  const [selecteur, setSelecteur] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [enCours, setEnCours] = useState(false);
  // Série dont le sélecteur de type est ouvert, sous la forme « exercice-rang ».
  const [typeOuvert, setTypeOuvert] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: liste } = useQuery({ queryKey: queryKeys.musculationRoutines, queryFn: getRoutines });
  const dossiers = liste?.dossiers ?? [];

  const surExercice = (index: number, f: (e: RoutineExerciceDetail) => RoutineExerciceDetail) =>
    setExercices((courant) => courant.map((e, i) => (i === index ? f(e) : e)));
  const surSerie = (index: number, rang: number, champs: Partial<RoutineSerie>) =>
    surExercice(index, (e) => ({ ...e, series: e.series.map((s, i) => (i === rang ? { ...s, ...champs } : s)) }));

  function deplacer(index: number, sens: -1 | 1) {
    setExercices((courant) => {
      const cible = index + sens;
      if (cible < 0 || cible >= courant.length) return courant;
      const copie = [...courant];
      [copie[index], copie[cible]] = [copie[cible], copie[index]];
      return copie;
    });
  }

  function invalider() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.musculationRoutines });
    if (initial) void queryClient.invalidateQueries({ queryKey: queryKeys.musculationRoutine(initial.id) });
  }

  async function enregistrer() {
    const entree = {
      ...(initial ? { id: initial.id } : {}),
      nom,
      typeSeance,
      dossierId,
      exercices: exercices.map((e) => ({ exerciceId: e.exerciceId, reposS: e.reposS, series: e.series })),
    };
    const message = validerRoutine(entree);
    if (message) {
      setErreur(message);
      return;
    }
    setErreur(null);
    setEnCours(true);
    const resultat = await runAction(() => enregistrerRoutine(entree), { silencieux: true, onError: setErreur });
    setEnCours(false);
    if (!resultat.ok) return;
    invalider();
    showToast("Routine enregistrée");
    router.replace("/musculation");
  }

  async function supprimer() {
    if (!initial) return;
    setEnCours(true);
    const resultat = await runAction(() => supprimerRoutine(initial.id));
    setEnCours(false);
    setSuppression(false);
    if (!resultat.ok) return;
    invalider();
    showToast("Routine supprimée");
    router.replace("/musculation");
  }

  const chip = (actif: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
      actif ? "bg-kcal text-on-kcal" : "bg-surface-alt text-ink-2"
    }`;

  return (
    <div className="flex flex-col gap-4 pb-8">
      <h1 className={screenTitle}>{initial ? "Modifier la routine" : "Nouvelle routine"}</h1>

      <div className={`${card} flex flex-col gap-3`}>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Nom</span>
          <input
            value={nom}
            maxLength={80}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex. Push A"
            autoComplete="off"
            className={input}
          />
        </label>

        <div className="flex flex-col gap-1.5" role="group" aria-label="Type de séance">
          <span className={label}>Type de séance</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={typeSeance === null} className={chip(typeSeance === null)} onClick={() => setTypeSeance(null)}>
              Aucun
            </button>
            {TYPES_SEANCE.map((t) => (
              <button key={t} type="button" aria-pressed={typeSeance === t} className={chip(typeSeance === t)} onClick={() => setTypeSeance(t)}>
                {t}
              </button>
            ))}
          </div>
          <p className={metaText}>Proposée quand tu commences une séance planifiée de ce type.</p>
        </div>

        {dossiers.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className={label}>Dossier</span>
            <select value={dossierId ?? ""} onChange={(e) => setDossierId(e.target.value || null)} className={input}>
              <option value="">Sans dossier</option>
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {exercices.map((exercice, index) => {
        const champs = CHAMPS_PAR_MODE[exercice.mode];
        const colonnes = ["44px", ...champs.map(() => "minmax(0,1fr)")].join(" ");
        const repos = exercice.reposS ?? exercice.reposExerciceS ?? REPOS_PAR_DEFAUT_AFFICHE_S;
        const entete = "text-center text-[12px] font-semibold uppercase tracking-wide text-ink-3";
        return (
          <section key={`${exercice.exerciceId}-${index}`} className={`${card} flex flex-col gap-3`} aria-label={exercice.nom}>
            <header className="flex items-center gap-2">
              <span className={`${nameText} min-w-0 flex-1 !whitespace-normal`}>{exercice.nom}</span>
              <button type="button" className={ghostButton} onClick={() => deplacer(index, -1)} disabled={index === 0} aria-label={`Monter ${exercice.nom}`}>
                ↑
              </button>
              <button type="button" className={ghostButton} onClick={() => deplacer(index, 1)} disabled={index === exercices.length - 1} aria-label={`Descendre ${exercice.nom}`}>
                ↓
              </button>
              <button type="button" className={dangerButton} onClick={() => setExercices((c) => c.filter((_, i) => i !== index))} aria-label={`Retirer ${exercice.nom}`}>
                Retirer
              </button>
            </header>

            <div className="flex items-center gap-2">
              <span className="mr-auto text-[13px] font-medium text-ink-2">Repos</span>
              <button type="button" className={ghostButton} onClick={() => surExercice(index, (e) => ({ ...e, reposS: Math.max(0, repos - 15) }))} aria-label="Retirer 15 secondes de repos">
                −15 s
              </button>
              <span className="min-w-[44px] text-center text-[14px] font-semibold tabular-nums text-ink">{formaterMinutes(repos)}</span>
              <button type="button" className={ghostButton} onClick={() => surExercice(index, (e) => ({ ...e, reposS: Math.min(1800, repos + 15) }))} aria-label="Ajouter 15 secondes de repos">
                +15 s
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="grid items-end gap-2" style={{ gridTemplateColumns: colonnes }} aria-hidden="true">
                <span className={entete}>Série</span>
                {champs.map((c) => (
                  <span key={c} className={entete}>
                    {enteteChamp(c, exercice.mode)}
                  </span>
                ))}
              </div>
              {exercice.series.map((serie, rang) => {
                const cleType = `${index}-${rang}`;
                const ouvert = typeOuvert === cleType;
                // Les échauffements ne comptent pas dans la numérotation (comme en séance).
                const rangTravail = exercice.series.slice(0, rang + 1).filter((s) => s.type !== "echauffement").length;
                return (
                  <div key={rang} className="flex flex-col gap-1.5">
                    <div className="grid items-center gap-2" style={{ gridTemplateColumns: colonnes }}>
                      <button
                        type="button"
                        aria-expanded={ouvert}
                        aria-label={`Type de la série ${rang + 1} : ${TYPE_SERIE_LABELS[serie.type]}`}
                        onClick={() => setTypeOuvert(ouvert ? null : cleType)}
                        className={`h-12 rounded-xl bg-surface-alt text-center text-[14px] font-semibold tabular-nums transition active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
                          serie.type === "normale" ? "text-ink-2" : "text-kcal"
                        }`}
                      >
                        {serie.type === "echauffement" ? "É" : rangTravail}
                        {serie.type === "dropset" && <span aria-hidden="true">↓</span>}
                        {serie.type === "echec" && <span aria-hidden="true">!</span>}
                      </button>
                      {champs.map((champ) => {
                        const cle = CLE_SERIE[champ];
                        return (
                          <ChampNombre
                            key={champ}
                            valeur={serie[cle]}
                            entier={champ === "reps" || champ === "duree_s"}
                            signe={champ === "poids_kg" && exercice.mode === "poids_corps_reps"}
                            libelle={`${enteteChamp(champ, exercice.mode)} cible de la série ${rang + 1}`}
                            onChange={(valeur) => surSerie(index, rang, { [cle]: valeur })}
                          />
                        );
                      })}
                    </div>
                    {ouvert && (
                      <div className="flex flex-wrap gap-2 px-1" role="group" aria-label={`Type de la série ${rang + 1}`}>
                        {TYPES_SERIE.map((type) => (
                          <button
                            key={type}
                            type="button"
                            aria-pressed={serie.type === type}
                            onClick={() => {
                              surSerie(index, rang, { type });
                              setTypeOuvert(null);
                            }}
                            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
                              serie.type === type ? "bg-kcal text-on-kcal" : "bg-surface-alt text-ink-2"
                            }`}
                          >
                            {TYPE_SERIE_LABELS[type]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className={`${secondaryButton} h-11 flex-1 !py-0 text-[14px]`}
                onClick={() => surExercice(index, (e) => ({ ...e, series: [...e.series, e.series.at(-1) ? { ...e.series.at(-1)! } : serieVide()] }))}
                disabled={exercice.series.length >= NB_SERIES_EXERCICE_MAX}
              >
                + Série
              </button>
              <button
                type="button"
                className={`${secondaryButton} h-11 flex-1 !py-0 text-[14px]`}
                onClick={() => surExercice(index, (e) => ({ ...e, series: e.series.slice(0, -1) }))}
                disabled={exercice.series.length <= 1}
              >
                − Série
              </button>
            </div>
          </section>
        );
      })}

      <button
        type="button"
        className={`${secondaryButton} h-12`}
        onClick={() => setSelecteur(true)}
        disabled={exercices.length >= NB_EXERCICES_ROUTINE_MAX}
      >
        + Ajouter un exercice
      </button>

      {erreur && (
        <p role="alert" className={errorText}>
          {erreur}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button type="button" className={`${primaryButton} h-12`} onClick={() => void enregistrer()} disabled={enCours}>
          Enregistrer
        </button>
        {initial && (
          <button type="button" className={dangerButton} onClick={() => setSuppression(true)} disabled={enCours}>
            Supprimer la routine
          </button>
        )}
      </div>

      <SelecteurExercices
        ouvert={selecteur}
        onClose={() => setSelecteur(false)}
        onChoisir={(e) => {
          setSelecteur(false);
          setExercices((courant) => [...courant, exerciceDepuisCatalogue(e)]);
        }}
      />

      <ConfirmDialog
        open={suppression}
        titre="Supprimer la routine ?"
        confirmer="Supprimer la routine"
        enCours={enCours}
        onClose={() => setSuppression(false)}
        onConfirm={() => void supprimer()}
      >
        <p>La routine « {initial?.nom} » sera supprimée. Les séances déjà faites ne sont pas touchées.</p>
      </ConfirmDialog>
    </div>
  );
}

/** Création (`routineId` null) ou modification d'une routine. */
export function RoutineEditeur({ routineId }: { routineId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.musculationRoutine(routineId ?? "nouvelle"),
    queryFn: () => getRoutine(routineId!),
    enabled: routineId !== null,
  });

  if (routineId === null) return <Formulaire initial={null} />;
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-48 w-full rounded-[22px]" />
      </div>
    );
  }
  if (!data) return <p className={errorText}>Cette routine n&apos;existe plus.</p>;
  return <Formulaire initial={data} />;
}
