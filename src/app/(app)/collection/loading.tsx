import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";
import { CollectionsSkeleton } from "./GrilleSkeleton";

export default function CollectionLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Collection</h1>
      {/* Carte « Ajouter une collection » ; « Réorganiser » n'apparaît qu'avec
          les données, comme dans le squelette client de CollectionsGrid. */}
      <Skeleton className="h-[72px] w-full rounded-card" />
      <CollectionsSkeleton />
    </div>
  );
}
