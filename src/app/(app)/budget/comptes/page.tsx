import { Suspense } from "react";
import { connection } from "next/server";
import { getComptesAvecSoldeEnCache } from "@/lib/budget/cache";
import { screenTitle } from "@/lib/ui";
import { AddCompteToggle } from "./AddCompteToggle";
import { ComptesList } from "./ComptesList";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";

export default function ComptesPage() {
  return (
    <PullToRefresh>
      <div className="flex flex-col gap-4">
        <h1 className={screenTitle}>Comptes</h1>
        <AddCompteToggle />
        <Suspense fallback={<ListItemSkeletonGroup count={4} withSubtitle />}>
          <Comptes />
        </Suspense>
      </div>
    </PullToRefresh>
  );
}

async function Comptes() {
  await connection();
  return <ComptesList comptes={await getComptesAvecSoldeEnCache()} />;
}
