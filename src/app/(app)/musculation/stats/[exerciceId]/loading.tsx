import { BackLink } from "@/components/BackLink";
import { Skeleton } from "@/components/skeletons/Skeleton";

export default function FicheExerciceLoading() {
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/musculation/stats">Statistiques</BackLink>
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-48 w-full rounded-card" />
    </div>
  );
}
