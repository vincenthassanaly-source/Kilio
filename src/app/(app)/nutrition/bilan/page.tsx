import { Suspense } from "react";
import { NutritionSubNav } from "@/components/NutritionSubNav";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { card, screenTitle } from "@/lib/ui";
import { BilanContenu } from "./BilanContenu";

// Coquille statique (sous-navigation + titre) ; le contenu dépend de la date
// du jour et de Supabase, il arrive en streaming sous <Suspense>.
function BilanSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      <div className={`${card} flex flex-col gap-4`}>
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-3.5 w-3/5" />
      </div>
      <div className={`${card} flex flex-col gap-4`}>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-3.5 w-2/5" />
      </div>
    </div>
  );
}

export default function BilanPage() {
  return (
    <PullToRefresh>
      <div className="flex flex-col gap-5">
        <NutritionSubNav />
        <h1 className={screenTitle}>Bilan</h1>
        <Suspense fallback={<BilanSkeleton />}>
          <BilanContenu />
        </Suspense>
      </div>
    </PullToRefresh>
  );
}
