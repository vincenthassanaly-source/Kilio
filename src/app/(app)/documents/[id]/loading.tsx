import { Skeleton } from "@/components/skeletons/Skeleton";

export default function DocumentDetailLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-64 w-full rounded-card" />
    </div>
  );
}
