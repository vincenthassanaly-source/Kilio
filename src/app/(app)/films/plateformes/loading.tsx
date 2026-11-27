import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

export default function PlateformesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="mt-1 h-5 w-20" />
      <h1 className={screenTitle}>Mes plateformes</h1>
      <div className="flex flex-col gap-2.5" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-row" />
        ))}
      </div>
    </div>
  );
}
