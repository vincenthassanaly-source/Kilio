import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

export default function SportLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Sport</h1>
      <Skeleton className="h-[72px] w-full rounded-[20px]" />
    </div>
  );
}
