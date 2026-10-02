import { Skeleton } from "@/components/skeletons/Skeleton";

export default function RoutineLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-40 w-full rounded-[22px]" />
    </div>
  );
}
