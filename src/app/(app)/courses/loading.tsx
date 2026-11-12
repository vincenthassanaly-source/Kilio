import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { screenTitle } from "@/lib/ui";

export default function CoursesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Courses</h1>
      <Skeleton className="h-[70px] w-full rounded-card" />
      <ListItemSkeletonGroup count={5} />
    </div>
  );
}
