import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

export default function ReglagesVintedLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="mt-1 h-5 w-20" />
      <h1 className={screenTitle}>Réglages Vinted</h1>
      <Skeleton className="h-40 w-full rounded-[22px]" />
      <Skeleton className="h-28 w-full rounded-[22px]" />
    </div>
  );
}
