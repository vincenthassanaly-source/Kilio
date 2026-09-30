import Link from "next/link";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { formatPeriode, periodeAdjacente } from "@/lib/budget/compute";
import { ghostButton } from "@/lib/ui";

/**
 * « ← Précédent · mois · Suivant → » des Statistiques et du Calendrier.
 * Sans `periode` (fallback de `<Suspense>`, donc dans la coquille), même
 * cadre, inactif, le temps que la période soit lue dans l'URL.
 */
export function PeriodeNavigation({ route, periode }: { route: string; periode?: string }) {
  if (!periode) {
    return (
      <div className="flex items-center justify-between gap-2" aria-hidden="true">
        <span className={`${ghostButton} opacity-50`}>← Précédent</span>
        <Skeleton className="h-4 w-28" />
        <span className={`${ghostButton} opacity-50`}>Suivant →</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <Link href={`${route}?periode=${periodeAdjacente(periode, "mensuel", -1)}`} replace className={ghostButton}>
        ← Précédent
      </Link>
      <p className="text-[13px] font-semibold text-ink">{formatPeriode(periode)}</p>
      <Link href={`${route}?periode=${periodeAdjacente(periode, "mensuel", 1)}`} replace className={ghostButton}>
        Suivant →
      </Link>
    </div>
  );
}
