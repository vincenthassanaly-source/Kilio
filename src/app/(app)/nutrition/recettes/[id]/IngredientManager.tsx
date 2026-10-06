"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addIngredient,
  removeIngredient,
  updateIngredient,
  type IngredientFormState,
} from "@/app/actions/recette-ingredients";
import type { Tables } from "@/lib/supabase/types";
import { cardTight, dangerButton, errorText, ghostButton, input, nameText, primaryButton } from "@/lib/ui";
import { confirmDelete } from "@/lib/confirm";

const UNITE_LABEL: Record<string, string> = { g: "g", ml: "ml", piece: "pièce" };

type IngredientRow = Tables<"recette_ingredients"> & {
  aliment: Tables<"aliments">;
};

function IngredientLine({
  ingredient,
  recetteId,
}: {
  ingredient: IngredientRow;
  recetteId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [quantite, setQuantite] = useState(String(ingredient.quantite));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className={`${cardTight} flex items-center justify-between gap-3`}>
      <div className="min-w-0">
        <p className={nameText}>{ingredient.aliment.nom}</p>
        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              min="0"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              className="w-24 rounded-lg border border-line px-2 py-1 text-sm text-ink"
            />
            <span className="text-sm text-ink-2">{UNITE_LABEL[ingredient.unite]}</span>
          </div>
        ) : (
          <p className="text-xs text-ink-2">
            {ingredient.quantite} {UNITE_LABEL[ingredient.unite]}
          </p>
        )}
        {error && <p className={errorText}>{error}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        {editing ? (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setError(null);
                const n = Number(quantite);
                startTransition(async () => {
                  try {
                    await updateIngredient(ingredient.id, recetteId, n);
                    setEditing(false);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Erreur inconnue.");
                  }
                });
              }}
              className={ghostButton}
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => {
                setQuantite(String(ingredient.quantite));
                setEditing(false);
              }}
              className={ghostButton}
            >
              Annuler
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
              Éditer
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (!confirmDelete(`Supprimer l'ingrédient « ${ingredient.aliment.nom} » ?`)) return;
                setError(null);
                startTransition(async () => {
                  try {
                    await removeIngredient(ingredient.id, recetteId);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Erreur inconnue.");
                  }
                });
              }}
              className={dangerButton}
            >
              Suppr.
            </button>
          </>
        )}
      </div>
    </li>
  );
}

const initialState: IngredientFormState = { error: null };

function AddIngredientForm({
  recetteId,
  aliments,
}: {
  recetteId: string;
  aliments: Tables<"aliments">[];
}) {
  const [state, formAction, pending] = useActionState(addIngredient, initialState);
  const [alimentId, setAlimentId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const prevPending = useRef(pending);

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      formRef.current?.reset();
      setAlimentId("");
    }
    prevPending.current = pending;
  }, [pending, state.error]);

  if (aliments.length === 0) {
    return (
      <p className="text-sm text-ink-2">
        Ajoute d&apos;abord des aliments dans l&apos;onglet Aliments pour pouvoir composer cette
        recette.
      </p>
    );
  }

  const selected = aliments.find((a) => a.id === alimentId);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="recette_id" value={recetteId} />
      <input type="hidden" name="unite" value={selected?.unite ?? ""} />

      <div className="flex gap-2">
        <select
          name="aliment_id"
          value={alimentId}
          onChange={(e) => setAlimentId(e.target.value)}
          required
          className={`min-w-0 flex-1 ${input}`}
        >
          <option value="" disabled>
            Choisir un ingrédient…
          </option>
          {aliments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nom}
            </option>
          ))}
        </select>
        <input
          name="quantite"
          type="number"
          step="0.1"
          min="0"
          required
          disabled={!selected}
          placeholder={selected ? UNITE_LABEL[selected.unite] : "Quantité"}
          className={`w-24 ${input}`}
        />
      </div>

      {state.error && (
        <p className={errorText} role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Ajout..." : "+ Ajouter l'ingrédient"}
      </button>
    </form>
  );
}

export function IngredientManager({
  recetteId,
  ingredients,
  aliments,
  hideEmptyMessage = false,
}: {
  recetteId: string;
  ingredients: IngredientRow[];
  aliments: Tables<"aliments">[];
  hideEmptyMessage?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {ingredients.length === 0 ? (
        hideEmptyMessage ? null : <p className="text-sm text-ink-2">Aucun ingrédient pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {ingredients.map((ing) => (
            <IngredientLine key={ing.id} ingredient={ing} recetteId={recetteId} />
          ))}
        </ul>
      )}

      <AddIngredientForm recetteId={recetteId} aliments={aliments} />
    </div>
  );
}
