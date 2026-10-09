import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { screenTitle } from "@/lib/ui";

export default function InboxLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Inbox</h1>
      <Skeleton className="h-9 w-40 rounded-xl" />
      <ListItemSkeletonGroup count={3} />
    </div>
  );
}
