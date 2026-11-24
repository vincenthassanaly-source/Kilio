import { Skeleton } from "@/components/skeletons/Skeleton";
import { listCard } from "@/lib/ui";

/** Silhouette d'une carte d'habitude : anneau de 34 px, nom et menu « … »,
 * à la hauteur réelle d'une carte à cocher (≈ 63 px) pour que le contenu ne
 * fasse pas sauter la page en arrivant. Les `!` passent devant le
 * `rounded-lg` par défaut du primitif. */
function HabitudeCardSkeleton() {
  return (
    <div className={listCard} aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="h-[34px] w-[34px] shrink-0 rounded-full!" />
        <Skeleton className="h-3.5 w-3/5" />
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
 * partagé par loading.tsx et le <Suspense> de page.tsx. Contrôle segmenté
 * (52 px) puis la liste, comme l'écran réel. */
export function HabitudesSkeleton() {
  return (
    <>
      <Skeleton className="h-[52px] w-full rounded-2xl!" />
      <HabitudesListeSkeleton />
    </>
  );
}
