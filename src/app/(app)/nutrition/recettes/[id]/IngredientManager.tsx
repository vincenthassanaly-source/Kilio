"use client";

import { useActionState, useDeferredValue, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
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
  errorText,
  ghostButton,
  input,
  nameTextComplet,
  primaryButton,
} from "@/lib/ui";
import { runAction } from "@/lib/actions/runAction";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { useMasques } from "@/lib/actions/elementsMasques";
import { nutritionAliment, rechercherCatalogue, type CatalogueAliment } from "@/lib/nutrition/compute";
import { boutonSupprimerLigne } from "../../suppressionLigne";

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
            <span className="text-small text-ink-2">{UNITE_LABEL[ingredient.unite]}</span>
          </div>
        ) : (
          <p className="text-caption tabular-nums text-ink-2">
            {Number(ingredient.quantite).toLocaleString("fr-FR")} {UNITE_LABEL[ingredient.unite]}
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
                  // `runAction` : l'échec (retourné ou réseau) devient un message,
                  // jamais une exception qui remonterait à l'écran d'erreur.
                  const resultat = await runAction(() => updateIngredient(ingredient.id, recetteId, n), { silencieux: true });
                  if (resultat.ok) setEditing(false);
                  else setError(resultat.error);
                });
              }}
              className={ghostButton}
            >
              {isPending ? "Enregistrement…" : "Enregistrer"}
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
              Modifier
            </button>
            <button
              type="button"
              onClick={() =>
                // Suppression différée : la ligne disparaît tout de suite,
                // « Annuler » la ramène pendant le délai du toast. Les macros de
                // la recette (calculées côté serveur) suivent à l'expiration.
                supprimerAvecAnnulation({
                  texte: `« ${ingredient.aliment.nom} » retiré de la recette`,
                  ariaLabel: `Annuler le retrait de « ${ingredient.aliment.nom} »`,
                  masque: { type: "recette-ingredient", id: ingredient.id },
                  supprimer: () => removeIngredient(ingredient.id, recetteId),
                  erreur: `Impossible de retirer « ${ingredient.aliment.nom} ». Réessaie.`,
                })
              }
              aria-label={`Retirer « ${ingredient.aliment.nom} »`}
              className={boutonSupprimerLigne}
            >
              Retirer
            </button>
          </>
        )}
      </div>
    </li>
  );
}

const initialState: IngredientFormState = { error: null };

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

/** Aliments de la base au format du catalogue du Carnet, pour réutiliser sa recherche. */
function versCatalogue(aliments: Tables<"aliments">[]): CatalogueAliment[] {
  return aliments.map((a) => ({
    type: "aliment",
    id: a.id,
    nom: a.nom,
    categorie: a.categorie,
    unite: a.unite,
    poidsUniteG: a.poids_unite_g,
    par100: nutritionAliment(a, 100),
  }));
}

/**
 * Ajout d'un ingrédient : recherche dans les aliments (même recherche
 * tolérante aux accents que le Carnet, `rechercherCatalogue`) au lieu d'un
 * menu déroulant de toute la base, puis quantité.
 */
function AddIngredientForm({
  recetteId,
  aliments,
}: {
  recetteId: string;
  aliments: Tables<"aliments">[];
}) {
  const uid = useId();
  const [state, formAction, pending] = useActionState(addIngredient, initialState);
  const [alimentId, setAlimentId] = useState("");
  const [requete, setRequete] = useState("");
  const requeteDifferee = useDeferredValue(requete);
  const formRef = useRef<HTMLFormElement>(null);
  const prevPending = useRef(pending);
  const catalogue = useMemo(() => versCatalogue(aliments), [aliments]);
  const resultats = useMemo(
    () => rechercherCatalogue(catalogue, requeteDifferee, 8) as CatalogueAliment[],
    [catalogue, requeteDifferee]
  );

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      formRef.current?.reset();
      setAlimentId("");
      setRequete("");
    }
    prevPending.current = pending;
  }, [pending, state.error]);

  if (aliments.length === 0) {
    return (
      <p className="text-small text-ink-2">
        Aucun aliment en base pour l&apos;instant : impossible de composer cette recette. Demande à Claude d&apos;en ajouter dans le chat, puis reviens ici.
      </p>
    );
  }

  const selected = aliments.find((a) => a.id === alimentId);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="recette_id" value={recetteId} />
      <input type="hidden" name="aliment_id" value={alimentId} />
      <input type="hidden" name="unite" value={selected?.unite ?? ""} />

      {selected ? (
        <div className="flex items-center gap-2">
          <p className={`${nameTextComplet} min-w-0 flex-1 font-semibold`}>{selected.nom}</p>
          <button type="button" onClick={() => setAlimentId("")} className={ghostButton}>
            Changer
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-recherche`} className="sr-only">
            Rechercher un ingrédient
          </label>
          <input
            id={`${uid}-recherche`}
            type="search"
            value={requete}
            onChange={(e) => setRequete(e.target.value)}
            placeholder="Rechercher un ingrédient…"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className={input}
          />
          {requete.trim() !== "" &&
            (resultats.length === 0 ? (
              <p className="px-1 py-2 text-small text-ink-2">Aucun aliment pour « {requete.trim()} ».</p>
            ) : (
              <ul className="-mx-1 flex flex-col" aria-label="Aliments trouvés">
                {resultats.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setAlimentId(a.id)}
                      className={`flex min-h-11 w-full items-center rounded-xl px-2 text-left transition-colors hover:bg-surface-alt ${focusRing}`}
                    >
                      <span className={nameTextComplet}>{a.nom}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}

      {selected && (
        <div className="flex items-center gap-2">
          <label htmlFor={`${uid}-quantite`} className="text-label font-medium text-ink">
            Quantité
          </label>
          <input
            id={`${uid}-quantite`}
            name="quantite"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            required
            className={`w-24 ${input}`}
          />
          <span className="text-small text-ink-2">{UNITE_LABEL[selected.unite]}</span>
        </div>
      )}

      {state.error && (
        <p className={errorText} role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending || !selected} className={primaryButton}>
        {pending ? "Ajout…" : "Ajouter l'ingrédient"}
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
