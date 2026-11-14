import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

// Même ossature que AgendaView : sélecteur de vue, en-tête de période, grille.
export default function AgendaLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Agenda</h1>
      <Skeleton className="h-[52px] w-full rounded-2xl" />
      <Skeleton className="h-11 w-full rounded-2xl" />
      <Skeleton className="h-[55vh] w-full rounded-2xl" />
    </div>
  );
}
