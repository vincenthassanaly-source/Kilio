import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

export default function MusculationLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Musculation</h1>
      <Skeleton className="h-28 w-full rounded-[22px]" />
    </div>
  );
}
