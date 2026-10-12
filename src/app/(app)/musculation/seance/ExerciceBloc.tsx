"use client";

import { useState } from "react";
import { showToast } from "@/components/toast/toast-store";
import { vibrate } from "@/lib/haptics";
import {
  CHAMPS_PAR_MODE,
  TYPES_SERIE,
  TYPE_SERIE_LABELS,
  type ChampSerie,
  type ModeSaisie,
  type TypeSerie,
} from "@/lib/musculation/constantes";
import {
  formaterMinutes,
  libellePrecedent,
  libelleSerie,
  type ExerciceBrouillon,
  type SerieBrouillon,
} from "@/lib/musculation/seance";
import { libelleRecords, recordsBattus } from "@/lib/musculation/stats";
import { deverrouillerAudio } from "@/lib/musculation/useMinuteurRepos";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AnimationMiniature } from "../AnimationExercice";
import { ChampNombre } from "./ChampNombre";
import { ghostButton, metaText, nameText, secondaryButton } from "@/lib/ui";

type Champs = Partial<Pick<SerieBrouillon, "poids" | "reps" | "duree" | "distance" | "type">>;

// Ligne du menu d'options : cible tactile de 48 px, séparateur fin entre les lignes.
const ligneMenu =
  "flex min-h-12 items-center gap-3 border-t border-line px-3.5 text-left text-[15px] font-medium text-ink transition hover:bg-surface active:bg-surface disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kcal";

function IconeMenu({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d={d} />
    </svg>
  );
}

const CLE_SERIE = { poids_kg: "poids", reps: "reps", duree_s: "duree", distance_m: "distance" } as const;
const LARGEUR_CHAMP: Record<ChampSerie, string> = { poids_kg: "68px", reps: "60px", duree_s: "68px", distance_m: "72px" };

function enteteChamp(champ: ChampSerie, mode: ModeSaisie): string {
  if (champ === "poids_kg") return mode === "poids_corps_reps" ? "+kg" : "kg";
  if (champ === "reps") return "reps";
  if (champ === "duree_s") return "sec";
  return "m";
}

function libelleAccessible(champ: ChampSerie, rang: number, mode: ModeSaisie): string {
  if (champ === "poids_kg") {
    return mode === "poids_corps_reps"
      ? `Poids ajouté (négatif si assisté) de la série ${rang}, en kilos`
      : `Poids de la série ${rang}, en kilos`;
  }
  if (champ === "reps") return `Répétitions de la série ${rang}`;
  if (champ === "duree_s") return `Durée de la série ${rang}, en secondes`;
  return `Distance de la série ${rang}, en mètres`;
}

const IconeCoche = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/** Un exercice de la séance : en-tête, tableau des séries (précédent, saisie, ✓) et actions. */
export function ExerciceBloc({
  exercice,
  onModifierSerie,
  onBasculer,
  onAjouterSerie,
  onRetirerDerniereSerie,
  onRetirerExercice,
  onReposExercice,
  onRemplacer,
  onDeplacer,
  premier = false,
  dernier = false,
  edition = false,
}: {
  exercice: ExerciceBrouillon;
  onModifierSerie: (cle: string, serieId: string, champs: Champs) => void;
  onBasculer: (cle: string, serieId: string) => void;
  onAjouterSerie: (cle: string) => void;
  onRetirerDerniereSerie: (cle: string) => void;
  onRetirerExercice: (cle: string) => void;
  onReposExercice: (cle: string, deltaS: number) => void;
  /** Séance en cours : ouvre le catalogue pour remplacer cet exercice. */
  onRemplacer?: (cle: string) => void;
  /** Séance en cours : décale l'exercice d'un cran (-1 haut, 1 bas). */
  onDeplacer?: (cle: string, sens: -1 | 1) => void;
  premier?: boolean;
  dernier?: boolean;
  /** Séance passée : toutes les séries sont faites, pas de case à cocher (ni de minuteur). */
  edition?: boolean;
}) {
  const [options, setOptions] = useState(false);
  const [confirmerRetrait, setConfirmerRetrait] = useState(false);
  // Série dont le sélecteur de type (normale, échauffement…) est ouvert.
  const [typeOuvertPour, setTypeOuvertPour] = useState<string | null>(null);
  const { mode, cle } = exercice;
  const champs = CHAMPS_PAR_MODE[mode];

  const colonnes = ["40px", "minmax(0,1fr)", ...champs.map((c) => LARGEUR_CHAMP[c]), ...(edition ? [] : ["48px"])].join(" ");
  const entete = "text-center text-[12px] font-semibold uppercase tracking-wide text-ink-3";
  const faites = exercice.series.filter((s) => s.fait).length;
  // Records battus par les séries validées (les autres sont traitées comme un échauffement : ignorées).
  const battus = edition
    ? []
    : recordsBattus(
        exercice.series.map((s) => (s.fait ? s : { ...s, type: "echauffement" as const })),
        exercice.records,
      );

  return (
    <section
      className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-3.5 shadow-card"
      aria-label={exercice.nom}
    >
      <header className="flex items-center gap-3">
        <AnimationMiniature animation={exercice.animation} nom={exercice.nom} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`${nameText} !whitespace-normal`}>{exercice.nom}</span>
          <span className={metaText}>
            {faites}/{exercice.series.length} séries · repos {formaterMinutes(exercice.reposS)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOptions((o) => !o)}
          aria-expanded={options}
          aria-label={`Options de ${exercice.nom}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-surface-alt active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
      </header>

      {options && (
        <div
          role="menu"
          aria-label={`Options de ${exercice.nom}`}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOptions(false);
          }}
          className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-alt"
        >
          <div className="flex items-center gap-2 px-3.5 py-2">
            <span className="mr-auto text-[14px] font-medium text-ink">Repos prévu</span>
            <button
              type="button"
              className={`${ghostButton} !bg-surface`}
              onClick={() => onReposExercice(cle, -15)}
              aria-label="Retirer 15 secondes de repos"
            >
              −15 s
            </button>
            <span className="min-w-[48px] text-center text-[15px] font-semibold tabular-nums text-ink" aria-live="polite">
              {formaterMinutes(exercice.reposS)}
            </span>
            <button
              type="button"
              className={`${ghostButton} !bg-surface`}
              onClick={() => onReposExercice(cle, 15)}
              aria-label="Ajouter 15 secondes de repos"
            >
              +15 s
            </button>
          </div>

          {onDeplacer && (
            <button type="button" role="menuitem" className={ligneMenu} onClick={() => onDeplacer(cle, -1)} disabled={premier}>
              <IconeMenu d="M12 19V5m0 0-6 6m6-6 6 6" />
              Monter l&apos;exercice
            </button>
          )}
          {onDeplacer && (
            <button type="button" role="menuitem" className={ligneMenu} onClick={() => onDeplacer(cle, 1)} disabled={dernier}>
              <IconeMenu d="M12 5v14m0 0 6-6m-6 6-6-6" />
              Descendre l&apos;exercice
            </button>
          )}
          {onRemplacer && (
            <button
              type="button"
              role="menuitem"
              className={ligneMenu}
              onClick={() => {
                setOptions(false);
                onRemplacer(cle);
              }}
            >
              <IconeMenu d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3-3m-3 3 3 3" />
              Remplacer l&apos;exercice
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className={ligneMenu}
            onClick={() => onRetirerDerniereSerie(cle)}
            disabled={exercice.series.length <= 1}
          >
            <IconeMenu d="M5 12h14" />
            Retirer la dernière série
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${ligneMenu} !text-alert`}
            onClick={() => (faites > 0 ? setConfirmerRetrait(true) : onRetirerExercice(cle))}
          >
            <IconeMenu d="M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
            Retirer l&apos;exercice
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmerRetrait}
        titre="Retirer l'exercice ?"
        confirmer="Retirer l'exercice"
        onClose={() => setConfirmerRetrait(false)}
        onConfirm={() => {
          setConfirmerRetrait(false);
          onRetirerExercice(cle);
        }}
      >
        <p>
          {faites} série{faites > 1 ? "s" : ""} validée{faites > 1 ? "s" : ""} sur {exercice.nom} sera
          {faites > 1 ? "ont" : ""} perdue{faites > 1 ? "s" : ""}.
        </p>
      </ConfirmDialog>

      <div className="flex flex-col gap-1.5">
        <div className="grid items-end gap-2" style={{ gridTemplateColumns: colonnes }} aria-hidden="true">
          <span className={entete}>Série</span>
          <span className={entete}>Précédent</span>
          {champs.map((c) => (
            <span key={c} className={entete}>
              {enteteChamp(c, mode)}
            </span>
          ))}
          {!edition && <span className={entete}>✓</span>}
        </div>

        {exercice.series.map((serie, index) => {
          const estTravail = serie.type !== "echauffement";
          // Rang parmi les séries de travail : sert au repère « Précédent » (les
          // échauffements n'en ont pas) et au libellé accessible.
          const ordinalTravail = exercice.series.slice(0, index).filter((s) => s.type !== "echauffement").length;
          const precedent = estTravail ? exercice.precedent[ordinalTravail] : undefined;
          const rang = estTravail ? ordinalTravail + 1 : index + 1;
          const typeOuvert = typeOuvertPour === serie.id;
          return (
            <div key={serie.id} className="flex flex-col gap-1.5">
              <div
                className={`grid items-center gap-2 rounded-2xl py-1 transition-colors ${serie.fait && !edition ? "bg-kcal-soft" : ""}`}
                style={{ gridTemplateColumns: colonnes }}
              >
                <button
                  type="button"
                  aria-expanded={typeOuvert}
                  aria-label={`Type de la série ${index + 1} : ${TYPE_SERIE_LABELS[serie.type]}`}
                  onClick={() => setTypeOuvertPour(typeOuvert ? null : serie.id)}
                  className={`h-11 rounded-xl text-center text-[14px] font-semibold tabular-nums transition active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
                    serie.type === "normale" ? "text-ink-2" : "bg-surface-alt text-kcal"
                  }`}
                >
                  {libelleSerie(exercice.series, index)}
                  {serie.type === "dropset" && <span aria-hidden="true">↓</span>}
                  {serie.type === "echec" && <span aria-hidden="true">!</span>}
                </button>
                <span className="truncate text-center text-[13px] tabular-nums text-ink-2">
                  {libellePrecedent(mode, precedent)}
                </span>
                {champs.map((champ) => {
                  const cleSerie = CLE_SERIE[champ];
                  return (
                    <ChampNombre
                      key={champ}
                      valeur={serie[cleSerie]}
                      entier={champ === "reps" || champ === "duree_s"}
                      signe={champ === "poids_kg" && mode === "poids_corps_reps"}
                      libelle={libelleAccessible(champ, rang, mode)}
                      onChange={(valeur) => onModifierSerie(cle, serie.id, { [cleSerie]: valeur })}
                    />
                  );
                })}
                {!edition && (
                  <button
                    type="button"
                    aria-pressed={serie.fait}
                    aria-label={serie.fait ? `Annuler la série ${index + 1}` : `Valider la série ${index + 1}`}
                    onClick={() => {
                      if (!serie.fait) {
                        deverrouillerAudio();
                        vibrate(15);
                        // Série validée = record de charge battu (comme le badge sous la série) : on félicite.
                        const apresValidation = recordsBattus(
                          exercice.series.map((s) => (s.fait || s.id === serie.id ? s : { ...s, type: "echauffement" as const })),
                          exercice.records,
                        );
                        if (apresValidation[index]?.includes("poids")) {
                          showToast(`Record de charge sur ${exercice.nom} 💪`, 3600);
                        }
                      }
                      onBasculer(cle, serie.id);
                    }}
                    className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 transition active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2 ${
                      serie.fait ? "border-kcal bg-kcal text-on-kcal" : "border-control-border text-transparent"
                    }`}
                  >
                    <IconeCoche />
                  </button>
                )}
              </div>
              {battus[index]?.length > 0 && serie.fait && (
                <p className="px-1 text-[12.5px] font-semibold text-kcal" role="status">
                  Nouveau record : {libelleRecords(battus[index])}
                </p>
              )}
              {typeOuvert && (
                <div className="flex flex-wrap gap-2 px-1" role="group" aria-label={`Type de la série ${index + 1}`}>
                  {TYPES_SERIE.map((type: TypeSerie) => (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={serie.type === type}
                      onClick={() => {
                        onModifierSerie(cle, serie.id, { type });
                        setTypeOuvertPour(null);
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

      <button type="button" className={`${secondaryButton} h-11 !py-0 text-[14px]`} onClick={() => onAjouterSerie(cle)}>
        + Ajouter une série
      </button>
    </section>
  );
}
