import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

/** Coque affichée pendant que le jour et la feuille se chargent (loading.tsx et Suspense). */
export function FeuilleChargement({ titre = "Journal" }: { titre?: string }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Réserve la place du lien de retour de la feuille : le titre ne saute pas à l'arrivée du contenu. */}
      <div className="h-5" aria-hidden="true" />
      <h1 className={screenTitle}>{titre}</h1>
      <Skeleton className="h-[60vh] w-full rounded-card" />
    </div>
  );
}
