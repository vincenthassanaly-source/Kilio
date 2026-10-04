import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { screenTitle } from "@/lib/ui";

export default function AujourdhuiLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Aujourd&apos;hui</h1>
      <Skeleton className="h-[52vh] w-full rounded-2xl" />
      <ListItemSkeletonGroup count={3} />
    </div>
  );
}
