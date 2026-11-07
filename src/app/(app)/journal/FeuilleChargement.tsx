import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

/** Coque affichée pendant que le jour et la feuille se chargent (loading.tsx et Suspense). */
export function FeuilleChargement() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Journal</h1>
      <Skeleton className="h-[60vh] w-full rounded-card" />
    </div>
  );
}
