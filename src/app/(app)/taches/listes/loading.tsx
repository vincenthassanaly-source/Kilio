import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle, sectionTitle } from "@/lib/ui";
import { BackLink } from "@/components/BackLink";

export default function ListesTachesLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className={screenTitle}>Listes &amp; tags</h1>
        <BackLink href="/taches">Tâches</BackLink>
      </div>

      <div className="flex flex-col gap-2.5">
        <h2 className={sectionTitle}>Listes</h2>
        <Skeleton className="h-[74px] w-full rounded-2xl" />
        <Skeleton className="h-[74px] w-full rounded-2xl" />
        <Skeleton className="h-[74px] w-full rounded-2xl" />
      </div>

      <div className="flex flex-col gap-2.5">
        <h2 className={sectionTitle}>Tags</h2>
        <Skeleton className="h-[74px] w-full rounded-2xl" />
        <Skeleton className="h-[74px] w-full rounded-2xl" />
      </div>
    </div>
  );
}
