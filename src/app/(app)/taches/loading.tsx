import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { screenTitle } from "@/lib/ui";

export default function TachesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Tâches</h1>
      {/* Mêmes gabarits que le contrôle segmenté et la barre de recherche. */}
      <Skeleton className="h-[52px] w-full rounded-2xl" />
      <Skeleton className="h-12 w-full rounded-2xl" />
      <ListItemSkeletonGroup count={5} />
    </div>
  );
}
