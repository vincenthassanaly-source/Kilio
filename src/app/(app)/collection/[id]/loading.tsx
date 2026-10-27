import { Skeleton } from "@/components/skeletons/Skeleton";
import { GridSkeleton } from "@/components/skeletons/GridSkeleton";
import { BackLink } from "@/components/BackLink";

export default function CollectionDetailLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <BackLink href="/collection">Collection</BackLink>
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="mt-1 h-6 w-2/5" />
          <div className="flex shrink-0 gap-2">
            <Skeleton className="h-8 w-20 rounded-xl" />
            <Skeleton className="h-8 w-14 rounded-xl" />
          </div>
        </div>
      </div>
      <Skeleton className="h-11 w-full rounded-2xl" />
      <GridSkeleton />
    </div>
  );
}
