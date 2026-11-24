import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { screenTitle } from "@/lib/ui";

export default function DocumentsLoading() {
  return (
    <div className="flex flex-col gap-4">
      {/* Même hauteur que la rangée titre + menu « … » (44 px) et place de la
          recherche : la page ne saute pas quand le contenu arrive. */}
      <div className="flex min-h-11 items-center">
        <h1 className={screenTitle}>Documents</h1>
      </div>
      <Skeleton className="h-[46px] w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-card" />
      <ListItemSkeletonGroup count={4} withSubtitle />
    </div>
  );
}
