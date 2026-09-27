import { Skeleton } from "./Skeleton";
import { listCard } from "@/lib/ui";

/** Silhouette d'une ligne de liste (tâche, note, article de courses,
 * habitude...) : une puce ronde à cocher + une ou deux lignes de texte.
 * `count` permet d'afficher une pile réaliste sans que chaque appelant
 * ré-écrive la boucle. */
function ListItemSkeleton({ withSubtitle = false }: { withSubtitle?: boolean }) {
  return (
    <div className={`${listCard} flex-row items-center gap-3`}>
      <Skeleton className="h-[22px] w-[22px] shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-3/5" />
        {withSubtitle && <Skeleton className="h-2.5 w-2/5" />}
      </div>
    </div>
  );
}

export function ListItemSkeletonGroup({
  count = 4,
  withSubtitle = false,
}: {
  count?: number;
  withSubtitle?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} withSubtitle={withSubtitle} />
      ))}
    </div>
  );
}
