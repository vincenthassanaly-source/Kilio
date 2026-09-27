"use client";

import { useQuery } from "@tanstack/react-query";
import { listerSkillsParCategorie } from "@/app/actions/skills";
import type { CategorieSkill } from "@/lib/skills/constants";
import { queryKeys } from "@/lib/query/keys";
import { errorText } from "@/lib/ui";
import { SkillCard } from "../SkillCard";

export function CategorieSkillsList({ categorie }: { categorie: CategorieSkill }) {
  const { data: skills, isLoading, isError } = useQuery({
    queryKey: queryKeys.skillsParCategorie(categorie),
    queryFn: () => listerSkillsParCategorie(categorie),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 w-full animate-pulse rounded-[22px] bg-surface-alt" />
        ))}
      </div>
    );
  }

  if (isError) return <p className={errorText}>Erreur de chargement. Réessaie.</p>;
  if (!skills || skills.length === 0) {
    return <p className="text-ink-2">Aucune fiche dans cette catégorie pour l&apos;instant.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {skills.map((skill) => (
        <SkillCard key={skill.id} skill={skill} />
      ))}
    </div>
  );
}
