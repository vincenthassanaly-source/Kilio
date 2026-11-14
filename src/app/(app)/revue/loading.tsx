import { BackLink } from "@/components/BackLink";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

// Même ossature que la page (lien de retour, titre, puis les trois blocs
// d'entrée de RevueView) : le titre ne saute pas quand le contenu arrive.
export default function RevueLoading() {
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/">Aujourd&apos;hui</BackLink>
      <h1 className={screenTitle}>Revue de la semaine</h1>
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-[76px] w-full rounded-card" />
        <Skeleton className="h-60 w-full rounded-card" />
        <Skeleton className="h-48 w-full rounded-card" />
      </div>
    </div>
  );
}
