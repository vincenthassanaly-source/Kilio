import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";

/** Contenu de /habitudes en attente de la date du jour et des données :
 * partagé par loading.tsx et le <Suspense> de page.tsx. */
export function HabitudesSkeleton() {
  return (
    <>
      <Skeleton className="h-10 w-full rounded-2xl" />
      <Skeleton className="h-[70px] w-full rounded-2xl" />
      <ListItemSkeletonGroup count={3} withSubtitle />
    </>
  );
}
