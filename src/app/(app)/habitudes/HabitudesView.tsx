"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getHabitudesDuJour } from "@/app/actions/habitudes";
import { queryKeys } from "@/lib/query/keys";
import { AddHabitudeToggle } from "./AddHabitudeToggle";
import { HabitudeCard } from "./HabitudeCard";
import { HistoriqueView } from "./HistoriqueView";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ErrorInline } from "@/components/ErrorInline";

type ViewKey = "aujourdhui" | "historique";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "aujourdhui", label: "Aujourd'hui" },
  { key: "historique", label: "Historique" },
];

export function HabitudesView({ today }: { today: string }) {
  const [view, setView] = useState<ViewKey>("aujourdhui");
  const queryClient = useQueryClient();

  const { data: habitudes = [], isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.habitudes(today),
    queryFn: () => getHabitudesDuJour(today),
  });

  return (
    <PullToRefresh
      onRefresh={() => queryClient.invalidateQueries({ queryKey: queryKeys.habitudes(today) })}
    >
    <div className="flex flex-col gap-4">
      {/* Contrôle segmenté partagé (T7) : pastille glissante conservée, mais
          en vert Kcal (l'orange Habitudes n'est qu'une couleur d'identité). */}
      <SegmentedControl
        ariaLabel="Vue des habitudes"
        taille="sm"
        glissant
        options={VIEWS.map((v) => ({ value: v.key, label: v.label }))}
        value={view}
        onChange={setView}
      />

      {view === "aujourdhui" && (
        <div className="flex flex-col gap-4">
          <AddHabitudeToggle
            onSaved={() => queryClient.invalidateQueries({ queryKey: queryKeys.habitudes(today) })}
          />
          {isLoading ? (
            <ListItemSkeletonGroup count={3} withSubtitle />
          ) : isError ? (
            <ErrorInline message="Impossible de charger les habitudes." retry={() => refetch()} />
          ) : habitudes.length === 0 ? (
            <p className="text-ink-2">Aucune habitude pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              <AnimatePresence initial={false}>
                {habitudes.map((habitude) => (
                  <HabitudeCard key={habitude.id} habitude={habitude} date={today} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      )}

      {view === "historique" && <HistoriqueView habitudes={habitudes} />}
    </div>
    </PullToRefresh>
  );
}
