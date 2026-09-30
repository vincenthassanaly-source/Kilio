"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CompteAvecSolde } from "@/app/actions/comptes";
import type { Tables } from "@/lib/supabase/types";
import { input } from "@/lib/ui";

// Délai entre la dernière frappe et la navigation (constat Budget P0 n°2).
const DELAI_RECHERCHE_MS = 250;

export function TransactionsFilters({
  comptes,
  categories,
}: {
  comptes: CompteAvecSolde[];
  categories: Tables<"categories_budget">[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Le champ de recherche n'est plus contrôlé par l'URL : chaque caractère
  // reste à l'écran immédiatement (avant, la valeur ne suivait qu'au commit
  // de la navigation et des lettres se perdaient sur réseau mobile).
  const qUrl = searchParams.get("q") ?? "";
  const [recherche, setRecherche] = useState(qUrl);
  // Resynchronise si l'URL change sans passer par la frappe (lien « Effacer »,
  // retour arrière) — dérivé pendant le rendu, sans effet.
  const [qUrlPrecedent, setQUrlPrecedent] = useState(qUrl);
  if (qUrl !== qUrlPrecedent) {
    setQUrlPrecedent(qUrl);
    if (qUrl !== recherche.trim()) setRecherche(qUrl);
  }

  const timerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  // `replace` (et non `push`) : une recherche ou un filtre n'ajoute plus une
  // entrée d'historique par lettre ; « retour » quitte l'écran.
  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/budget/transactions?${query}` : "/budget/transactions", { scroll: false });
    });
  }

  function onRecherche(value: string) {
    setRecherche(value);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => updateParam("q", value.trim()), DELAI_RECHERCHE_MS);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          type="search"
          name="q"
          aria-label="Rechercher un libellé"
          placeholder="Rechercher un libellé…"
          autoComplete="off"
          enterKeyHint="search"
          value={recherche}
          onChange={(e) => onRecherche(e.target.value)}
          className={`${input} w-full py-2 pr-24 text-[13px]`}
        />
        <span
          aria-live="polite"
          className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs text-ink-2"
        >
          {isPending ? "Recherche…" : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Filtrer par compte"
          value={searchParams.get("compte") ?? ""}
          onChange={(e) => updateParam("compte", e.target.value)}
          className={`${input} flex-1 py-2 text-[13px]`}
        >
          <option value="">Tous les comptes</option>
          {comptes.map((compte) => (
            <option key={compte.id} value={compte.id}>
              {compte.nom}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrer par catégorie"
          value={searchParams.get("categorie") ?? ""}
          onChange={(e) => updateParam("categorie", e.target.value)}
          className={`${input} flex-1 py-2 text-[13px]`}
        >
          <option value="">Toutes les catégories</option>
          {categories.map((categorie) => (
            <option key={categorie.id} value={categorie.id}>
              {categorie.icone ? `${categorie.icone} ` : ""}
              {categorie.nom}
            </option>
          ))}
        </select>
        <input
          type="month"
          aria-label="Filtrer par mois"
          value={searchParams.get("mois") ?? ""}
          onChange={(e) => updateParam("mois", e.target.value)}
          className={`${input} min-w-0 max-w-full py-2 text-[13px]`}
        />
      </div>
    </div>
  );
}
