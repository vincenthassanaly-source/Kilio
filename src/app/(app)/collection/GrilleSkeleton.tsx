import { Skeleton } from "@/components/skeletons/Skeleton";

// Silhouettes propres à Collection : tuiles carrées sur deux colonnes, comme
// le rendu final (la grille masonry partagée, à hauteurs variables, faisait
// sauter la mise en page à l'arrivée des données).

/** Grille des collections : couverture carrée, nom et nombre d'éléments. */
export function CollectionsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex flex-col gap-1.5">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </li>
      ))}
    </ul>
  );
}

/** Grille des éléments d'une collection : vignettes carrées. */
export function ElementsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <Skeleton className="aspect-square w-full rounded-2xl" />
        </li>
      ))}
    </ul>
  );
}

/** Boutons d'ajout de la page d'une collection (photo, galerie, lien vidéo). */
export function AjoutsSkeleton() {
  return (
    <div className="flex flex-col gap-1.5" aria-hidden="true">
      <div className="flex gap-2">
        <Skeleton className="h-[46px] flex-1 rounded-2xl" />
        <Skeleton className="h-[46px] flex-1 rounded-2xl" />
      </div>
      <Skeleton className="h-[46px] w-full rounded-2xl" />
    </div>
  );
}
