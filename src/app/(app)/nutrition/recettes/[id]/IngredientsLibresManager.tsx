"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addIngredientLibre,
  removeIngredientLibre,
  updateIngredientLibre,
  type IngredientLibreFormState,
} from "@/app/actions/recette-ingredients-libres";
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
import { confirmDelete } from "@/lib/confirm";

type IngredientLibreRow = Tables<"recette_ingredients_libres">;

function IngredientLibreLine({
  ingredient,
  recetteId,
}: {
  ingredient: IngredientLibreRow;
  recetteId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState(ingredient.nom);
  const [quantite, setQuantite] = useState(ingredient.quantite ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className={`${cardTight} flex flex-col gap-2`}>
      <div className="min-w-0">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className={`text-sm ${input}`}
            />
            <input
              type="text"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              placeholder="Quantité (ex. 1 sachet)"
              className={`text-sm ${input}`}
            />
          </div>
        ) : (
          <>
            <p className={nameTextComplet}>{ingredient.nom}</p>
            {ingredient.quantite && <p className="text-xs text-ink-2">{ingredient.quantite}</p>}
          </>
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
                startTransition(async () => {
                  try {
                    await updateIngredientLibre(ingredient.id, recetteId, nom, quantite);
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
                setNom(ingredient.nom);
                setQuantite(ingredient.quantite ?? "");
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
                if (!confirmDelete(`Supprimer l'ingrédient « ${ingredient.nom} » ?`)) return;
                setError(null);
                startTransition(async () => {
                  try {
                    await removeIngredientLibre(ingredient.id, recetteId);
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

const initialState: IngredientLibreFormState = { error: null };

function AddIngredientLibreForm({ recetteId }: { recetteId: string }) {
  const [state, formAction, pending] = useActionState(addIngredientLibre, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const prevPending = useRef(pending);

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      formRef.current?.reset();
    }
    prevPending.current = pending;
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="recette_id" value={recetteId} />

      <div className="flex gap-2">
        <input name="nom" placeholder="Ingrédient" required className={`min-w-0 flex-1 ${input}`} />
        <input name="quantite" placeholder="Quantité" className={`w-28 ${input}`} />
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

export function IngredientsLibresManager({
  recetteId,
  ingredients,
}: {
  recetteId: string;
  ingredients: IngredientLibreRow[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {ingredients.length === 0 ? (
        <p className="text-sm text-ink-2">Aucun ingrédient pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {ingredients.map((ing) => (
            <IngredientLibreLine key={ing.id} ingredient={ing} recetteId={recetteId} />
          ))}
        </ul>
      )}

      <AddIngredientLibreForm recetteId={recetteId} />
    </div>
  );
}
