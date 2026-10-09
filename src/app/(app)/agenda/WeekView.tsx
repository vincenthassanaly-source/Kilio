"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfToday,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { fr } from "date-fns/locale";
import type { Tables } from "@/lib/supabase/types";
import type { Evenement } from "@/app/actions/evenements";
import { getCreneauxDuJour } from "@/lib/agenda/planning-travail";
import { layoutChevauchements } from "@/lib/agenda/compute";
import { PeriodHeader } from "./PeriodHeader";
import { parseISODate } from "@/lib/date/iso";
import {
  computeInitialScrollMinutes,
  gridHeight,
  HourLines,
  NowLine,
  TimeGutter,
  UNSCHEDULED_BAND_HEIGHT,
  useInitialScroll,
  WorkHoursBand,
} from "./TimeGrid";
import { TacheBlock } from "./TacheBlock";
import { EvenementBlock } from "../aujourdhui/EvenementBlock";
import { evenementsHoraires } from "@/lib/evenements/compute";
import {
  BASE_DAY_COLUMN_WIDTH,
  computeMinZoomForWeekWidth,
  GUTTER_WIDTH,
  MIN_ZOOM_FALLBACK,
  useAgendaZoom,
} from "./useAgendaZoom";

// useLayoutEffect ne fait rien côté serveur et logge un warning React si
// utilisé tel quel dans un composant serveur-rendu ; cet alias bascule sur
// useEffect côté serveur (mesure de toute façon impossible sans DOM).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Tache = Tables<"taches">;

export function WeekView({
  taches,
  creneaux,
  exceptions,
  evenements = [],
  selectedDate,
  onChangeDate,
  onSelectDay,
}: {
  taches: Tache[];
  creneaux: Tables<"horaires_travail_creneaux">[];
  exceptions: Tables<"horaires_travail_exceptions">[];
  evenements?: Evenement[];
  selectedDate: Date;
  onChangeDate: (date: Date) => void;
  onSelectDay: (date: Date) => void;
}) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const today = new Date();
  const weekContainsToday = days.some((d) => isSameDay(d, today));

  // Données par jour (créneaux, tâches filtrées, layout des chevauchements) :
  // mémorisées par jour de la semaine, indépendamment de `zoom`, qui change
  // à chaque frame pendant le geste de pincement/molette (cf. useAgendaZoom)
  // — sans ce useMemo, layoutChevauchements et les filtres ci-dessous
  // étaient recalculés à chaque frame de zoom.
  const parJour = useMemo(() => {
    const map = new Map<
      string,
      {
        creneauxJour: ReturnType<typeof getCreneauxDuJour>;
        dayTachesAvecHeure: Tache[];
        dayTachesSansHeure: Tache[];
        dayEvenements: Evenement[];
        positions: ReturnType<typeof layoutChevauchements>;
      }
    >();
    for (const day of eachDayOfInterval({ start: weekStart, end: weekEnd })) {
      const creneauxJour = getCreneauxDuJour(creneaux, day, exceptions);
      const dayTachesAvecHeure = taches.filter(
        (t) => !t.fait && t.echeance && isSameDay(parseISODate(t.echeance), day) && t.heure
      );
      const dayTachesSansHeure = taches.filter(
        (t) => !t.fait && t.echeance && isSameDay(parseISODate(t.echeance), day) && !t.heure
      );
      const dayEvenements = evenementsHoraires(evenements).filter((e) => isSameDay(parseISODate(e.date), day));
      const positions = layoutChevauchements([...dayTachesAvecHeure, ...dayEvenements]);
      map.set(day.toISOString(), { creneauxJour, dayTachesAvecHeure, dayTachesSansHeure, dayEvenements, positions });
    }
    return map;
    // weekStart/weekEnd sont dérivés de façon pure de selectedDate (date-fns,
    // sans état mutable) : selectedDate suffit comme dépendance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taches, evenements, selectedDate, creneaux, exceptions]);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Zoom minimal dynamique : le plancher de dézoom est fixé au niveau
  // exact où les 7 colonnes remplissent la largeur visible du conteneur
  // (mesurée via ResizeObserver), pour ne jamais laisser d'espace vide à
  // droite. `containerWidth` vaut `null` tant que la mesure n'a pas eu
  // lieu (premier rendu) : on retombe alors sur le plancher par défaut.
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  useIsomorphicLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const minZoom =
    containerWidth !== null ? computeMinZoomForWeekWidth(containerWidth) : MIN_ZOOM_FALLBACK;

  const { zoom, touchHandlers } = useAgendaZoom({ minZoom });
  const dayColumnWidth = BASE_DAY_COLUMN_WIDTH * zoom;

  const creneauxSelectedJour = getCreneauxDuJour(creneaux, selectedDate, exceptions);
  useInitialScroll(
    scrollRef,
    computeInitialScrollMinutes({ showCurrentTime: weekContainsToday, creneaux: creneauxSelectedJour }),
    zoom
  );

  return (
    <div className="flex flex-col gap-3">
      <PeriodHeader
        title={`${format(weekStart, "d MMM", { locale: fr })} – ${format(weekEnd, "d MMM yyyy", { locale: fr })}`}
        prevLabel="Semaine précédente"
        nextLabel="Semaine suivante"
        onPrev={() => onChangeDate(subWeeks(selectedDate, 1))}
        onNext={() => onChangeDate(addWeeks(selectedDate, 1))}
        showToday={!weekContainsToday}
        onToday={() => onChangeDate(startOfToday())}
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div
          ref={scrollRef}
          className="max-h-[65vh] overflow-auto"
          style={{ touchAction: "pan-x pan-y" }}
          data-swipe-ignore
          {...touchHandlers}
        >
          <div className="flex" style={{ width: GUTTER_WIDTH + days.length * dayColumnWidth }}>
            <div className="sticky left-0 z-20 bg-surface">
              <div className="h-11 border-b border-line" />
              <div className="border-b border-line/60" style={{ height: UNSCHEDULED_BAND_HEIGHT }} />
              <TimeGutter zoom={zoom} />
            </div>

            {days.map((day) => {
              const { creneauxJour, dayTachesAvecHeure, dayTachesSansHeure, dayEvenements, positions } =
                parJour.get(day.toISOString()) ?? {
                  creneauxJour: [],
                  dayTachesAvecHeure: [],
                  dayTachesSansHeure: [],
                  dayEvenements: [],
                  positions: new Map(),
                };

              return (
                <div
                  key={day.toISOString()}
                  className="flex shrink-0 flex-col border-l border-line"
                  style={{ width: dayColumnWidth }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    aria-current={isToday(day) ? "date" : undefined}
                    className={`sticky top-0 z-10 flex h-11 flex-col items-center justify-center gap-0 border-b border-line bg-surface text-center ${
                      isToday(day) ? "text-agenda" : "text-ink"
                    }`}
                  >
                    <span className="text-[11px] font-semibold">{format(day, "EEE", { locale: fr })}</span>
                    <span className="text-[10px] text-ink-2">{format(day, "d MMM", { locale: fr })}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    className="flex flex-wrap items-center gap-0.5 overflow-hidden border-b border-line/60 px-0.5 py-0.5"
                    style={{ height: UNSCHEDULED_BAND_HEIGHT }}
                  >
                    {dayTachesSansHeure.slice(0, 2).map((t) => (
                      <span
                        key={t.id}
                        className="truncate rounded bg-surface-alt px-1 py-0.5 text-[10px] font-medium text-ink-2"
                      >
                        {t.titre}
                      </span>
                    ))}
                    {dayTachesSansHeure.length > 2 && (
                      <span className="text-[10px] text-ink-2">+{dayTachesSansHeure.length - 2}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    className="relative block w-full text-left"
                    style={{ height: gridHeight(zoom) }}
                    aria-label={`Voir le ${format(day, "EEEE d MMMM", { locale: fr })}`}
                  >
                    <HourLines zoom={zoom} />
                    <WorkHoursBand creneaux={creneauxJour} zoom={zoom} />
                    {isToday(day) && <NowLine zoom={zoom} />}
                    {dayEvenements.map((e) => (
                      <EvenementBlock key={e.id} evenement={e} zoom={zoom} position={positions.get(e.id)} compact />
                    ))}
                    {dayTachesAvecHeure.map((t) => (
                      <TacheBlock key={t.id} tache={t} zoom={zoom} position={positions.get(t.id)} compact />
                    ))}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
