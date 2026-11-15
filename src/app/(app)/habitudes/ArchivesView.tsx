"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getHabitudesArchivees } from "@/app/actions/habitudes";
import { queryKeys } from "@/lib/query/keys";
import { parseISODate } from "@/lib/date/iso";
import { ErrorInline } from "@/components/ErrorInline";
import { cardTight, metaText } from "@/lib/ui";
import { HabitudesListeSkeleton } from "./HabitudesSkeleton";

/**
 * Habitudes archivées, en lecture seule. « Archiver » retire une habitude
 * d'Aujourd'hui sans rien effacer : son historique reste en base, et c'est ici
 * qu'on la retrouve. Relue à chaque ouverture : une habitude qui vient d'être
 * archivée doit y figurer tout de suite.
 */
export function ArchivesView() {
  const { data: archivees = [], isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.habitudesArchivees,
    queryFn: getHabitudesArchivees,
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (isLoading) return <HabitudesListeSkeleton />;
  if (isError) {
    return <ErrorInline message="Impossible de charger les archives." retry={() => void refetch()} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-label text-ink-2">
        Une habitude archivée n&apos;apparaît plus dans Aujourd&apos;hui ; son historique est conservé.
      </p>
      {archivees.length === 0 ? (
        <p className="py-6 text-center text-ink-2">Aucune habitude archivée.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {archivees.map((habitude) => (
            <li key={habitude.id} className={`${cardTight} flex flex-col gap-0.5`}>
              <span className="min-w-0 break-words text-body font-semibold text-ink">{habitude.nom}</span>
              <span className={metaText}>
                {habitude.archivee_le
                  ? `Archivée le ${format(parseISODate(habitude.archivee_le), "d MMMM yyyy", { locale: fr })}`
                  : "Archivée"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
