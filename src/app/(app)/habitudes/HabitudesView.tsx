"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getHabitudesDuJour } from "@/app/actions/habitudes";
import { queryKeys } from "@/lib/query/keys";
import { AddHabitudeToggle } from "./AddHabitudeToggle";
import { HabitudeCard } from "./HabitudeCard";
import { ArchivesView } from "./ArchivesView";
import { HistoriqueView } from "./HistoriqueView";
import { HabitudesVides } from "./HabitudesVides";
import { HabitudesListeSkeleton } from "./HabitudesSkeleton";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ErrorInline } from "@/components/ErrorInline";
import { showToast } from "@/components/toast/toast-store";

type ViewKey = "aujourdhui" | "historique" | "archives";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "aujourdhui", label: "Aujourd'hui" },
  { key: "historique", label: "Historique" },
  { key: "archives", label: "Archives" },
];

export function HabitudesView({ today }: { today: string }) {
  const [view, setView] = useState<ViewKey>("aujourdhui");
  // Feuille « Nouvelle habitude » : ouverte par le « + » flottant ou l'état vide.
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const queryClient = useQueryClient();

  const { data: habitudes = [], isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.habitudes(today),
    queryFn: () => getHabitudesDuJour(today),
  });

  return (
    <>
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
        // pb-20 : la dernière carte (et son menu « … ») reste dégagée du « + » flottant.
        <div className="flex flex-col gap-4 pb-20">
          {isLoading ? (
            <HabitudesListeSkeleton />
          ) : isError ? (
            <ErrorInline message="Impossible de charger les habitudes." retry={() => refetch()} />
          ) : habitudes.length === 0 ? (
            <HabitudesVides onAjouter={() => setAjoutOuvert(true)} />
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

      {view === "historique" && <HistoriqueView habitudes={habitudes} isError={isError} />}

      {view === "archives" && <ArchivesView />}
    </div>
    </PullToRefresh>
    {/* Hors de PullToRefresh (même raison que Tâches) : le « + » et sa feuille
        ne partagent pas les gestes du tirer-pour-rafraîchir. */}
    {view === "aujourdhui" && (
      <AddHabitudeToggle
        ouvert={ajoutOuvert}
        onOuvertChange={setAjoutOuvert}
        onSaved={() => {
          showToast("Habitude ajoutée");
          void queryClient.invalidateQueries({ queryKey: queryKeys.habitudes(today) });
        }}
      />
    )}
    </>
  );
}
