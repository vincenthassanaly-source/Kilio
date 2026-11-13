import { Suspense } from "react";
import { connection } from "next/server";
import { getCategoriesAvecCompte } from "@/app/actions/documents-categories";
import { BackLink } from "@/components/BackLink";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { screenTitle } from "@/lib/ui";
import { CategoriesManager } from "./CategoriesManager";

// Seule la liste lit la base : l'en-tête (titre, retour) reste dans la
// coquille statique. Avant, `connection()` en tête de page renvoyait toute
// la page derrière documents/loading.tsx, dont le titre est « Documents ».
async function CategoriesListe() {
  await connection();
  const categories = await getCategoriesAvecCompte();
  return <CategoriesManager categories={categories} />;
}

// Mêmes blocs que documents/loading.tsx (carte du formulaire, liste).
function CategoriesListeSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-16 w-full rounded-card" />
      <ListItemSkeletonGroup count={4} withSubtitle />
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <BackLink href="/documents">Documents</BackLink>
        <h1 className={screenTitle}>Catégories</h1>
      </div>

      <Suspense fallback={<CategoriesListeSkeleton />}>
        <CategoriesListe />
      </Suspense>
    </div>
  );
}
