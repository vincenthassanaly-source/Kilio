import { Skeleton } from "@/components/skeletons/Skeleton";
import { GridSkeleton } from "@/components/skeletons/GridSkeleton";
import { screenTitle } from "@/lib/ui";

export default function NotesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Notes</h1>
      {/* Silhouette de la carte « Ajouter une note » (≈ 72 px), puis de la recherche. */}
      <Skeleton className="h-[72px] w-full rounded-card" />
      <Skeleton className="h-11 w-full rounded-2xl" />
      <GridSkeleton />
    </div>
  );
}
