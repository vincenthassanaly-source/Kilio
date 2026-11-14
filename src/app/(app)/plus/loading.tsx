import { Skeleton } from "@/components/skeletons/Skeleton";
import { NAV_ITEMS } from "@/lib/navigation/registry";
import { card, screenTitle } from "@/lib/ui";

export default function PlusLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Plus</h1>
      {/* Réserve la place de l'indice « Appui long » : pas de saut à l'arrivée. */}
      <Skeleton className="h-[62px] w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: NAV_ITEMS.length }).map((_, i) => (
          <div key={i} className={`${card} flex flex-col gap-2.5`}>
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-2.5 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
