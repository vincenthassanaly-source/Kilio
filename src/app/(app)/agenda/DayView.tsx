"use client";

import { useMemo, useRef } from "react";
import { addDays, format, isSameDay, isSameYear, isToday, startOfToday, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import type { TacheAvecRelations } from "@/app/actions/taches";
import type { Evenement } from "@/app/actions/evenements";
import type { Tables } from "@/lib/supabase/types";
import { getCreneauxDuJour } from "@/lib/agenda/planning-travail";
import { layoutChevauchements } from "@/lib/agenda/compute";
import { TaskCard } from "../taches/TasksList";
import { ArchivedTasksSection } from "./ArchivedTasksSection";
import { FerieBadge } from "@/components/FerieBadge";
import { PeriodHeader } from "./PeriodHeader";
import { parseISODate, toISODate } from "@/lib/date/iso";
import { majusculePremiere, sortByHeure } from "./date-utils";
import {
  computeInitialScrollMinutes,
  gridHeight,
  heureAvantGrille,
  HourLines,
  NowLine,
  pxToMinutes,
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
  feries,
  selectedDate,
  onChangeDate,
  tacheEnSurbrillanceId = null,
  onSelectTache,
  onSelectEvenement,
  onCreerEvenement,
  evenementsFiables = true,
}: {
  taches: TacheAvecRelations[];
  listes: Tables<"listes_taches">[];
  tags: Tables<"tags">[];
  creneaux: Tables<"horaires_travail_creneaux">[];
  exceptions: Tables<"horaires_travail_exceptions">[];
  // Événements légers de la fenêtre chargée (le jour affiché est filtré ici).
  evenements?: Evenement[];
  // Jours fériés (date ISO → nom) de la fenêtre chargée, informatifs.
  feries?: ReadonlyMap<string, string>;
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
  // Tap sur un créneau vide de la grille : crée un événement à cette heure (« HH:MM »).
  onCreerEvenement?: (heure: string) => void;
  // false tant que les événements sont en chargement ou en échec : on
  // n'affirme alors pas « journée libre ».
  evenementsFiables?: boolean;
}) {
  // Les tâches sans heure sont regroupées après celles ayant une heure
  // (cohérent avec le tri "échéance nullsFirst: false" déjà utilisé par la
  // page Tâches). Mémorisé : ne dépend que de `taches`/`selectedDate`, pas de
  // `zoom`, qui change à chaque frame pendant le geste de pincement/molette
  // (cf. useAgendaZoom) — sans ce useMemo, layoutChevauchements et les
  // filtres/tris ci-dessous étaient recalculés à chaque frame de zoom.
  const { dayTaches, dayTachesArchivees, dayTachesGrille, dayTachesSansHeure, dayTachesTot, dayEvenementsGrille, dayEvenementsTot, dayEvenements, dayJourneeEntiere, positions } = useMemo(() => {
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
    // Avant 06h, rien ne s'affiche dans la grille : ces éléments passent en bande au-dessus.
    const dayTachesGrille = dayTachesAvecHeure.filter((t) => !heureAvantGrille(t.heure));
    const dayTachesTot = dayTachesAvecHeure.filter((t) => heureAvantGrille(t.heure));
    const dayEvenementsGrille = dayEvenements.filter((e) => !heureAvantGrille(e.heure));
    const dayEvenementsTot = dayEvenements.filter((e) => heureAvantGrille(e.heure));
    // Tâches horodatées et événements se partagent la largeur de la grille.
    const positions = layoutChevauchements([...dayTachesGrille, ...dayEvenementsGrille]);

    return { dayTaches, dayTachesArchivees, dayTachesGrille, dayTachesSansHeure, dayTachesTot, dayEvenementsGrille, dayEvenementsTot, dayEvenements, dayJourneeEntiere, positions };
  }, [taches, evenements, selectedDate]);

  const ferieDuJour = feries?.get(toISODate(selectedDate));
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
        title={majusculePremiere(
          format(selectedDate, isSameYear(selectedDate, new Date()) ? "EEEE d MMMM" : "EEEE d MMMM yyyy", { locale: fr })
        )}
        prevLabel="Jour précédent"
        nextLabel="Jour suivant"
        onPrev={() => onChangeDate(subDays(selectedDate, 1))}
        onNext={() => onChangeDate(addDays(selectedDate, 1))}
        showToday={!isToday(selectedDate)}
        onToday={() => onChangeDate(startOfToday())}
      />
      {ferieDuJour && <FerieBadge nom={ferieDuJour} className="self-center" />}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {(dayJourneeEntiere.length > 0 || dayEvenementsTot.length > 0) && (
          <div className="flex flex-wrap gap-2 border-b border-line/60 px-3 py-2">
            {dayJourneeEntiere.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelectEvenement?.(e)}
                aria-label={`Événement journée entière ${e.titre}. Modifier`}
                className="relative min-h-9 max-w-[260px] truncate rounded-lg bg-agenda px-3 py-1.5 text-caption font-semibold text-on-agenda after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                {e.titre}
              </button>
            ))}
            {dayEvenementsTot.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelectEvenement?.(e)}
                aria-label={`Événement ${e.titre} à ${e.heure.slice(0, 5)}, avant le début de la grille. Modifier`}
                className="relative min-h-9 max-w-[260px] truncate rounded-lg bg-agenda px-3 py-1.5 text-caption font-semibold text-on-agenda after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                <span className="tabular-nums">{e.heure.slice(0, 5)}</span> {e.titre}
              </button>
            ))}
          </div>
        )}
        {(dayTachesSansHeure.length > 0 || dayTachesTot.length > 0) && (
          <div className="flex flex-wrap gap-1 border-b border-line/60 px-3 py-2">
            {[...dayTachesTot, ...dayTachesSansHeure].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTache(t.id)}
                aria-label={`${t.heure ? `Tâche à ${t.heure.slice(0, 5)}, avant le début de la grille` : "Tâche sans heure"} ${t.titre}. Voir la tâche`}
                className="relative min-h-9 max-w-[220px] truncate rounded bg-surface-alt px-2 py-1 text-caption text-ink-2 after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
              >
                {t.heure && <span className="tabular-nums">{t.heure.slice(0, 5)} </span>}
                {t.titre}
              </button>
            ))}
          </div>
        )}
        <div
          ref={scrollRef}
          tabIndex={0}
          role="region"
          aria-label="Grille horaire du jour"
          className="max-h-[55vh] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
          style={{ touchAction: "pan-x pan-y" }}
          {...touchHandlers}
        >
          <div className="flex">
            <TimeGutter zoom={zoom} creneaux={creneauxJour} />
            <div
              className="relative flex-1"
              style={{ height: gridHeight(zoom) }}
              onClick={(e) => {
                if (!onCreerEvenement || (e.target as HTMLElement).closest("button")) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const minutes = Math.floor(pxToMinutes(e.clientY - rect.top, zoom) / 30) * 30;
                const borne = Math.min(Math.max(minutes, 6 * 60), 23 * 60 + 30);
                onCreerEvenement(
                  `${String(Math.floor(borne / 60)).padStart(2, "0")}:${String(borne % 60).padStart(2, "0")}`
                );
              }}
            >
              <HourLines zoom={zoom} />
              <WorkHoursBand creneaux={creneauxJour} zoom={zoom} />
              {isToday(selectedDate) && <NowLine zoom={zoom} />}
              {dayEvenementsGrille.map((e) => (
                <EvenementBlock
                  key={e.id}
                  evenement={e}
                  zoom={zoom}
                  position={positions.get(e.id)}
                  onSelect={onSelectEvenement}
                />
              ))}
              {dayTachesGrille.map((t) => (
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
        <p className="text-ink-2">
          {dayEvenements.length + dayJourneeEntiere.length > 0
            ? "Aucune tâche ce jour-là, seulement des événements."
            : evenementsFiables
              ? "Journée libre : rien de prévu."
              : "Aucune tâche ce jour-là."}
        </p>
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
