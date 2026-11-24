import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { screenTitle } from "@/lib/ui";

export default function RecettesLoading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-9 w-full rounded-2xl" />
      <h1 className={screenTitle}>Recettes</h1>
      <Skeleton className="h-11 w-full rounded-2xl" />
      <ListItemSkeletonGroup count={6} withSubtitle />
    </div>
  );
}
