import { Skeleton } from "@/components/skeletons/Skeleton";
import { CardSkeleton } from "@/components/skeletons/CardSkeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { sectionTitle } from "@/lib/ui";
import { BackLink } from "@/components/BackLink";

export default function RecetteDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackLink href="/nutrition/recettes">Recettes</BackLink>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="mt-1 h-6 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <div className="flex shrink-0 gap-2">
            <Skeleton className="h-8 w-16 rounded-xl" />
            <Skeleton className="h-8 w-14 rounded-xl" />
          </div>
        </div>
      </div>

      <CardSkeleton withRing={false} />

      <div className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Ingrédients</h2>
        <ListItemSkeletonGroup count={4} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Étapes</h2>
        <ListItemSkeletonGroup count={3} withSubtitle />
      </div>
    </div>
  );
}
