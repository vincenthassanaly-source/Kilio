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
import { getBlocInterval, layoutChevauchements } from "@/lib/agenda/compute";
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
import { EvenementBlock } from "../_accueil/EvenementBlock";
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
// En dessous de cette largeur de bloc, le titre serait illisible : couleur seule.
const BLOC_TEXTE_MIN_PX = 40;

function libelleJour(day: Date, nbTaches: number, nbEvenements: number, horsGrille: string[]): string {
  const parts = [`Voir le ${format(day, "EEEE d MMMM", { locale: fr })}`];
  if (nbTaches > 0) parts.push(`${nbTaches} tâche${nbTaches > 1 ? "s" : ""}`);
  if (nbEvenements > 0) parts.push(`${nbEvenements} événement${nbEvenements > 1 ? "s" : ""}`);
  if (horsGrille.length > 0) parts.push(`hors grille : ${horsGrille.join(", ")}`);
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
  onSelectEvenement,
  onSelectTache,
  evenementsFiables = true,
}: {
  // false tant que les événements sont en chargement ou en échec : on
  // n'affirme alors pas « rien de prévu cette semaine ».
  evenementsFiables?: boolean;
  taches: Tache[];
  creneaux: Tables<"horaires_travail_creneaux">[];
  exceptions: Tables<"horaires_travail_exceptions">[];
  evenements?: Evenement[];
  feries?: ReadonlyMap<string, string>;
  selectedDate: Date;
  onChangeDate: (date: Date) => void;
  onSelectDay: (date: Date) => void;
  // Tap sur un bloc : ouvre l'événement, ou le jour de la tâche avec sa carte en surbrillance.
  onSelectEvenement?: (evenement: Evenement) => void;
  onSelectTache?: (id: string, jour: Date) => void;
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

  const { zoom, touchHandlers } = useAgendaZoom({ minZoom, vue: "semaine" });
  const dayColumnWidth = BASE_DAY_COLUMN_WIDTH * zoom;

  const creneauxSelectedJour = getCreneauxDuJour(creneaux, selectedDate, exceptions);
  // Blocs de toute la semaine : le scroll initial (partagé par les 7 colonnes)
  // ne doit en couper aucun.
  const blocsSemaine = useMemo(() => {
    const intervalles: { start: number; end: number }[] = [];
    for (const { dayTachesAvecHeure, dayEvenements } of parJour.values()) {
      for (const b of [...dayTachesAvecHeure, ...dayEvenements]) {
        const i = getBlocInterval(b);
        if (i) intervalles.push(i);
      }
    }
    return intervalles;
  }, [parJour]);
  useInitialScroll(
    scrollRef,
    computeInitialScrollMinutes({ showCurrentTime: weekContainsToday, creneaux: creneauxSelectedJour }),
    zoom,
    blocsSemaine
  );

  // Indice de défilement : à zoom normal, ~3,5 colonnes sur 7 tiennent à
  // l'écran. Un dégradé en bord droit signale qu'il y en a d'autres, tant que
  // la grille n'est pas défilée jusqu'au bout.
  const [encoreADroite, setEncoreADroite] = useState(false);
  const [encoreAGauche, setEncoreAGauche] = useState(false);
  function majIndiceDefilement() {
    const el = scrollRef.current;
    if (!el) return;
    setEncoreADroite(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    setEncoreAGauche(el.scrollLeft > 2);
  }
  useIsomorphicLayoutEffect(majIndiceDefilement, [zoom, containerWidth]);


  const semaineVide = [...parJour.values()].every(
    (j) => j.dayTachesAvecHeure.length + j.bandeTaches.length + j.dayEvenements.length + j.bandeEvenements.length === 0
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

      {semaineVide && evenementsFiables && (
        <p className="text-center text-small text-ink-2">Rien de prévu cette semaine.</p>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface">
        {encoreAGauche && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 z-30 w-6 bg-gradient-to-r from-ink/10 to-transparent"
            style={{ left: GUTTER_WIDTH }}
          />
        )}
        {encoreADroite && (
          <div
            aria-hidden
            data-testid="indice-defilement-semaine"
            className="pointer-events-none absolute inset-y-0 right-0 z-30 w-8 bg-gradient-to-l from-ink/15 to-transparent"
          />
        )}
        <div
          ref={scrollRef}
          className="max-h-[65vh] overflow-auto"
          style={{ touchAction: "pan-x pan-y" }}
          data-swipe-ignore
          onScroll={majIndiceDefilement}
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
                      dayEvenements.length + bandeEvenements.length,
                      [...bandeEvenements.map((e) => e.titre), ...bandeTaches.map((t) => t.titre)].slice(0, 3)
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

                  {/* Bande : doublon tactile du bouton d'en-tête, qui reste l'arrêt de
                      tabulation du jour ; les blocs de la grille sont de vrais boutons. */}
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

                  <div
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button")) return;
                      onSelectDay(day);
                    }}
                    className="relative block w-full text-left"
                    style={{ height: gridHeight(zoom) }}
                  >
                    <HourLines zoom={zoom} />
                    <WorkHoursBand creneaux={creneauxJour} zoom={zoom} />
                    {isToday(day) && <NowLine zoom={zoom} />}
                    {dayEvenements.map((e) => (
                      <EvenementBlock
                        key={e.id}
                        evenement={e}
                        zoom={zoom}
                        position={positions.get(e.id)}
                        compact
                        sansTexte={dayColumnWidth / (positions.get(e.id)?.nbColonnes ?? 1) < BLOC_TEXTE_MIN_PX}
                        onSelect={onSelectEvenement}
                      />
                    ))}
                    {dayTachesAvecHeure.map((t) => (
                      <TacheBlock
                        key={t.id}
                        tache={t}
                        zoom={zoom}
                        position={positions.get(t.id)}
                        compact
                        sansTexte={dayColumnWidth / (positions.get(t.id)?.nbColonnes ?? 1) < BLOC_TEXTE_MIN_PX}
                        onSelect={onSelectTache ? (id) => onSelectTache(id, day) : undefined}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
