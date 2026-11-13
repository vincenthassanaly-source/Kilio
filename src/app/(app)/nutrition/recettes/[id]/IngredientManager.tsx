"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addIngredient,
  removeIngredient,
  updateIngredient,
  type IngredientFormState,
} from "@/app/actions/recette-ingredients";
import type { Tables } from "@/lib/supabase/types";
import {
  actionsLigne,
  cardTight,
  dangerButton,
  errorText,
  ghostButton,
  input,
  nameTextComplet,
  primaryButton,
} from "@/lib/ui";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { useMasques } from "@/lib/actions/elementsMasques";

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
    <li className={`${cardTight} flex flex-col gap-2`}>
      <div className="min-w-0">
        <p className={nameTextComplet}>{ingredient.aliment.nom}</p>
        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              aria-label={`Quantité de ${ingredient.aliment.nom}`}
              className={`w-24 ${input}`}
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
      <div className={actionsLigne}>
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
              onClick={() =>
                // Suppression différée : la ligne disparaît tout de suite,
                // « Annuler » la ramène pendant le délai du toast. Les macros de
                // la recette (calculées côté serveur) suivent à l'expiration.
                supprimerAvecAnnulation({
                  texte: `Ingrédient « ${ingredient.aliment.nom} » supprimé`,
                  ariaLabel: `Annuler la suppression de l'ingrédient « ${ingredient.aliment.nom} »`,
                  masque: { type: "recette-ingredient", id: ingredient.id },
                  supprimer: () => removeIngredient(ingredient.id, recetteId),
                  erreur: `Impossible de supprimer l'ingrédient « ${ingredient.aliment.nom} ». Réessaie.`,
                })
              }
              aria-label={`Supprimer l'ingrédient « ${ingredient.aliment.nom} »`}
              className={dangerButton}
            >
              Supprimer
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
        Aucun aliment en base pour l&apos;instant : impossible de composer cette recette.
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
          aria-label="Ingrédient"
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
          inputMode="decimal"
          step="0.1"
          min="0"
          required
          disabled={!selected}
          placeholder={selected ? UNITE_LABEL[selected.unite] : "Quantité"}
          aria-label="Quantité de l'ingrédient"
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
  // Ingrédients en cours de suppression (toast « Annuler » encore affiché) : cachés.
  const masques = useMasques("recette-ingredient");
  const visibles = ingredients.filter((i) => !masques.has(i.id));
  return (
    <div className="flex flex-col gap-3">
      {visibles.length === 0 ? (
        hideEmptyMessage ? null : <p className="text-sm text-ink-2">Aucun ingrédient pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {visibles.map((ing) => (
            <IngredientLine key={ing.id} ingredient={ing} recetteId={recetteId} />
          ))}
        </ul>
      )}

      <AddIngredientForm recetteId={recetteId} aliments={aliments} />
    </div>
  );
}
