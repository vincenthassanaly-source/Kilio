"use client";

import { useId, useActionState, useEffect, useRef, useState } from "react";
import {
  createRecette,
  updateRecette,
  type RecetteFormState,
} from "@/app/actions/recettes";
import type { Enums, Tables } from "@/lib/supabase/types";
import { errorText, input, label as labelClass, primaryButton } from "@/lib/ui";
import { SegmentedControl } from "@/components/SegmentedControl";

const initialState: RecetteFormState = { error: null };

type NutritionFieldKey =
  | "kcal_portion"
  | "kcal_100g"
  | "proteines_portion"
  | "proteines_100g"
  | "glucides_portion"
  | "glucides_100g"
  | "sucres_portion"
  | "sucres_100g"
  | "lipides_portion"
  | "lipides_100g"
  | "satures_portion"
  | "satures_100g"
  | "fibres_portion"
  | "fibres_100g"
  | "sel_portion"
  | "sel_100g";

const NUTRITION_FIELDS: { key: NutritionFieldKey; label: string }[] = [
  { key: "kcal_portion", label: "Kcal / portion" },
  { key: "kcal_100g", label: "Kcal / 100g" },
  { key: "proteines_portion", label: "Protéines / portion (g)" },
  { key: "proteines_100g", label: "Protéines / 100g" },
  { key: "glucides_portion", label: "Glucides / portion (g)" },
  { key: "glucides_100g", label: "Glucides / 100g" },
  { key: "sucres_portion", label: "dont sucres / portion (g)" },
  { key: "sucres_100g", label: "dont sucres / 100g" },
  { key: "lipides_portion", label: "Lipides / portion (g)" },
  { key: "lipides_100g", label: "Lipides / 100g" },
  { key: "satures_portion", label: "dont saturés / portion (g)" },
  { key: "satures_100g", label: "dont saturés / 100g" },
  { key: "fibres_portion", label: "Fibres / portion (g)" },
  { key: "fibres_100g", label: "Fibres / 100g" },
  { key: "sel_portion", label: "Sel / portion (g)" },
  { key: "sel_100g", label: "Sel / 100g" },
];

export function RecetteForm({
  recette,
  onDone,
}: {
  recette?: Tables<"recettes">;
  onDone?: () => void;
}) {
  // Ids uniques par instance (T11) : formulaire rendu en ajout et en édition.
  const uid = useId();
  const action = recette ? updateRecette : createRecette;
  const [state, formAction, pending] = useActionState(action, initialState);
  const prevPending = useRef(pending);
  const [source, setSource] = useState<Enums<"recette_source">>(recette?.source ?? "manuel");
  const [nutritionOpen, setNutritionOpen] = useState(
    recette ? recette.kcal_portion != null : false
  );

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      onDone?.();
    }
    prevPending.current = pending;
  }, [pending, state.error, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {recette && <input type="hidden" name="id" value={recette.id} />}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-nom`} className={labelClass}>
          Nom
        </label>
        <input id={`${uid}-nom`} name="nom" required defaultValue={recette?.nom} className={input} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-description`} className={labelClass}>
          Description
        </label>
        <textarea
          id={`${uid}-description`}
          name="description"
          rows={2}
          defaultValue={recette?.description ?? ""}
          className={input}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-temps_prepa_min`} className={labelClass}>
            Préparation (min)
          </label>
          <input
            id={`${uid}-temps_prepa_min`}
            name="temps_prepa_min"
            type="number"
            min="0"
            step="1"
            defaultValue={recette?.temps_prepa_min ?? ""}
            className={input}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-portions`} className={labelClass}>
            Portions
          </label>
          <input
            id={`${uid}-portions`}
            name="portions"
            type="number"
            min="1"
            step="1"
            required
            defaultValue={recette?.portions ?? 1}
            className={input}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelClass}>Source</span>
        <SegmentedControl
          ariaLabel="Source"
          name="source"
          taille="sm"
          options={[
            { value: "manuel", label: "Manuel" },
            { value: "hellofresh", label: "HelloFresh" },
          ]}
          value={source}
          onChange={setSource}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-ustensiles`} className={labelClass}>
          Ustensiles (un par ligne)
        </label>
        <textarea
          id={`${uid}-ustensiles`}
          name="ustensiles"
          rows={3}
          defaultValue={recette?.ustensiles?.join("\n") ?? ""}
          className={input}
        />
      </div>

      {source === "hellofresh" && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line p-3">
          <button
            type="button"
            onClick={() => setNutritionOpen((o) => !o)}
            className="flex items-center justify-between text-left"
          >
            <span className={labelClass}>Valeurs nutritionnelles (si imprimées)</span>
            <span className="text-sm text-ink-2">{nutritionOpen ? "−" : "+"}</span>
          </button>
          {nutritionOpen && (
            <div className="grid grid-cols-2 gap-2.5">
              {NUTRITION_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-1">
                  <label htmlFor={field.key} className="text-xs text-ink-2">
                    {field.label}
                  </label>
                  <input
                    id={field.key}
                    name={field.key}
                    type="number"
                    min="0"
                    step="0.1"
                    defaultValue={recette ? (recette[field.key] ?? "") : ""}
                    className={input}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state.error && (
        <p className={errorText} role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Enregistrement..." : recette ? "Enregistrer" : "Créer la recette"}
      </button>
    </form>
  );
}
