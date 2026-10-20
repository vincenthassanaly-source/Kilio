import { Suspense } from "react";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { screenTitle } from "@/lib/ui";
import { getToday } from "../../today";
import { CalendrierView } from "../CalendrierView";
import { VerrouGate } from "../VerrouGate";

async function CalendrierDuJour() {
  return (
    <VerrouGate>
      <CalendrierView aujourdhui={await getToday()} />
    </VerrouGate>
  );
}

export default function VidageCalendrierPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <h1 className={screenTitle}>Relire</h1>
          <Skeleton className="h-[60vh] w-full rounded-[22px]" />
        </div>
      }
    >
      <CalendrierDuJour />
    </Suspense>
  );
}
