import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";
import { SqueletteFilms } from "./SqueletteFilms";

export default function FilmsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Films</h1>
      <Skeleton className="h-[52px] w-full rounded-2xl" />
      <Skeleton className="h-11 w-full rounded-2xl" />
      <SqueletteFilms />
    </div>
  );
}
