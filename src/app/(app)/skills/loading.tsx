import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

export default function SkillsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Skills</h1>
      <Skeleton className="h-11 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[22px]" />
        ))}
      </div>
    </div>
  );
}
