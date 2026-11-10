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
import { parseISODate, toISODate } from "@/lib/date/iso";
import {
  computeInitialScrollMinutes,
  gridHeight,
  heureAvantGrille,
  HourLines,
  NowLine,
  TimeGutter,
  UNSCHEDULED_BAND_HEIGHT,
  useInitialScroll,
  WorkHoursBand,
} from "./TimeGrid";
import { TacheBlock } from "./TacheBlock";
import { EvenementBlock } from "../aujourdhui/EvenementBlock";
import { evenementsHoraires, evenementsJourneeEntiere } from "@/lib/evenements/compute";
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

// En dessous de cette largeur de colonne, la bande « sans heure » n'affiche
// qu'un compteur : les titres y seraient illisibles (≈45 px au zoom plancher).
const COLONNE_TITRES_MIN_PX = 80;

function libelleJour(day: Date, nbTaches: number, nbEvenements: number): string {
  const parts = [`Voir le ${format(day, "EEEE d MMMM", { locale: fr })}`];
  if (nbTaches > 0) parts.push(`${nbTaches} tâche${nbTaches > 1 ? "s" : ""}`);
  if (nbEvenements > 0) parts.push(`${nbEvenements} événement${nbEvenements > 1 ? "s" : ""}`);
  return parts.join(", ");
}

export function WeekView({
  taches,
  creneaux,
  exceptions,
  evenements = [],
  feries,
  selectedDate,
  onChangeDate,
  onSelectDay,
}: {
  taches: Tache[];
  creneaux: Tables<"horaires_travail_creneaux">[];
  exceptions: Tables<"horaires_travail_exceptions">[];
  evenements?: Evenement[];
  feries?: ReadonlyMap<string, string>;
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
        // Hors grille : sans heure ou avant 06h (tâches), journée entière ou avant 06h (événements).
        bandeTaches: Tache[];
        bandeEvenements: Evenement[];
        dayEvenements: Evenement[];
        positions: ReturnType<typeof layoutChevauchements>;
      }
    >();
    for (const day of eachDayOfInterval({ start: weekStart, end: weekEnd })) {
      const creneauxJour = getCreneauxDuJour(creneaux, day, exceptions);
      const tachesDuJour = taches.filter((t) => !t.fait && t.echeance && isSameDay(parseISODate(t.echeance), day));
      const dayTachesAvecHeure = tachesDuJour.filter((t) => t.heure && !heureAvantGrille(t.heure));
      const bandeTaches = tachesDuJour.filter((t) => !t.heure || heureAvantGrille(t.heure));
      const evenementsDuJour = evenements.filter((e) => isSameDay(parseISODate(e.date), day));
      const horaires = evenementsHoraires(evenementsDuJour);
      const dayEvenements = horaires.filter((e) => !heureAvantGrille(e.heure));
      const bandeEvenements = [
        ...evenementsJourneeEntiere(evenementsDuJour),
        ...horaires.filter((e) => heureAvantGrille(e.heure)),
      ];
      const positions = layoutChevauchements([...dayTachesAvecHeure, ...dayEvenements]);
      map.set(day.toISOString(), { creneauxJour, dayTachesAvecHeure, bandeTaches, bandeEvenements, dayEvenements, positions });
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
              const { creneauxJour, dayTachesAvecHeure, bandeTaches, bandeEvenements, dayEvenements, positions } =
                parJour.get(day.toISOString()) ?? {
                  creneauxJour: [],
                  dayTachesAvecHeure: [],
                  bandeTaches: [],
                  bandeEvenements: [],
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
                    aria-label={libelleJour(
                      day,
                      dayTachesAvecHeure.length + bandeTaches.length,
                      dayEvenements.length + bandeEvenements.length
                    )}
                    className="sticky top-0 z-10 flex h-11 flex-col items-center justify-center gap-0 border-b border-line bg-surface text-center text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kcal"
                  >
                    <span className="text-micro font-semibold">{format(day, "EEE", { locale: fr })}</span>
                    <span
                      className={`text-micro ${
                        isToday(day) ? "rounded-full bg-agenda px-1.5 font-bold text-on-agenda" : "text-ink-2"
                      } ${feries?.has(toISODate(day)) ? "font-semibold underline decoration-2 underline-offset-2" : ""}`}
                    >
                      {format(day, "d MMM", { locale: fr })}
                    </span>
                    {feries?.has(toISODate(day)) && (
                      <span className="sr-only">Jour férié : {feries.get(toISODate(day))}</span>
                    )}
                  </button>

                  {/* Bande et grille : doublons tactiles du bouton d'en-tête, qui reste
                      le seul arrêt de tabulation de la colonne. */}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    onClick={() => onSelectDay(day)}
                    className="flex flex-wrap items-center gap-0.5 overflow-hidden border-b border-line/60 px-0.5 py-0.5"
                    style={{ height: UNSCHEDULED_BAND_HEIGHT }}
                  >
                    {dayColumnWidth < COLONNE_TITRES_MIN_PX ? (
                      <>
                        {bandeEvenements.length > 0 && (
                          <span className="rounded bg-agenda px-1.5 py-0.5 text-micro font-semibold text-on-agenda">
                            {bandeEvenements.length}
                          </span>
                        )}
                        {bandeTaches.length > 0 && (
                          <span className="rounded bg-surface-alt px-1.5 py-0.5 text-micro font-semibold text-ink-2">
                            {bandeTaches.length}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {[
                          ...bandeEvenements.map((e) => ({ id: e.id, titre: e.titre, evenement: true })),
                          ...bandeTaches.map((t) => ({ id: t.id, titre: t.titre, evenement: false })),
                        ]
                          .slice(0, 2)
                          .map((item) => (
                            <span
                              key={item.id}
                              className={`truncate rounded px-1 py-0.5 text-micro font-medium ${
                                item.evenement ? "bg-agenda text-on-agenda" : "bg-surface-alt text-ink-2"
                              }`}
                            >
                              {item.titre}
                            </span>
                          ))}
                        {bandeEvenements.length + bandeTaches.length > 2 && (
                          <span className="text-micro text-ink-2">
                            +{bandeEvenements.length + bandeTaches.length - 2}
                          </span>
                        )}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    tabIndex={-1}
                    aria-hidden
                    className="relative block w-full text-left"
                    style={{ height: gridHeight(zoom) }}
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
