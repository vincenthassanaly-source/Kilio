"use client";

import { useId, useActionState, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { upsertObjectif, type ObjectifFormState } from "@/app/actions/objectifs-nutritionnels";
import type { Tables } from "@/lib/supabase/types";
import { JOURS_SEMAINE, type JourType } from "@/lib/nutrition/planning";
import { card, errorText, input, label as labelClass, linkButton, primaryButton, secondaryButton } from "@/lib/ui";

const initialState: ObjectifFormState = { error: null };

type Objectif = Tables<"objectifs_nutritionnels"> | null;

const TITRES: Record<JourType, string> = { repos: "Jour de repos", entrainement: "Jour d'entraînement" };

/** Les quatre champs de cible d'un type de jour (noms `<type>_<champ>`). */
function ChampsCible({ jourType, objectif, uid }: { jourType: JourType; objectif: Objectif; uid: string }) {
  const champ = (nom: string) => `${jourType}_${nom}`;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold text-ink">{TITRES[jourType]}</legend>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-${champ("kcal_cible")}`} className={labelClass}>
            Kcal cible
          </label>
          <input
            id={`${uid}-${champ("kcal_cible")}`}
            name={champ("kcal_cible")}
            type="number"
            inputMode="numeric"
            min="0"
            max="10000"
            step="1"
            placeholder={jourType === "repos" ? "ex. 2000" : "ex. 2400"}
            defaultValue={objectif?.kcal_cible ?? ""}
            className={input}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-${champ("proteines_cible_g")}`} className={labelClass}>
            Protéines (g)
          </label>
          <input
            id={`${uid}-${champ("proteines_cible_g")}`}
            name={champ("proteines_cible_g")}
            type="number"
            inputMode="numeric"
            min="0"
            max="1000"
            step="1"
            defaultValue={objectif?.proteines_cible_g ?? 0}
            className={input}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-${champ("glucides_cible_g")}`} className={labelClass}>
            Glucides (g)
          </label>
          <input
            id={`${uid}-${champ("glucides_cible_g")}`}
            name={champ("glucides_cible_g")}
            type="number"
            inputMode="numeric"
            min="0"
            max="1000"
            step="1"
            defaultValue={objectif?.glucides_cible_g ?? 0}
            className={input}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-${champ("lipides_cible_g")}`} className={labelClass}>
            Lipides (g)
          </label>
          <input
            id={`${uid}-${champ("lipides_cible_g")}`}
            name={champ("lipides_cible_g")}
            type="number"
            inputMode="numeric"
            min="0"
            max="1000"
            step="1"
            defaultValue={objectif?.lipides_cible_g ?? 0}
            className={input}
          />
        </div>
      </div>
    </fieldset>
  );
}

export function ObjectifForm({
  repos,
  entrainement,
  jours,
}: {
  repos: Objectif;
  entrainement: Objectif;
  /** Planning : jours ISO (1 = lundi … 7 = dimanche) d'entraînement. */
  jours: readonly number[];
}) {
  // Ids uniques par instance (T11) : formulaire rendu en ajout et en édition.
  const uid = useId();
  const [open, setOpen] = useState(!repos && !entrainement);
  const [state, formAction, pending] = useActionState(upsertObjectif, initialState);
  const queryClient = useQueryClient();

  // `upsertObjectif` (Server Action) appelle `revalidatePath`, qui n'a aucun
  // effet sur DashboardNutritionSection (lit `queryKeys.resumeNutrition` via
  // TanStack Query) : sans cette invalidation explicite, le dashboard garde
  // l'ancienne cible jusqu'à 30s après l'enregistrement (CLICK-PATH-203).
  const prevPending = useRef(pending);
  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
    }
    prevPending.current = pending;
  }, [pending, state.error, queryClient]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={linkButton}>
        Modifier les objectifs et le planning
      </button>
    );
  }

  return (
    <form
      action={formAction}
      // Empêche un drag sur un champ/bouton du formulaire (ex. ajuster un
      // input number) d'être lu comme un swipe de changement de jour par
      // JournalSwipeWrapper — voir la même garde sur le bouton "Suppr." de
      // JournalEntriesList.tsx.
      onTouchStart={(e) => e.stopPropagation()}
      className={`${card} flex flex-col gap-4`}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-ink">Jours d&apos;entraînement</legend>
        <div className="flex gap-1.5">
          {JOURS_SEMAINE.map((jour) => (
            <label key={jour.iso} className="relative flex-1">
              <input
                type="checkbox"
                name="jours_entrainement"
                value={jour.iso}
                defaultChecked={jours.includes(jour.iso)}
                className="peer sr-only"
              />
              <span className="sr-only">{jour.long}</span>
              <span
                aria-hidden="true"
                className="flex min-h-11 items-center justify-center rounded-xl bg-surface-alt text-[13.5px] font-semibold text-ink-2 transition-colors peer-checked:bg-kcal peer-checked:text-on-kcal peer-focus-visible:ring-2 peer-focus-visible:ring-kcal peer-focus-visible:ring-offset-2"
              >
                {jour.court}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-2 text-pretty">
          Les autres jours ont l&apos;objectif de repos. Aucun jour coché : repos tous les jours.
        </p>
      </fieldset>

      <ChampsCible jourType="repos" objectif={repos} uid={uid} />
      <ChampsCible jourType="entrainement" objectif={entrainement} uid={uid} />

      {state.error && (
        <p className={errorText} role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
        {(repos || entrainement) && (
          <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
            Fermer
          </button>
        )}
      </div>
    </form>
  );
}
