import { Skeleton } from "./Skeleton";

/** En-tête (date + salutation) du dashboard, en attente de la date du jour :
 * fallback du <Suspense> de l'en-tête dans src/app/(app)/page.tsx. */
export function DashboardHeaderSkeleton() {
  return (
    <header className="flex flex-col gap-1.5">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-6 w-44" />
    </header>
  );
}
