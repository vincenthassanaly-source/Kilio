"use client";

import { useQuery } from "@tanstack/react-query";
import { getIdee } from "@/app/actions/opinions";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { TransitionLink } from "@/components/TransitionLink";
import { queryKeys } from "@/lib/query/keys";
import { errorText, linkButton } from "@/lib/ui";
import { IdeeEditor } from "./IdeeEditor";

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
        <TransitionLink href="/opinions" className={linkButton}>
          ‹ Opinions
        </TransitionLink>
        <p className={errorText} role="alert">
          {idee.isError ? "Erreur de chargement de l'idée." : "Idée introuvable."}
        </p>
      </div>
    );
  }

  return <IdeeEditor key={idee.data.id} idee={idee.data} />;
}
