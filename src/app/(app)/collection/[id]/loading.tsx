import { Skeleton } from "@/components/skeletons/Skeleton";
import { BackLink } from "@/components/BackLink";
import { AjoutsSkeleton, ElementsSkeleton } from "../GrilleSkeleton";

export default function CollectionDetailLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <BackLink href="/collection">Collection</BackLink>
        {/* Nom (22 px) puis « Renommer » et « Supprimer », sous le nom comme à l'écran. */}
        <Skeleton className="mt-1 h-7 w-3/5" />
        <div className="flex gap-2">
          <Skeleton className="h-[35px] w-24 rounded-xl" />
          <Skeleton className="h-[35px] w-24 rounded-xl" />
        </div>
      </div>
      <AjoutsSkeleton />
      <ElementsSkeleton />
    </div>
  );
}
