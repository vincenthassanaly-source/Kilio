import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { screenTitle } from "@/lib/ui";

export default function DocumentsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Documents</h1>
      <Skeleton className="h-16 w-full rounded-card" />
      <ListItemSkeletonGroup count={4} withSubtitle />
    </div>
  );
}
