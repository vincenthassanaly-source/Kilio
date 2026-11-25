import { Skeleton } from "@/components/skeletons/Skeleton";
import { NAV_ITEMS } from "@/lib/navigation/registry";
import { card, screenTitle } from "@/lib/ui";

export default function PlusLoading() {
  return (
    <div className="flex flex-col gap-4">
      {/* Même en-tête que la page (min-h-8 réservé au bouton « Terminé »). */}
      <div className="flex min-h-8 items-center">
        <h1 className={screenTitle}>Plus</h1>
      </div>
      {/* Réserve la place de l'indice « Appui long » : pas de saut à l'arrivée. */}
      <Skeleton className="h-[62px] w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: NAV_ITEMS.length }).map((_, i) => (
          <div key={i} className={`${card} flex flex-col gap-2.5`}>
            <Skeleton className="h-10 w-10 rounded-xl" />
            {/* Lignes calées sur les hauteurs de ligne réelles (nom 15 px et
                description 13 px sur deux lignes, interligne 1,5) : la
                tuile squelette a la hauteur d'une vraie tuile (≈ 146 px). */}
            <div className="flex flex-col">
              <div className="flex h-[22.5px] items-center">
                <Skeleton className="h-3.5 w-3/5" />
              </div>
              <div className="flex h-[19.5px] items-center">
                <Skeleton className="h-2.5 w-4/5" />
              </div>
              <div className="flex h-[19.5px] items-center">
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
