"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { enregistrerRoutine, getRoutine, getRoutines, supprimerRoutine } from "@/app/actions/musculation";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import {
  CHAMPS_PAR_MODE,
  dureeEnMinutes,
  LIMITES_CHAMP,
  minutesVersSecondes,
  secondesVersMinutes,
  TYPES_SERIE,
  TYPE_SERIE_LABELS,
  type ChampSerie,
  type ModeSaisie,
  type TypeSeance,
} from "@/lib/musculation/constantes";
import {
  NB_EXERCICES_ROUTINE_MAX,
  NB_SERIES_EXERCICE_MAX,
  ERREUR_NOM_ROUTINE,
  validerRoutine,
  type RoutineDetail,
  type RoutineExerciceDetail,
  type RoutineSerie,
} from "@/lib/musculation/routines";
import { formaterMinutes } from "@/lib/musculation/seance";
import type { ExerciceCatalogue } from "@/lib/musculation/serveur";
import { queryKeys } from "@/lib/query/keys";
import { LIBELLES_TYPE, ORDRE_TYPES } from "@/lib/seances/compute";
import { card, dangerButton, errorText, ghostButton, input, label, metaText, nameText, primaryButton, screenTitle, secondaryButton, zoneTapPill } from "@/lib/ui";
import { AnimationVignette } from "../../AnimationExercice";
import { ChampNombre } from "../../seance/ChampNombre";
import { SelecteurExercices } from "../../seance/SelecteurExercices";
import { BackLink } from "@/components/BackLink";
import { ErrorInline } from "@/components/ErrorInline";

const CLE_SERIE = { poids_kg: "poids", reps: "reps", duree_s: "duree", distance_m: "distance", vitesse_kmh: "vitesse" } as const;
const REPOS_PAR_DEFAUT_AFFICHE_S = 90;

const serieVide = (): RoutineSerie => ({ type: "normale", poids: null, reps: null, duree: null, distance: null, vitesse: null });

/** Flèche tracée (même trait que le menu de l'exercice en séance) : remplace les glyphes ↑ ↓ du texte. */
function FlecheIcone({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function enteteChamp(champ: ChampSerie, mode: ModeSaisie): string {
  if (champ === "poids_kg") return mode === "poids_corps_reps" ? "+kg" : "kg";
  if (champ === "reps") return "reps";
  if (champ === "duree_s") return mode === "duree_vitesse" ? "min" : "sec";
  if (champ === "vitesse_kmh") return "km/h";
  return "m";
}

function exerciceDepuisCatalogue(e: ExerciceCatalogue): RoutineExerciceDetail {
  return {
    exerciceId: e.id,
    nom: e.nom,
    mode: e.mode,
    reposS: null,
    reposExerciceS: e.reposDefautS,
    animation: e.animation,
    series: e.mode === "duree_vitesse" ? [serieVide()] : [serieVide(), serieVide(), serieVide()],
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
  const [enCours, setEnCours] = useState(false);
  // Série dont le sélecteur de type est ouvert, sous la forme « exercice-rang ».
  const [typeOuvert, setTypeOuvert] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Erreur propre au champ « Nom » : affichée juste dessous, pas sous la liste d'exercices.
  const [erreurNom, setErreurNom] = useState<string | null>(null);

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
      if (message === ERREUR_NOM_ROUTINE) {
        setErreur(null);
        setErreurNom(message);
      } else {
        setErreurNom(null);
        setErreur(message);
      }
      return;
    }
    setErreur(null);
    setErreurNom(null);
    setEnCours(true);
    const resultat = await runAction(() => enregistrerRoutine(entree), { silencieux: true, onError: setErreur });
    setEnCours(false);
    if (!resultat.ok) return;
    invalider();
    showToast("Routine enregistrée");
    router.replace("/musculation");
  }

  // Suppression différée : retour à la liste (où la routine est masquée),
  // « Annuler » la ramène pendant le délai du toast. Les séances déjà faites ne
  // sont pas touchées, avant comme après la suppression.
  function supprimer() {
    if (!initial) return;
    const cible = initial;
    supprimerAvecAnnulation({
      texte: `Routine « ${cible.nom} » supprimée`,
      ariaLabel: `Annuler la suppression de la routine « ${cible.nom} »`,
      masque: { type: "routine", id: cible.id },
      masquer: () => router.replace("/musculation"),
      supprimer: () => supprimerRoutine(cible.id),
      erreur: `Impossible de supprimer la routine « ${cible.nom} ». Réessaie.`,
      onSupprime: invalider,
    });
  }

  const chip = (actif: boolean) =>
    `${zoneTapPill} rounded-full px-3.5 py-1.5 text-small font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
      actif ? "bg-kcal text-on-kcal" : "bg-surface-alt text-ink-2"
    }`;

  return (
    <div className="flex flex-col gap-4 pb-8">
      <BackLink href="/musculation">Musculation</BackLink>
      <h1 className={screenTitle}>{initial ? "Modifier la routine" : "Nouvelle routine"}</h1>

      <div className={`${card} flex flex-col gap-3`}>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Nom</span>
          <input
            value={nom}
            maxLength={80}
            onChange={(e) => {
              setNom(e.target.value);
              setErreurNom(null);
            }}
            placeholder="Ex. Push A"
            autoComplete="off"
            aria-invalid={erreurNom ? true : undefined}
            aria-describedby={erreurNom ? "erreur-nom-routine" : undefined}
            className={input}
          />
          {erreurNom && (
            <span id="erreur-nom-routine" role="alert" className={errorText}>
              {erreurNom}
            </span>
          )}
        </label>

        <div className="flex flex-col gap-1.5" role="group" aria-label="Type de séance">
          <span className={label}>Type de séance</span>
          <div className="flex flex-wrap gap-x-2 gap-y-4 py-1">
            <button type="button" aria-pressed={typeSeance === null} className={chip(typeSeance === null)} onClick={() => setTypeSeance(null)}>
              Aucun
            </button>
            {ORDRE_TYPES.map((t) => (
              <button key={t} type="button" aria-pressed={typeSeance === t} className={chip(typeSeance === t)} onClick={() => setTypeSeance(t)}>
                {LIBELLES_TYPE[t]}
              </button>
            ))}
          </div>
          <p className={metaText}>Détermine la ligne Push, Pull ou Legs que cette routine coche dans Aujourd&apos;hui.</p>
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
        const entete = "text-center text-caption font-semibold uppercase tracking-wide text-ink-3";
        return (
          <section key={`${exercice.exerciceId}-${index}`} className={`${card} flex flex-col gap-3`} aria-label={exercice.nom}>
            <header className="flex flex-col gap-2.5">
              {/* Le nom garde toute la largeur de la carte ; les actions passent dessous (voir `actionsLigne`). */}
              <div className="flex items-center gap-2">
                <AnimationVignette animation={exercice.animation} nom={exercice.nom} />
                <span className={`${nameText} min-w-0 flex-1 !whitespace-normal`}>{exercice.nom}</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className={`${ghostButton} inline-flex min-w-11 items-center justify-center disabled:opacity-40`}
                  onClick={() => deplacer(index, -1)}
                  disabled={index === 0}
                  aria-label={`Monter ${exercice.nom}`}
                >
                  <FlecheIcone d="M12 19V5m0 0-6 6m6-6 6 6" />
                </button>
                <button
                  type="button"
                  className={`${ghostButton} inline-flex min-w-11 items-center justify-center disabled:opacity-40`}
                  onClick={() => deplacer(index, 1)}
                  disabled={index === exercices.length - 1}
                  aria-label={`Descendre ${exercice.nom}`}
                >
                  <FlecheIcone d="M12 5v14m0 0 6-6m-6 6-6-6" />
                </button>
                <button type="button" className={dangerButton} onClick={() => setExercices((c) => c.filter((_, i) => i !== index))} aria-label={`Retirer ${exercice.nom}`}>
                  Retirer
                </button>
              </div>
            </header>

            <div className="flex items-center gap-2">
              <span className="mr-auto text-small font-medium text-ink-2">Repos</span>
              <button type="button" className={ghostButton} onClick={() => surExercice(index, (e) => ({ ...e, reposS: Math.max(0, repos - 15) }))} aria-label="Retirer 15 secondes de repos">
                −15 s
              </button>
              <span className="min-w-[44px] text-center text-label font-semibold tabular-nums text-ink">{formaterMinutes(repos)}</span>
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
                        className={`h-12 rounded-xl bg-surface-alt text-center text-label font-semibold tabular-nums transition active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
                          serie.type === "normale" ? "text-ink-2" : "text-kcal"
                        }`}
                      >
                        {serie.type === "echauffement" ? "É" : rangTravail}
                        {serie.type === "dropset" && <span aria-hidden="true">↓</span>}
                        {serie.type === "echec" && <span aria-hidden="true">!</span>}
                      </button>
                      {champs.map((champ) => {
                        const cle = CLE_SERIE[champ];
                        const enMinutes = dureeEnMinutes(exercice.mode, champ);
                        const valeurSerie = serie[cle] ?? null;
                        const limites = LIMITES_CHAMP[champ];
                        const facteur = enMinutes ? 60 : 1;
                        return (
                          <ChampNombre
                            key={champ}
                            min={limites.min / facteur}
                            max={limites.max / facteur}
                            valeur={enMinutes ? secondesVersMinutes(valeurSerie) : valeurSerie}
                            entier={champ === "reps" || (champ === "duree_s" && !enMinutes)}
                            signe={champ === "poids_kg" && exercice.mode === "poids_corps_reps"}
                            libelle={`${enteteChamp(champ, exercice.mode)} cible de la série ${rang + 1}`}
                            onChange={(valeur) => surSerie(index, rang, { [cle]: enMinutes ? minutesVersSecondes(valeur) : valeur })}
                          />
                        );
                      })}
                    </div>
                    {ouvert && (
                      <div className="flex flex-wrap gap-x-2 gap-y-4 px-1 py-1" role="group" aria-label={`Type de la série ${rang + 1}`}>
                        {TYPES_SERIE.map((type) => (
                          <button
                            key={type}
                            type="button"
                            aria-pressed={serie.type === type}
                            onClick={() => {
                              surSerie(index, rang, { type });
                              setTypeOuvert(null);
                            }}
                            className={`${zoneTapPill} rounded-full px-3.5 py-1.5 text-small font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
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
                className={`${secondaryButton} h-11 flex-1 !py-0 text-label`}
                onClick={() => surExercice(index, (e) => ({ ...e, series: [...e.series, e.series.at(-1) ? { ...e.series.at(-1)! } : serieVide()] }))}
                disabled={exercice.series.length >= NB_SERIES_EXERCICE_MAX}
              >
                + Série
              </button>
              <button
                type="button"
                className={`${secondaryButton} h-11 flex-1 !py-0 text-label`}
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
          <button type="button" className={dangerButton} onClick={supprimer} disabled={enCours}>
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
    </div>
  );
}

/** Création (`routineId` null) ou modification d'une routine. */
export function RoutineEditeur({ routineId }: { routineId: string | null }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.musculationRoutine(routineId ?? "nouvelle"),
    queryFn: () => getRoutine(routineId!),
    enabled: routineId !== null,
  });

  if (routineId === null) return <Formulaire initial={null} />;
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-48 w-full rounded-card" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/musculation">Musculation</BackLink>
        <ErrorInline message="Impossible de charger la routine. Vérifie ta connexion." retry={() => void refetch()} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/musculation">Musculation</BackLink>
        <p className={errorText}>Cette routine n&apos;existe plus.</p>
      </div>
    );
  }
  return <Formulaire initial={data} />;
}
