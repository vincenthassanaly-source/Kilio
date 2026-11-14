import { Skeleton } from "@/components/skeletons/Skeleton";
import { listCard } from "@/lib/ui";

/** Silhouette d'une carte d'habitude : anneau de 34 px, nom, ligne de détail
 * et rangée « Modifier / Supprimer » — à la hauteur réelle (≈ 105 px) pour que
 * le contenu n'écrase pas la page en arrivant. */
function HabitudeCardSkeleton() {
  return (
    <div className={`${listCard} min-h-[105px]`} aria-hidden="true">
      <div className="flex items-start gap-3">
        <Skeleton className="h-[34px] w-[34px] shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <Skeleton className="h-3.5 w-3/5" />
          <Skeleton className="h-2.5 w-2/5" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-[88px] rounded-xl" />
        <Skeleton className="h-8 w-[102px] rounded-xl" />
      </div>
    </div>
  );
}

/** Liste de cartes en attente : partagée entre la coquille de la page et le
 * chargement de la requête côté client. */
export function HabitudesListeSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <HabitudeCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Contenu de /habitudes en attente de la date du jour et des données :
 * partagé par loading.tsx et le <Suspense> de page.tsx. */
export function HabitudesSkeleton() {
  return (
    <>
      <Skeleton className="h-[52px] w-full rounded-2xl" />
      <Skeleton className="h-[72px] w-full rounded-card" />
      <HabitudesListeSkeleton />
    </>
  );
}
