import { Skeleton } from "./Skeleton";

const HEIGHTS = [150, 190, 130, 170, 140, 200];

/** Grille masonry (2 colonnes) de silhouettes à hauteur variable, pour les
 * modules en mosaïque (Notes, Collection) pendant le chargement — évite le
 * bloc uniforme qui ne ressemble pas au rendu final en colonnes. */
export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="columns-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="mb-3 break-inside-avoid">
          <Skeleton className="w-full rounded-card" style={{ height: HEIGHTS[i % HEIGHTS.length] }} />
        </li>
      ))}
    </ul>
  );
}
