"use client";

import { useEffect, useState, type RefObject } from "react";
import type { CreneauDuJour } from "@/lib/agenda/planning-travail";
import { getBlocInterval } from "@/lib/agenda/compute";
import { heureToMinutes } from "./date-utils";
import { BASE_HOUR_HEIGHT, GUTTER_WIDTH } from "./useAgendaZoom";

// Grille horaire partagée entre WeekView et DayView : scroll vertical (pas
// de découpage en tranches de temps arbitraires), 1 minute =
// hourHeight(zoom)/60 px. Les heures 00h-06h ne sont jamais affichées (il
// ne s'y passe jamais rien côté usage réel) : la grille commence à 06h et
// finit à 24h, ce qui fait gagner de la place à tous les niveaux de zoom.
// Une tâche avec heure mais sans heure_fin reste visible comme un bloc
// plutôt qu'un simple repère ponctuel : 30 min par défaut (cf.
// getBlocInterval dans src/lib/agenda/compute.ts, seule source de vérité
// pour ces bornes — aussi utilisée par layoutChevauchements).
const MIN_BLOCK_HEIGHT = 18;
const GRID_START_HOUR = 6;
// Hauteur réservée, identique pour toutes les colonnes (y compris la
// gouttière), pour la bande "tâches sans heure" de WeekView — qu'il y ait ou
// non des tâches ce jour-là. Sans cette réservation constante, un jour avec
// des tâches sans heure pousse son conteneur de grille plus bas que les
// autres colonnes et que le TimeGutter, désalignant heures et créneaux.
export const UNSCHEDULED_BAND_HEIGHT = 24;
const GRID_START_MINUTES = GRID_START_HOUR * 60;
const GRID_HOURS_COUNT = 24 - GRID_START_HOUR;
// Espace "d'amorce" au-dessus de la première heure affichée (06h), pour que
// l'écart entre le haut de la grille et la ligne 06h soit visuellement
// identique à l'écart entre deux lignes d'heure consécutives.
const GRID_LEAD_HOURS = 1;

const HOURS = Array.from({ length: GRID_HOURS_COUNT }, (_, i) => i + GRID_START_HOUR);

function hourHeight(zoom: number): number {
  return BASE_HOUR_HEIGHT * zoom;
}

export function gridHeight(zoom: number): number {
  return hourHeight(zoom) * (GRID_HOURS_COUNT + GRID_LEAD_HOURS);
}

// Convertit une DURÉE (pas un instant) en hauteur px : à ne jamais utiliser
// pour un instant absolu (heure de la journée), voir minutesToPx ci-dessous.
function durationToPx(durationMinutes: number, zoom: number): number {
  return (durationMinutes / 60) * hourHeight(zoom);
}

// `minutes` reste exprimé en minutes depuis minuit (échéances/créneaux non
// modifiés) ; la conversion en px est relative au début affiché de la
// grille (06h), décalée de l'espace d'amorce ci-dessus. Une valeur avant
// 06h donne un top négatif (hors-écran, ne s'affiche pas) — accepté, cette
// plage n'est jamais utilisée en pratique. Pour une DURÉE (pas un instant),
// utiliser durationToPx — soustraire GRID_START_MINUTES n'aurait aucun sens
// sur un écart entre deux heures.
function minutesToPx(minutes: number, zoom: number): number {
  return durationToPx(minutes - GRID_START_MINUTES, zoom) + hourHeight(zoom) * GRID_LEAD_HOURS;
}

export function getTacheBlockStyle(
  tache: {
    heure: string | null;
    heure_fin: string | null;
  },
  zoom: number
): { top: number; height: number } | null {
  const interval = getBlocInterval(tache);
  if (!interval) return null;

  return {
    top: minutesToPx(interval.start, zoom),
    height: Math.max(durationToPx(interval.end - interval.start, zoom), MIN_BLOCK_HEIGHT),
  };
}

// Position du scroll initial : l'heure actuelle si le jour affiché (ou l'un
// des jours de la semaine affichée) est aujourd'hui, sinon le début du
// créneau de travail le plus tôt du jour de référence — pour éviter
// d'atterrir sur une grille vide à minuit. Repli sur 8h si aucun créneau
// n'est configuré ce jour-là.
export function computeInitialScrollMinutes({
  showCurrentTime,
  creneaux,
}: {
  showCurrentTime: boolean;
  creneaux: CreneauDuJour[];
}): number {
  if (showCurrentTime) {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
  const debuts = creneaux
    .map((c) => heureToMinutes(c.heure_debut))
    .filter((m): m is number => m !== null);
  return debuts.length > 0 ? Math.min(...debuts) : 8 * 60;
}

export function useInitialScroll(
  containerRef: RefObject<HTMLDivElement | null>,
  targetMinutes: number,
  zoom: number
) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = Math.max(minutesToPx(targetMinutes, zoom) - 80, 0);
    // Positionnement au montage uniquement : un re-scroll à chaque rendu
    // (ou à chaque pinch) écraserait le scroll manuel de l'utilisateur. Si
    // le zoom mémorisé (localStorage) diffère du zoom par défaut utilisé le
    // temps de l'hydratation, ce calcul initial peut être légèrement décalé
    // — limitation connue, voir le rapport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Distance minimale, en px réellement rendus (constante, non affectée par
// `zoom`), en dessous de laquelle deux repères de la gouttière (heure
// pleine, ou repère vert de créneau) sont considérés en collision : c'est
// un seuil de lisibilité à l'écran (la taille du texte, text-[9px]/[10px],
// ne dépend pas de `zoom` non plus), pas une proximité temporelle.
const MIN_GUTTER_MARK_GAP_PX = 10;

// "08:30:00" (ou "08:30") -> "8h30", format horaire attendu sur les repères
// de début/fin de créneau dans TimeGutter — sans zéro de tête sur l'heure,
// inutile et un peu tronqué dans la gouttière étroite.
function formatCreneauHeure(heure: string): string {
  const [h, m] = heure.split(":");
  return `${Number(h)}h${m}`;
}

// Repères verts (début/fin de créneau) à afficher dans la gouttière :
// dédoublonnés par minute (plusieurs créneaux, ex. jours différents agrégés
// en Vue Semaine, peuvent partager la même heure de début/fin), triés par
// position, puis filtrés entre eux pour ne jamais empiler deux textes trop
// proches (le premier rencontré, le plus haut, l'emporte).
function computeWorkHourMarks(
  creneaux: CreneauDuJour[],
  zoom: number
): { minutes: number; top: number; label: string }[] {
  const labelParMinute = new Map<number, string>();
  for (const creneau of creneaux) {
    const start = heureToMinutes(creneau.heure_debut);
    const end = heureToMinutes(creneau.heure_fin);
    if (start === null || end === null || end <= start) continue;
    if (!labelParMinute.has(start)) labelParMinute.set(start, formatCreneauHeure(creneau.heure_debut));
    if (!labelParMinute.has(end)) labelParMinute.set(end, formatCreneauHeure(creneau.heure_fin));
  }

  const marks = [...labelParMinute.entries()]
    .map(([minutes, label]) => ({ minutes, label, top: minutesToPx(minutes, zoom) }))
    .sort((a, b) => a.top - b.top);

  const visibleTops: number[] = [];
  return marks.filter((mark) => {
    if (visibleTops.some((top) => Math.abs(top - mark.top) < MIN_GUTTER_MARK_GAP_PX)) return false;
    visibleTops.push(mark.top);
    return true;
  });
}

// Gouttière des heures : une heure pleine (06h, 07h, ...) par ligne, sauf
// au niveau d'un début/fin de créneau de travail (`creneaux`), où l'heure
// pleine est remplacée par l'heure précise du créneau en vert — jamais les
// deux superposées. `creneaux` n'a de sens que pour un seul jour à la fois
// (Vue Jour) : en Vue Semaine, la gouttière est partagée entre 7 colonnes
// dont les horaires de travail diffèrent d'un jour à l'autre, donc aucun
// créneau n'y est passé (TimeGutter reste alors la gouttière d'heures
// pleines telle qu'avant ce composant).
export function TimeGutter({ zoom, creneaux = [] }: { zoom: number; creneaux?: CreneauDuJour[] }) {
  const workMarks = computeWorkHourMarks(creneaux, zoom);
  const hours = HOURS.map((h) => ({ hour: h, top: minutesToPx(h * 60, zoom) })).filter(
    ({ top }) => !workMarks.some((mark) => Math.abs(mark.top - top) < MIN_GUTTER_MARK_GAP_PX)
  );

  return (
    <div className="relative shrink-0" style={{ width: GUTTER_WIDTH, height: gridHeight(zoom) }}>
      {hours.map(({ hour, top }) => (
        <span
          key={`h-${hour}`}
          className="absolute right-1 -translate-y-1/2 text-[10px] font-medium text-ink-2"
          style={{ top }}
        >
          {String(hour).padStart(2, "0")}h
        </span>
      ))}
      {workMarks.map((mark) => (
        <span
          key={`w-${mark.minutes}`}
          className="absolute right-1 -translate-y-1/2 whitespace-nowrap text-[10px] font-semibold text-planning-travail"
          style={{ top: mark.top }}
        >
          {mark.label}
        </span>
      ))}
    </div>
  );
}

export function HourLines({ zoom }: { zoom: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ height: gridHeight(zoom) }}>
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute inset-x-0 border-t border-line/70"
          style={{ top: minutesToPx(h * 60, zoom) }}
        />
      ))}
    </div>
  );
}

// Bande "heures de travail" : un <div> par créneau du jour (pause déjeuner
// = deux créneaux disjoints), simple aplat de couleur dédiée
// --accent-planning-travail-soft (déjà à ~30% d'opacité). Le libellé
// d'horaire ne vit plus ici mais dans TimeGutter (voir computeWorkHourMarks
// ci-dessus) : un bloc de tâche positionné sur ce créneau peut recouvrir
// toute la bande sans jamais masquer d'information. Un jour sans créneau ne
// dessine aucune bande.
export function WorkHoursBand({ creneaux, zoom }: { creneaux: CreneauDuJour[]; zoom: number }) {
  return (
    <>
      {creneaux.map((creneau) => {
        const start = heureToMinutes(creneau.heure_debut);
        const end = heureToMinutes(creneau.heure_fin);
        if (start === null || end === null || end <= start) return null;

        return (
          <div
            key={creneau.id}
            className="pointer-events-none absolute inset-x-0 overflow-hidden rounded-md"
            style={{
              top: minutesToPx(start, zoom),
              height: durationToPx(end - start, zoom),
              backgroundColor: "var(--accent-planning-travail-soft)",
            }}
          />
        );
      })}
    </>
  );
}

function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// Repère "maintenant" : ligne horizontale à la minute courante, affichée
// dans la vue Jour quand le jour affiché est aujourd'hui, et dans la
// colonne du jour courant en vue Semaine (cf. DayView/WeekView). Mise à
// jour toutes les 60s ; en pause (pas de re-render) quand l'onglet est en
// arrière-plan (`document.hidden`) plutôt que de continuer à calculer une
// position invisible — un `visibilitychange` au retour au premier plan
// rattrape immédiatement la position sans attendre le prochain intervalle.
// `aria-hidden`/`pointer-events-none` : purement décoratif, ne doit
// intercepter ni le tap sur un bloc de tâche ni le swipe/pinch-zoom de la
// grille. Masqué avant 06h (hors de la plage affichée par la grille,
// cf. GRID_START_HOUR) — jamais après 24h, une journée ne dépassant pas
// 23h59.
export function NowLine({ zoom }: { zoom: number }) {
  const [minutes, setMinutes] = useState(nowMinutes);

  useEffect(() => {
    function update() {
      if (document.hidden) return;
      setMinutes(nowMinutes());
    }
    const interval = setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  if (minutes < GRID_START_HOUR * 60) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-agenda"
      style={{ top: minutesToPx(minutes, zoom) }}
    >
      <span className="absolute -left-0.5 -top-[5px] h-2.5 w-2.5 rounded-full bg-agenda" />
    </div>
  );
}
