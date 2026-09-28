"use client";

import { useEffect, useState, useTransition } from "react";
import { rechercherSkills, type Skill } from "@/app/actions/skills";
import { runAction } from "@/lib/actions/runAction";
import { input, secondaryButton } from "@/lib/ui";
import { CategoriesGrid } from "./CategoriesGrid";
import { SearchResults } from "./SearchResults";
import { SuggestionModal } from "./SuggestionModal";

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.5-4.5" />
    </svg>
  );
}

// Barre de recherche toujours visible (même pattern que GlobalSearchBar) :
// vide -> grille de catégories, saisie -> résultats filtrés groupés par
// catégorie en place de la grille.
export function SkillsView() {
  const [query, setQuery] = useState("");
  const [resultats, setResultats] = useState<Skill[]>([]);
  const [isPending, startTransition] = useTransition();
  const [modalOuverte, setModalOuverte] = useState(false);

  const rechercheActive = query.trim().length >= 2;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;

    const timeout = setTimeout(() => {
      startTransition(async () => {
        const resultat = await runAction(() => rechercherSkills(q), { silencieux: true });
        if (resultat.ok) setResultats(resultat.data);
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un skill…"
            className={`${input} w-full pl-10`}
          />
        </div>
        <button type="button" onClick={() => setModalOuverte(true)} className={`${secondaryButton} self-start`}>
          Aide-moi à choisir
        </button>
      </div>

      {rechercheActive ? (
        <SearchResults resultats={isPending ? [] : resultats} chargement={isPending} />
      ) : (
        <CategoriesGrid />
      )}

      {modalOuverte && <SuggestionModal onClose={() => setModalOuverte(false)} />}
    </div>
  );
}
