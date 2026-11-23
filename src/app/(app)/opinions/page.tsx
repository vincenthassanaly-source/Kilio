import { Suspense } from "react";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { screenTitle } from "@/lib/ui";
import { OpinionsView } from "./OpinionsView";

// Shell serveur : les idées sont chargées côté client via TanStack Query dans
// OpinionsView, avec un skeleton pendant isLoading. Suspense : OpinionsView lit
// l'onglet et les filtres dans l'URL (`useSearchParams`).
export default function OpinionsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Opinions</h1>
      <Suspense fallback={<ListItemSkeletonGroup withSubtitle />}>
        <OpinionsView />
      </Suspense>
    </div>
  );
}
