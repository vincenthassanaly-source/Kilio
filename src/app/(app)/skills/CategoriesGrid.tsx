"use client";

import { useQuery } from "@tanstack/react-query";
import { TransitionLink } from "@/components/TransitionLink";
import { listerCategoriesAvecCompte } from "@/app/actions/skills";
import { queryKeys } from "@/lib/query/keys";
import { card, errorText } from "@/lib/ui";

// Vue par défaut (pas de recherche active) : une tuile par catégorie avec
// son compteur, pour donner une carte mentale du catalogue plutôt qu'une
// liste plate. Pas de couleur par catégorie (The One Accent Rule) : la
// distinction passe par le libellé et le compteur uniquement.
export function CategoriesGrid() {
  const { data: categories, isLoading, isError } = useQuery({
    queryKey: queryKeys.skillsCategories,
    queryFn: listerCategoriesAvecCompte,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${card} h-24 animate-pulse`} />
        ))}
      </div>
    );
  }

  if (isError) return <p className={errorText}>Erreur de chargement des catégories. Réessaie.</p>;
  if (!categories || categories.length === 0) {
    return <p className="text-ink-2">Aucun skill enregistré pour l&apos;instant.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {categories.map(({ categorie, label, compte }) => (
        <TransitionLink
          key={categorie}
          href={`/skills/${categorie}`}
          className={`${card} flex flex-col gap-1.5 active:scale-[0.97] transition`}
        >
          <p className="font-display text-[15px] font-semibold text-ink">{label}</p>
          <p className="text-[12.5px] text-ink-2">
            {compte} skill{compte > 1 ? "s" : ""}
          </p>
        </TransitionLink>
      ))}
    </div>
  );
}
