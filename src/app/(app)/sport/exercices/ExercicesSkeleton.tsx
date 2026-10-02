import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";

/** Contenu de /sport/exercices en attente de la bibliothèque : partagé par
 * loading.tsx et le <Suspense> de page.tsx. */
export function ExercicesSkeleton() {
  return (
    <>
      <Skeleton className="h-11 w-full rounded-2xl" />
      <Skeleton className="h-9 w-full rounded-full" />
      <ListItemSkeletonGroup count={6} withSubtitle />
    </>
  );
}
