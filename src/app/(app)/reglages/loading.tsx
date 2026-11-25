import { BackLink } from "@/components/BackLink";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

// Le squelette reprend la structure réelle de la page (lien retour, quatre
// sections, même nombre de lignes) : le contenu prend sa place sans faire
// sauter l'écran à l'arrivée des réglages.
function SkeletonGroup({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Skeleton className="h-3.5 w-20" />
      <div className="rounded-card border border-line bg-surface px-4 shadow-card">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center justify-between gap-3 py-3.5 ${i > 0 ? "border-t border-line" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-xl" />
              <Skeleton className="h-3.5 w-28" />
            </div>
            <Skeleton className="h-6 w-10 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonAstuces() {
  return (
    <div className="flex flex-col gap-2.5">
      <Skeleton className="h-3.5 w-16" />
      <div className="rounded-card border border-line bg-surface px-4 shadow-card">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`flex flex-col gap-1.5 py-3.5 ${i > 0 ? "border-t border-line" : ""}`}>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReglagesLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <BackLink href="/plus">Plus</BackLink>
      <h1 className={screenTitle}>Réglages</h1>
      <SkeletonGroup rows={2} />
      <SkeletonGroup rows={6} />
      <SkeletonGroup rows={1} />
      <SkeletonAstuces />
    </div>
  );
}
