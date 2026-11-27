import { Skeleton } from "@/components/skeletons/Skeleton";

export default function FicheLoading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="mt-1 h-5 w-20" />
      <div className="flex gap-4">
        <Skeleton className="h-[168px] w-28 shrink-0 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-3.5 w-2/5" />
        </div>
      </div>
      <Skeleton className="h-11 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-card" />
    </div>
  );
}
