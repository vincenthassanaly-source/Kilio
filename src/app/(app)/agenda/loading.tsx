import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

export default function AgendaLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Agenda</h1>
      <Skeleton className="h-10 w-full rounded-2xl" />
      <Skeleton className="h-[55vh] w-full rounded-2xl" />
    </div>
  );
}
