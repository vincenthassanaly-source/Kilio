import { BackLink } from "@/components/BackLink";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

// Même ossature que HistoriqueView (retour, titre et « + Séance passée ») : rien ne saute à l'arrivée des données.
export default function HistoriqueLoading() {
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/musculation">Musculation</BackLink>
      <div className="flex items-center justify-between gap-3">
        <h1 className={screenTitle}>Historique</h1>
        <Skeleton className="h-9 w-36 rounded-xl" />
      </div>
      <Skeleton className="h-20 w-full rounded-row" />
      <Skeleton className="h-20 w-full rounded-row" />
    </div>
  );
}
