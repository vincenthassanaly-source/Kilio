import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";

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
              <Skeleton className="h-3.5 w-20" />
            </div>
            <Skeleton className="h-3.5 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReglagesLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <h1 className={screenTitle}>Réglages</h1>
      <SkeletonGroup rows={2} />
      <SkeletonGroup rows={4} />
      <SkeletonGroup rows={1} />
    </div>
  );
}
