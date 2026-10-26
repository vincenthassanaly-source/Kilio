"use client";

import { useQuery } from "@tanstack/react-query";
import { getAnnonce, getReglagesVinted } from "@/app/actions/vinted";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { TransitionLink } from "@/components/TransitionLink";
import { queryKeys } from "@/lib/query/keys";
import { linkButton } from "@/lib/ui";
import { AnnonceEditor } from "./AnnonceEditor";
import { ErrorInline } from "@/components/ErrorInline";

export function AnnonceView({ id }: { id: string }) {
  const annonce = useQuery({ queryKey: queryKeys.vintedAnnonce(id), queryFn: () => getAnnonce(id) });
  const reglages = useQuery({ queryKey: queryKeys.vintedReglages, queryFn: getReglagesVinted });

  if (annonce.isLoading || reglages.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="mt-1 h-6 w-2/5" />
        <Skeleton className="h-40 w-full rounded-[22px]" />
        <Skeleton className="h-72 w-full rounded-[22px]" />
      </div>
    );
  }

  if (annonce.isError || reglages.isError || !annonce.data || !reglages.data) {
    return (
      <div className="flex flex-col gap-3">
        <TransitionLink href="/vinted" className={linkButton}>
          ‹ Vinted
        </TransitionLink>
        {annonce.isError || reglages.isError ? (
          <ErrorInline
            titre="Chargement impossible"
            message="L'annonce n'a pas pu être chargée."
            retry={() => {
              annonce.refetch();
              reglages.refetch();
            }}
          />
        ) : (
          <ErrorInline titre="Annonce introuvable" message="Elle a peut-être été supprimée." />
        )}
      </div>
    );
  }

  return <AnnonceEditor annonce={annonce.data} reglages={reglages.data} />;
}
