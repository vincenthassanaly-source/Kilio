import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

export default function HistoriqueLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Historique</h1>
      <Skeleton className="h-20 w-full rounded-[20px]" />
      <Skeleton className="h-20 w-full rounded-[20px]" />
    </div>
  );
}
