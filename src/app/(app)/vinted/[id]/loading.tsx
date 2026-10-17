import { Skeleton } from "@/components/skeletons/Skeleton";

export default function AnnonceVintedLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="mt-1 h-6 w-2/5" />
      <Skeleton className="h-40 w-full rounded-[22px]" />
      <Skeleton className="h-72 w-full rounded-[22px]" />
    </div>
  );
}
