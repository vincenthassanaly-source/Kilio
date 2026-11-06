import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

export default function RevueLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Revue de la semaine</h1>
      <Skeleton className="h-40 w-full rounded-card" />
      <Skeleton className="h-56 w-full rounded-card" />
    </div>
  );
}
