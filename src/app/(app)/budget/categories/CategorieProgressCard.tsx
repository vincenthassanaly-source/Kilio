"use client";

import { useActionState, useTransition } from "react";
import { upsertBudget, type BudgetFormState, type SuiviCategorie } from "@/app/actions/budgets";
import { supprimerCategorie } from "@/app/actions/categories-budget";
import type { Enums, Tables } from "@/lib/supabase/types";
import { formatMontant } from "@/lib/budget/compute";
import { card, dangerButton, errorText, input, linkButton } from "@/lib/ui";
import { confirmDelete } from "@/lib/confirm";
import type { StatutBudget } from "@/lib/budget/compute";
import { AddSousCategorieToggle } from "./AddSousCategorieToggle";
import { runAction } from "@/lib/actions/runAction";

const STATUT_COLOR: Record<StatutBudget, string> = {
  ok: "var(--accent-kcal)",
  // Ambre (Graduated Alert Rule, T8) : le jaune Glucides est réservé aux macros.
  proche: "var(--accent-warning)",
  depasse: "var(--accent-alert)",
};

const initialState: BudgetFormState = { error: null };

function SousCategorieRow({ categorie }: { categorie: Tables<"categories_budget"> }) {
  const [isPending, startTransition] = useTransition();

  return (
    <li className="flex items-center justify-between gap-2 rounded-xl bg-surface-alt/60 px-3 py-2">
      <p className="text-[13.5px] font-medium text-ink">
        {categorie.icone && <span className="mr-1.5">{categorie.icone}</span>}
        {categorie.nom}
      </p>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirmDelete(`Supprimer la catégorie « ${categorie.nom} » ?`)) return;
          startTransition(async () => {
              // Contrat T1 : échec en toast, jamais error.tsx.
              await runAction(() => supprimerCategorie(categorie.id));
            });
        }}
        className={dangerButton}
      >
        Suppr.
      </button>
    </li>
  );
}

export function CategorieProgressCard({
  suivi,
  periode,
  typePeriode,
  sousCategories,
}: {
  suivi: SuiviCategorie;
  periode: string;
  typePeriode: Enums<"type_periode_budget">;
  sousCategories: Tables<"categories_budget">[];
}) {
  const [state, formAction, pending] = useActionState(upsertBudget, initialState);
  const pct =
    suivi.cible > 0
      ? Math.min(100, Math.round((suivi.consomme / suivi.cible) * 100))
      : suivi.consomme > 0
        ? 100
        : 0;
  const color = STATUT_COLOR[suivi.statut];

  return (
    <li className={`${card} flex flex-col gap-2.5`}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[14.5px] font-semibold text-ink">
          {suivi.categorie.icone && <span>{suivi.categorie.icone}</span>}
          {suivi.categorie.nom}
        </p>
        <span className={`text-[12.5px] font-mono ${suivi.statut === "depasse" ? "text-alert" : "text-ink-2"}`}>
          {formatMontant(suivi.consomme)}
          {suivi.cible > 0 && ` / ${formatMontant(suivi.cible)}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-alt">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {/* `key={periode}` : remonte le formulaire au changement de période pour
          que `defaultValue` (non contrôlé) reflète bien le montant cible de
          la période affichée, plutôt que de garder celui de la période
          précédente jusqu'à une saisie manuelle. */}
      <form key={periode} action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="categorie_id" value={suivi.categorie.id} />
        <input type="hidden" name="periode" value={periode} />
        <input type="hidden" name="type_periode" value={typePeriode} />
        <input
          name="montant_cible"
          type="number"
          step="0.01"
          min="0"
          defaultValue={suivi.cible || undefined}
          placeholder={
            typePeriode === "hebdomadaire"
              ? "Budget cible de la semaine"
              : typePeriode === "annuel"
                ? "Budget cible de l'année"
                : "Budget cible du mois"
          }
          className={`${input} min-w-0 flex-1 py-1.5 text-[13px]`}
        />
        <button type="submit" disabled={pending} className={`${linkButton} shrink-0 disabled:opacity-60`}>
          {pending ? "…" : "Définir"}
        </button>
      </form>
      {state.error && (
        <p className={errorText} role="alert">
          {state.error}
        </p>
      )}
      {sousCategories.length > 0 && (
        <ul className="flex flex-col gap-1.5 pl-1">
          {sousCategories.map((sc) => (
            <SousCategorieRow key={sc.id} categorie={sc} />
          ))}
        </ul>
      )}
      <AddSousCategorieToggle categorieParentId={suivi.categorie.id} />
    </li>
  );
}
