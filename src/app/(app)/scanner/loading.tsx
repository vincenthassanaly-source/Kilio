import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

export default function ScannerLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Scanner</h1>
      <Skeleton className="h-10 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-11 w-full rounded-2xl" />
        <Skeleton className="h-11 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-24 w-full rounded-[22px]" />
    </div>
  );
}
