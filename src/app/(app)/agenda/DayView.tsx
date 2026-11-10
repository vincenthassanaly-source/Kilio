"use client";

import { useEffect, useMemo, useRef } from "react";
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

// Appui long (et non simple tap) pour créer depuis la grille : un tap en fin
// de défilement ouvrirait sinon le formulaire par accident.
const DUREE_APPUI_LONG_MS = 450;
const DEPLACEMENT_ANNULE_APPUI_PX = 10;

const PUCE_BASE =
  "relative min-h-9 truncate rounded-lg px-3 py-1.5 text-caption after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:outline-none focus-visible:ring-2";

function PuceEvenement({
  evenement,
  avantGrille = false,
  onSelect,
}: {
  evenement: Evenement;
  avantGrille?: boolean;
  onSelect?: (evenement: Evenement) => void;
}) {
  const heure = evenement.heure.slice(0, 5);
  return (
    <button
      type="button"
      onClick={() => onSelect?.(evenement)}
      aria-label={
        avantGrille
          ? `Événement ${evenement.titre} à ${heure}, avant le début de la grille. Modifier`
          : `Événement journée entière ${evenement.titre}. Modifier`
      }
      className={`${PUCE_BASE} max-w-[260px] bg-agenda font-semibold text-on-agenda focus-visible:ring-ink`}
    >
      {avantGrille && <span className="tabular-nums">{heure} </span>}
      {evenement.titre}
    </button>
  );
}

function PuceTache({ tache, onSelect }: { tache: TacheAvecRelations; onSelect: (id: string) => void }) {
  const heure = tache.heure?.slice(0, 5);
  return (
    <button
      type="button"
      onClick={() => onSelect(tache.id)}
      aria-label={`${heure ? `Tâche à ${heure}, avant le début de la grille` : "Tâche sans heure"} ${tache.titre}. Voir la tâche`}
      className={`${PUCE_BASE} max-w-[220px] bg-surface-alt text-ink-2 focus-visible:ring-kcal`}
    >
      {heure && <span className="tabular-nums">{heure} </span>}
      {tache.titre}
    </button>
  );
}

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

  // Création au créneau : appui long sur un espace vide de la grille.
  const appuiRef = useRef<{ timer: number; x: number; y: number } | null>(null);
  function annulerAppui() {
    if (appuiRef.current) window.clearTimeout(appuiRef.current.timer);
    appuiRef.current = null;
  }
  useEffect(
    () => () => {
      if (appuiRef.current) window.clearTimeout(appuiRef.current.timer);
    },
    []
  );
  function demarrerAppui(e: React.PointerEvent<HTMLDivElement>) {
    // Un second doigt (pincement) ou un bloc existant ne déclenche rien.
    if (!onCreerEvenement || !e.isPrimary || (e.target as HTMLElement).closest("button")) return;
    annulerAppui();
    const cible = e.currentTarget;
    const { clientX, clientY } = e;
    const timer = window.setTimeout(() => {
      appuiRef.current = null;
      const rect = cible.getBoundingClientRect();
      const minutes = Math.floor(pxToMinutes(clientY - rect.top, zoom) / 30) * 30;
      const borne = Math.min(Math.max(minutes, 6 * 60), 23 * 60 + 30);
      navigator.vibrate?.(15);
      onCreerEvenement(
        `${String(Math.floor(borne / 60)).padStart(2, "0")}:${String(borne % 60).padStart(2, "0")}`
      );
    }, DUREE_APPUI_LONG_MS);
    appuiRef.current = { timer, x: clientX, y: clientY };
  }
  function deplacerAppui(e: React.PointerEvent<HTMLDivElement>) {
    const appui = appuiRef.current;
    if (appui && Math.hypot(e.clientX - appui.x, e.clientY - appui.y) > DEPLACEMENT_ANNULE_APPUI_PX) annulerAppui();
  }

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
        {(dayJourneeEntiere.length > 0 ||
          dayEvenementsTot.length > 0 ||
          dayTachesTot.length > 0 ||
          dayTachesSansHeure.length > 0) && (
          <div className="flex flex-wrap gap-1.5 border-b border-line/60 px-3 py-2">
            {dayJourneeEntiere.map((e) => (
              <PuceEvenement key={e.id} evenement={e} onSelect={onSelectEvenement} />
            ))}
            {dayEvenementsTot.map((e) => (
              <PuceEvenement key={e.id} evenement={e} avantGrille onSelect={onSelectEvenement} />
            ))}
            {[...dayTachesTot, ...dayTachesSansHeure].map((t) => (
              <PuceTache key={t.id} tache={t} onSelect={onSelectTache} />
            ))}
          </div>
        )}
        <div
          ref={scrollRef}
          tabIndex={0}
          role="region"
          aria-label="Grille horaire du jour. Appui long sur un créneau pour ajouter un événement"
          className="max-h-[55vh] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
          style={{ touchAction: "pan-x pan-y" }}
          {...touchHandlers}
        >
          <div className="flex">
            <TimeGutter zoom={zoom} creneaux={creneauxJour} />
            <div
              className="relative flex-1 select-none [-webkit-touch-callout:none]"
              style={{ height: gridHeight(zoom) }}
              onPointerDown={demarrerAppui}
              onPointerMove={deplacerAppui}
              onPointerUp={annulerAppui}
              onPointerCancel={annulerAppui}
              onPointerLeave={annulerAppui}
              onContextMenu={onCreerEvenement ? (e) => e.preventDefault() : undefined}
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
