"use client";

import { useQuery } from "@tanstack/react-query";
import { getIdee } from "@/app/actions/opinions";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { queryKeys } from "@/lib/query/keys";
import { IdeeEditor } from "./IdeeEditor";
import { ErrorInline } from "@/components/ErrorInline";
import { BackLink } from "@/components/BackLink";

export function IdeeView({ id }: { id: string }) {
  const idee = useQuery({ queryKey: queryKeys.opinionsIdee(id), queryFn: () => getIdee(id) });

  if (idee.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="mt-1 h-6 w-2/5" />
        <Skeleton className="h-52 w-full rounded-[22px]" />
        <Skeleton className="h-72 w-full rounded-[22px]" />
      </div>
    );
  }

  if (idee.isError || !idee.data) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink href="/opinions">Opinions</BackLink>
        {idee.isError ? (
          <ErrorInline titre="Chargement impossible" message="L'idée n'a pas pu être chargée." retry={() => idee.refetch()} />
        ) : (
          <ErrorInline titre="Idée introuvable" message="Elle a peut-être été supprimée." />
        )}
      </div>
    );
  }

  return <IdeeEditor key={idee.data.id} idee={idee.data} />;
}
