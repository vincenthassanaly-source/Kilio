"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { getObjectifs } from "@/app/actions/objectifs";
import { queryKeys } from "@/lib/query/keys";
import type { Enums, Tables } from "@/lib/supabase/types";
import { eyebrow, sectionTitle } from "@/lib/ui";
import { AddObjectifToggle } from "./AddObjectifToggle";
import { ObjectifCard } from "./ObjectifCard";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ErrorInline } from "@/components/ErrorInline";

const CATEGORIE_LABELS: Record<Enums<"categorie_objectif">, string> = {
  perso: "Personnel",
  pro: "Professionnel",
};

const STATUT_LABELS: Record<Enums<"statut_objectif">, string> = {
  en_cours: "En cours",
  atteint: "Atteints",
  abandonne: "Abandonnés",
};

const CATEGORIES_ORDRE: Enums<"categorie_objectif">[] = ["perso", "pro"];
const STATUTS_ORDRE: Enums<"statut_objectif">[] = ["en_cours", "atteint", "abandonne"];

function ObjectifsGroupes({ objectifs }: { objectifs: Tables<"objectifs">[] }) {
  if (objectifs.length === 0) {
    return <p className="text-ink-2">Aucun objectif pour l&apos;instant.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {CATEGORIES_ORDRE.map((categorie) => {
        const parCategorie = objectifs.filter((o) => o.categorie === categorie);
        if (parCategorie.length === 0) return null;

        return (
          <div key={categorie} className="flex flex-col gap-3">
            <h2 className={sectionTitle}>{CATEGORIE_LABELS[categorie]}</h2>
            {STATUTS_ORDRE.map((statut) => {
              const parStatut = parCategorie.filter((o) => o.statut === statut);
              if (parStatut.length === 0) return null;

              return (
                <div key={statut} className="flex flex-col gap-2">
                  <p className={eyebrow}>{STATUT_LABELS[statut]}</p>
                  <ul className="flex flex-col gap-2.5">
                    <AnimatePresence initial={false}>
                      {parStatut.map((objectif) => (
                        <ObjectifCard key={objectif.id} objectif={objectif} />
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function ObjectifsList() {
  const queryClient = useQueryClient();
  const { data: objectifs, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.objectifs,
    queryFn: getObjectifs,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.objectifs });
  }

  return (
    <PullToRefresh onRefresh={invalidate}>
      <div className="flex flex-col gap-4">
        <AddObjectifToggle onSaved={invalidate} />
        {isLoading ? (
          <ListItemSkeletonGroup count={4} withSubtitle />
        ) : isError ? (
          <ErrorInline message="Impossible de charger les objectifs." retry={() => refetch()} />
        ) : (
          <ObjectifsGroupes objectifs={objectifs ?? []} />
        )}
      </div>
    </PullToRefresh>
  );
}
