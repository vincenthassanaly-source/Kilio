"use client";

import { SkillCard } from "./SkillCard";
import type { Skill } from "@/app/actions/skills";
import { CATEGORIE_LABELS, ORDRE_CATEGORIES } from "@/lib/skills/constants";

// Résultats de la recherche live, groupés par catégorie (même logique de
// regroupement que GlobalSearchBar) — affichés en place de la grille de
// catégories dès qu'une recherche est active.
export function SearchResults({ resultats, chargement }: { resultats: Skill[]; chargement: boolean }) {
  if (chargement) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 w-full animate-pulse rounded-[22px] bg-surface-alt" />
        ))}
      </div>
    );
  }

  if (resultats.length === 0) {
    return <p className="px-1 text-[13.5px] text-ink-2">Aucun résultat.</p>;
  }

  const groupes = ORDRE_CATEGORIES.map((categorie) => ({
    categorie,
    items: resultats.filter((r) => r.categorie === categorie),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {groupes.map(({ categorie, items }) => (
        <div key={categorie} className="flex flex-col gap-2.5">
          <span className="px-1 text-[11px] font-bold uppercase tracking-wide text-ink-3">
            {CATEGORIE_LABELS[categorie]}
          </span>
          {items.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      ))}
    </div>
  );
}
