import { notFound } from "next/navigation";
import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { listerSkillsParCategorie } from "@/app/actions/skills";
import { CATEGORIE_LABELS, ORDRE_CATEGORIES, type CategorieSkill } from "@/lib/skills/constants";
import { CategorieSkillsList } from "./CategorieSkillsList";
import { screenTitle } from "@/lib/ui";

function estCategorieValide(value: string): value is CategorieSkill {
  return (ORDRE_CATEGORIES as readonly string[]).includes(value);
}

export default async function CategorieSkillsPage({ params }: { params: Promise<{ categorie: string }> }) {
  const { categorie } = await params;
  if (!estCategorieValide(categorie)) notFound();

  await connection();
  const queryClient = makeServerQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.skillsParCategorie(categorie),
    queryFn: () => listerSkillsParCategorie(categorie),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>{CATEGORIE_LABELS[categorie]}</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CategorieSkillsList categorie={categorie} />
      </HydrationBoundary>
    </div>
  );
}
