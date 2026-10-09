"use client";

import { useMemo, useRef } from "react";
import { addDays, format, isSameDay, isToday, startOfToday, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import type { TacheAvecRelations } from "@/app/actions/taches";
import type { Evenement } from "@/app/actions/evenements";
import type { Tables } from "@/lib/supabase/types";
import { getCreneauxDuJour } from "@/lib/agenda/planning-travail";
import { layoutChevauchements } from "@/lib/agenda/compute";
import { TaskCard } from "../taches/TasksList";
import { ArchivedTasksSection } from "./ArchivedTasksSection";
import { PeriodHeader } from "./PeriodHeader";
import { parseISODate } from "@/lib/date/iso";
import { sortByHeure } from "./date-utils";
import {
  computeInitialScrollMinutes,
  gridHeight,
  HourLines,
  NowLine,
  TimeGutter,
  useInitialScroll,
  WorkHoursBand,
} from "./TimeGrid";
import { TacheBlock } from "./TacheBlock";
import { EvenementBlock } from "../aujourdhui/EvenementBlock";
import { evenementsHoraires, evenementsJourneeEntiere } from "@/lib/evenements/compute";
import { useAgendaZoom } from "./useAgendaZoom";

export function DayView({
  taches,
  listes,
  tags,
  creneaux,
  exceptions,
  evenements = [],
  selectedDate,
  onChangeDate,
  tacheEnSurbrillanceId = null,
  onSelectTache,
  onSelectEvenement,
}: {
  taches: TacheAvecRelations[];
  listes: Tables<"listes_taches">[];
  tags: Tables<"tags">[];
  creneaux: Tables<"horaires_travail_creneaux">[];
  exceptions: Tables<"horaires_travail_exceptions">[];
  // Événements légers de la fenêtre chargée (le jour affiché est filtré ici).
  evenements?: Evenement[];
  selectedDate: Date;
  onChangeDate: (date: Date) => void;
  // Tâche visée par un deep-link de notification (cf. AgendaView) : mise en
  // surbrillance + scrollée en vue, qu'elle soit dans la liste active ou
  // archivée du jour. `null` en usage normal (aucune mise en surbrillance).
  tacheEnSurbrillanceId?: string | null;
  // Tap sur un bloc de la grille (cf. AgendaView) : surligne la tâche et la
  // scrolle en vue dans la liste ci-dessous.
  onSelectTache: (id: string) => void;
  // Tap sur un événement de la grille : ouvre son édition (cf. AgendaView).
  onSelectEvenement?: (evenement: Evenement) => void;
}) {
  // Les tâches sans heure sont regroupées après celles ayant une heure
  // (cohérent avec le tri "échéance nullsFirst: false" déjà utilisé par la
  // page Tâches). Mémorisé : ne dépend que de `taches`/`selectedDate`, pas de
  // `zoom`, qui change à chaque frame pendant le geste de pincement/molette
  // (cf. useAgendaZoom) — sans ce useMemo, layoutChevauchements et les
  // filtres/tris ci-dessous étaient recalculés à chaque frame de zoom.
  const { dayTaches, dayTachesArchivees, dayTachesAvecHeure, dayTachesSansHeure, dayEvenements, dayJourneeEntiere, positions } = useMemo(() => {
    const dayTachesJour = taches.filter(
      (t) => t.echeance && isSameDay(parseISODate(t.echeance), selectedDate)
    );

    const dayTaches = dayTachesJour.filter((t) => !t.fait).sort(sortByHeure);
    const dayTachesArchivees = dayTachesJour.filter((t) => t.fait).sort(sortByHeure);

    const dayTachesAvecHeure = dayTaches.filter((t) => t.heure);
    const dayTachesSansHeure = dayTachesJour.filter((t) => !t.fait && !t.heure);
    const evenementsDuJour = evenements.filter((e) => isSameDay(parseISODate(e.date), selectedDate));
    const dayEvenements = evenementsHoraires(evenementsDuJour);
    const dayJourneeEntiere = evenementsJourneeEntiere(evenementsDuJour);
    // Tâches horodatées et événements se partagent la largeur de la grille.
    const positions = layoutChevauchements([...dayTachesAvecHeure, ...dayEvenements]);

    return { dayTaches, dayTachesArchivees, dayTachesAvecHeure, dayTachesSansHeure, dayEvenements, dayJourneeEntiere, positions };
  }, [taches, evenements, selectedDate]);

  const creneauxJour = getCreneauxDuJour(creneaux, selectedDate, exceptions);
  const { zoom, touchHandlers } = useAgendaZoom();
  const scrollRef = useRef<HTMLDivElement>(null);
  useInitialScroll(
    scrollRef,
    computeInitialScrollMinutes({ showCurrentTime: isToday(selectedDate), creneaux: creneauxJour }),
    zoom
  );

  return (
    <div className="flex flex-col gap-3">
      <PeriodHeader
        title={format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
        prevLabel="Jour précédent"
        nextLabel="Jour suivant"
        onPrev={() => onChangeDate(subDays(selectedDate, 1))}
        onNext={() => onChangeDate(addDays(selectedDate, 1))}
        showToday={!isToday(selectedDate)}
        onToday={() => onChangeDate(startOfToday())}
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {dayJourneeEntiere.length > 0 && (
          <div className="flex flex-wrap gap-1 border-b border-line/60 px-3 py-2">
            {dayJourneeEntiere.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelectEvenement?.(e)}
                aria-label={`Événement journée entière ${e.titre}. Modifier`}
                className="max-w-[260px] truncate rounded bg-agenda px-2 py-1 text-xs font-semibold text-on-agenda focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                {e.titre}
              </button>
            ))}
          </div>
        )}
        {dayTachesSansHeure.length > 0 && (
          <div className="flex flex-wrap gap-1 border-b border-line/60 px-3 py-2">
            {dayTachesSansHeure.map((t) => (
              <span
                key={t.id}
                className="max-w-[220px] truncate rounded bg-surface-alt px-2 py-1 text-xs text-ink-2"
              >
                {t.titre}
              </span>
            ))}
          </div>
        )}
        <div
          ref={scrollRef}
          className="max-h-[55vh] overflow-auto"
          style={{ touchAction: "pan-x pan-y" }}
          {...touchHandlers}
        >
          <div className="flex">
            <TimeGutter zoom={zoom} creneaux={creneauxJour} />
            <div className="relative flex-1" style={{ height: gridHeight(zoom) }}>
              <HourLines zoom={zoom} />
              <WorkHoursBand creneaux={creneauxJour} zoom={zoom} />
              {isToday(selectedDate) && <NowLine zoom={zoom} />}
              {dayEvenements.map((e) => (
                <EvenementBlock
                  key={e.id}
                  evenement={e}
                  zoom={zoom}
                  position={positions.get(e.id)}
                  onSelect={onSelectEvenement}
                />
              ))}
              {dayTachesAvecHeure.map((t) => (
                <TacheBlock
                  key={t.id}
                  tache={t}
                  zoom={zoom}
                  position={positions.get(t.id)}
                  onSelect={onSelectTache}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {dayTaches.length === 0 && dayTachesArchivees.length === 0 ? (
        <p className="text-ink-2">Aucune tâche ce jour-là.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {dayTaches.map((tache) => (
            <TaskCard
              key={tache.id}
              tache={tache}
              listes={listes}
              tags={tags}
              colorByListe
              highlighted={tache.id === tacheEnSurbrillanceId}
            />
          ))}
        </ul>
      )}

      <ArchivedTasksSection
        taches={dayTachesArchivees}
        listes={listes}
        tags={tags}
        tacheEnSurbrillanceId={tacheEnSurbrillanceId}
      />
    </div>
  );
}
