import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { screenTitle } from "@/lib/ui";

export default function OpinionsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Opinions</h1>
      <Skeleton className="h-11 w-full rounded-2xl" />
      <Skeleton className="h-11 w-full rounded-2xl" />
      <ListItemSkeletonGroup withSubtitle />
    </div>
  );
}
