import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { listerCategoriesAvecCompte } from "@/app/actions/skills";
import { SkillsView } from "./SkillsView";
import { screenTitle } from "@/lib/ui";

// Server Component async : précharge les catégories côté serveur (même
// patron que CoursesPage), hydraté avant que SkillsView ne prenne le relais
// côté client pour la recherche live et la navigation par catégorie.
export default async function SkillsPage() {
  await connection();
  const queryClient = makeServerQueryClient();
  await queryClient.prefetchQuery({ queryKey: queryKeys.skillsCategories, queryFn: listerCategoriesAvecCompte });

  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Skills</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <SkillsView />
      </HydrationBoundary>
    </div>
  );
}
