import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { card } from "@/lib/ui";
import { BackLink } from "@/components/BackLink";

export default function ObjectifDetailLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <BackLink href="/objectifs">Objectifs</BackLink>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="mt-1 h-6 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <div className="flex shrink-0 gap-2">
            <Skeleton className="h-8 w-16 rounded-xl" />
            <Skeleton className="h-8 w-14 rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-9 w-32 rounded-2xl" />
      </div>

      <div className={`${card} flex flex-col gap-3`}>
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-[100px] w-full rounded-xl" />
        <ListItemSkeletonGroup count={3} />
      </div>
    </div>
  );
}
