"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { getObjectif } from "@/app/actions/objectifs";
import { queryKeys } from "@/lib/query/keys";
import { TransitionLink } from "@/components/TransitionLink";
import { card, errorText, linkButton } from "@/lib/ui";
import { ObjectifHeader } from "./ObjectifHeader";
import { ObjectifSuiviBinaire } from "./ObjectifSuiviBinaire";
import { ObjectifSuiviEtapes } from "./ObjectifSuiviEtapes";
import { ObjectifSuiviValeur } from "./ObjectifSuiviValeur";
import { ObjectifSuiviHabitudes } from "./ObjectifSuiviHabitudes";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";

// Shell client (et non plus Server Component) : l'objectif est chargé via
// TanStack Query (voir /taches, même patron), pour partager le cache avec
// les mutations optimistes de ObjectifSuiviEtapes/ObjectifSuiviBinaire.
// `notFound()` de next/navigation n'est documenté que pour les Server
// Components/Server Functions/Route Handlers (cf.
// node_modules/next/dist/docs/.../not-found.md) : un objectif introuvable
// affiche donc un message inline plutôt que la page 404 native.
export default function ObjectifDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: detail, isLoading, isError } = useQuery({
    queryKey: queryKeys.objectif(id),
    queryFn: () => getObjectif(id),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="mt-1 h-6 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
        <div className={`${card} flex flex-col gap-3`}>
          <Skeleton className="h-3.5 w-28" />
          <ListItemSkeletonGroup count={3} />
        </div>
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="flex flex-col gap-3">
        <TransitionLink href="/objectifs" className={linkButton}>
          ‹ Objectifs
        </TransitionLink>
        <p className={errorText}>
          {isError ? "Erreur de chargement de l'objectif." : "Objectif introuvable."}
        </p>
      </div>
    );
  }

  const { objectif, etapes, entries, habitudes, progression } = detail;

  return (
    <div className="flex flex-col gap-5">
      <ObjectifHeader objectif={objectif} />

      {objectif.type_suivi === "valeur" && (
        <ObjectifSuiviValeur objectifId={id} objectif={objectif} entries={entries} />
      )}
      {objectif.type_suivi === "etapes" && (
        <ObjectifSuiviEtapes objectifId={id} etapes={etapes} />
      )}
      {objectif.type_suivi === "binaire" && <ObjectifSuiviBinaire objectif={objectif} />}
      {objectif.type_suivi === "habitudes" && (
        <ObjectifSuiviHabitudes objectif={objectif} habitudes={habitudes} progression={progression ?? 0} />
      )}
    </div>
  );
}
