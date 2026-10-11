import { Skeleton } from "@/components/skeletons/Skeleton";

export default function SeanceLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-64 w-full rounded-[22px]" />
    </div>
  );
}
