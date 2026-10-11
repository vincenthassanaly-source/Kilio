import { Skeleton } from "@/components/skeletons/Skeleton";

export default function FicheExerciceLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-48 w-full rounded-[22px]" />
    </div>
  );
}
