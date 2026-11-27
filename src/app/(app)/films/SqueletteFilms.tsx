import { Skeleton } from "@/components/skeletons/Skeleton";

/** Silhouette d'une liste de films : affiche 2:3, deux lignes de texte, une ligne de plateformes. */
export function SqueletteFilms({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-row border border-line bg-surface p-3 shadow-card">
          <Skeleton className="h-24 w-16 shrink-0 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2 py-1">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="mt-auto h-6 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
