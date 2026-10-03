"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { vibrate } from "@/lib/haptics";
import { URL_IMAGES_SPORT } from "@/lib/sport/libelles";
import { deverrouillerAudio } from "@/lib/sport/useMinuteurRepos";
import {
  formaterMinutes,
  formaterPoids,
  lireNombre,
  type ExerciceBrouillon,
  type SerieBrouillon,
  type SeriePrecedente,
} from "@/lib/sport/seance";
import { dangerButton, ghostButton, metaText, nameText, secondaryButton } from "@/lib/ui";
import { ApercuExercice } from "./ApercuExercice";

type Champs = Partial<Pick<SerieBrouillon, "poids" | "reps" | "duree">>;

const champ =
  "h-12 w-full min-w-0 rounded-xl border border-transparent bg-surface-alt px-1 text-center text-base font-semibold tabular-nums text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-kcal/60 focus-visible:ring-2 focus-visible:ring-kcal";

/**
 * Champ numérique qui garde le texte tapé (« 82, » en cours de saisie) tout en
 * restant synchronisé avec la valeur de la série quand elle change ailleurs.
 */
function ChampNombre({
  valeur,
  entier,
  libelle,
  onChange,
}: {
  valeur: number | null;
  entier: boolean;
  libelle: string;
  onChange: (valeur: number | null) => void;
}) {
  const [texte, setTexte] = useState(valeur === null ? "" : String(valeur).replace(".", ","));
  const [valeurVue, setValeurVue] = useState(valeur);
  if (valeur !== valeurVue) {
    setValeurVue(valeur);
    if (valeur !== lireNombre(texte)) setTexte(valeur === null ? "" : String(valeur).replace(".", ","));
  }

  return (
    <input
      type="text"
      inputMode={entier ? "numeric" : "decimal"}
      autoComplete="off"
      aria-label={libelle}
      placeholder="–"
      value={texte}
      onChange={(e) => {
        const brut = e.target.value;
        if (!/^\d*[.,]?\d*$/.test(brut)) return;
        setTexte(brut);
        const nombre = lireNombre(brut);
        onChange(nombre === null ? null : entier ? Math.floor(nombre) : Math.round(nombre * 100) / 100);
      }}
      onFocus={(e) => e.currentTarget.select()}
      className={champ}
    />
  );
}

function libellePrecedent(p: SeriePrecedente | undefined): string {
  if (!p) return "–";
  if (p.poids !== null && p.reps !== null) return `${formaterPoids(p.poids)} × ${p.reps}`;
  if (p.reps !== null) return `${p.reps}`;
  if (p.duree !== null) return `${p.duree} s`;
  return "–";
}

const IconeCoche = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/** Un exercice de la séance : en-tête, tableau des séries (précédent, kg, reps, ✓) et actions. */
export function ExerciceBloc({
  exercice,
  onModifierSerie,
  onBasculer,
  onAjouterSerie,
  onRetirerDerniereSerie,
  onRetirerExercice,
  onReposExercice,
}: {
  exercice: ExerciceBrouillon;
  onModifierSerie: (cle: string, serieId: string, champs: Champs) => void;
  onBasculer: (cle: string, serieId: string) => void;
  onAjouterSerie: (cle: string) => void;
  onRetirerDerniereSerie: (cle: string) => void;
  onRetirerExercice: (cle: string) => void;
  onReposExercice: (cle: string, deltaS: number) => void;
}) {
  const [options, setOptions] = useState(false);
  const [apercu, setApercu] = useState(false);
  const { typeMesure, cle } = exercice;
  const aPoids = typeMesure === "poids_reps" || typeMesure === "poids_duree";
  const aReps = typeMesure === "poids_reps" || typeMesure === "reps";
  const aDuree = typeMesure === "duree" || typeMesure === "poids_duree";

  const colonnes = ["32px", "minmax(0,1fr)", aPoids && "68px", aReps && "60px", aDuree && "68px", "48px"]
    .filter(Boolean)
    .join(" ");
  const entete = "text-center text-[11px] font-semibold uppercase tracking-wide text-ink-3";
  const faites = exercice.series.filter((s) => s.fait).length;

  return (
    <section
      className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-3.5 shadow-card"
      aria-label={exercice.nom}
    >
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setApercu(true)}
          aria-label={`Aperçu de ${exercice.nom}`}
          aria-haspopup="dialog"
          className="-m-1 flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
        >
          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-surface-alt">
            {exercice.image && (
              // eslint-disable-next-line @next/next/no-img-element -- images déjà optimisées (WebP 600 px)
              <img
                src={`${URL_IMAGES_SPORT}/${exercice.image}`}
                alt=""
                width={48}
                height={48}
                decoding="async"
                className="h-full w-full object-cover"
              />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={`${nameText} !whitespace-normal`}>{exercice.nom}</span>
            <span className={metaText}>
              {faites}/{exercice.series.length} séries · repos {formaterMinutes(exercice.reposS)}
            </span>
          </span>
        </button>
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
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-alt p-2.5">
          <span className="mr-auto text-[13px] font-medium text-ink-2">Repos prévu</span>
          <button type="button" className={ghostButton} onClick={() => onReposExercice(cle, -15)} aria-label="Retirer 15 secondes de repos">
            −15 s
          </button>
          <span className="min-w-[44px] text-center text-[14px] font-semibold tabular-nums text-ink">
            {formaterMinutes(exercice.reposS)}
          </span>
          <button type="button" className={ghostButton} onClick={() => onReposExercice(cle, 15)} aria-label="Ajouter 15 secondes de repos">
            +15 s
          </button>
          <div className="mt-1 flex w-full gap-2">
            <button
              type="button"
              className={`${ghostButton} flex-1`}
              onClick={() => onRetirerDerniereSerie(cle)}
              disabled={exercice.series.length <= 1}
            >
              Retirer la dernière série
            </button>
            <button type="button" className={`${dangerButton} flex-1`} onClick={() => onRetirerExercice(cle)}>
              Retirer l&apos;exercice
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="grid items-end gap-2" style={{ gridTemplateColumns: colonnes }} aria-hidden="true">
          <span className={entete}>Série</span>
          <span className={entete}>Précédent</span>
          {aPoids && <span className={entete}>kg</span>}
          {aReps && <span className={entete}>reps</span>}
          {aDuree && <span className={entete}>sec</span>}
          <span className={entete}>✓</span>
        </div>

        {exercice.series.map((serie, index) => (
          <div
            key={serie.id}
            className={`grid items-center gap-2 rounded-2xl py-1 transition-colors ${serie.fait ? "bg-kcal-soft" : ""}`}
            style={{ gridTemplateColumns: colonnes }}
          >
            <span className="text-center text-[14px] font-semibold tabular-nums text-ink-2">{index + 1}</span>
            <span className="truncate text-center text-[13px] tabular-nums text-ink-2">
              {libellePrecedent(exercice.precedent[index])}
            </span>
            {aPoids && (
              <ChampNombre
                valeur={serie.poids}
                entier={false}
                libelle={`Poids de la série ${index + 1}, en kilos`}
                onChange={(poids) => onModifierSerie(cle, serie.id, { poids })}
              />
            )}
            {aReps && (
              <ChampNombre
                valeur={serie.reps}
                entier
                libelle={`Répétitions de la série ${index + 1}`}
                onChange={(reps) => onModifierSerie(cle, serie.id, { reps })}
              />
            )}
            {aDuree && (
              <ChampNombre
                valeur={serie.duree}
                entier
                libelle={`Durée de la série ${index + 1}, en secondes`}
                onChange={(duree) => onModifierSerie(cle, serie.id, { duree })}
              />
            )}
            <button
              type="button"
              aria-pressed={serie.fait}
              aria-label={serie.fait ? `Annuler la série ${index + 1}` : `Valider la série ${index + 1}`}
              onClick={() => {
                if (!serie.fait) {
                  deverrouillerAudio();
                  vibrate(15);
                }
                onBasculer(cle, serie.id);
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 transition active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2 ${
                serie.fait ? "border-kcal bg-kcal text-on-kcal" : "border-control-border text-transparent"
              }`}
            >
              <IconeCoche />
            </button>
          </div>
        ))}
      </div>

      <button type="button" className={`${secondaryButton} h-11 !py-0 text-[14px]`} onClick={() => onAjouterSerie(cle)}>
        + Ajouter une série
      </button>

      <AnimatePresence>{apercu && <ApercuExercice exercice={exercice} onClose={() => setApercu(false)} />}</AnimatePresence>
    </section>
  );
}
