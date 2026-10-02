import { Skeleton } from "@/components/skeletons/Skeleton";

export default function ExerciceLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="aspect-[3/2] w-full rounded-[22px]" />
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}
