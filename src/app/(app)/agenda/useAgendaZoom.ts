"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type TouchEvent as ReactTouchEvent,
} from "react";

// Dimensions par défaut de la grille horaire (= zoom 1, rendu actuel
// inchangé). WeekView utilise BASE_DAY_COLUMN_WIDTH, TimeGrid utilise
// BASE_HOUR_HEIGHT pour dériver hourHeight(zoom)/gridHeight(zoom).
export const BASE_HOUR_HEIGHT = 56;
export const BASE_DAY_COLUMN_WIDTH = 96;
const DEFAULT_ZOOM = 1;
// Largeur fixe de la gouttière d'heures (non affectée par le zoom), et
// nombre de colonnes de la vue Semaine — utilisés pour calculer le zoom
// minimal qui fait tenir exactement les 7 jours sur la largeur de l'écran.
export const GUTTER_WIDTH = 34;
const WEEK_DAYS_COUNT = 7;
// Plancher/plafond absolus de sécurité (cas d'un écran extrêmement étroit,
// ou avant la toute première mesure de largeur du conteneur Semaine).
export const MIN_ZOOM_FALLBACK = 0.35;
const MAX_ZOOM = 2;

const STORAGE_KEY = "kilio-agenda-zoom";

function clampZoomAbsolute(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM_FALLBACK, zoom));
}

function readStoredZoom(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw !== null ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? clampZoomAbsolute(parsed) : DEFAULT_ZOOM;
  } catch {
    // Navigation privée / stockage désactivé : localStorage peut lever
    // (Safari notamment) — on retombe sur le zoom par défaut.
    return DEFAULT_ZOOM;
  }
}

// Resynchronise si le zoom est modifié depuis un autre onglet.
function subscribeToStoredZoom(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getServerZoom(): number {
  return DEFAULT_ZOOM;
}

function touchDistance(a: React.Touch, b: React.Touch): number {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

// Zoom minimal (vue Semaine) pour lequel les 7 colonnes + la gouttière
// remplissent exactement la largeur visible du conteneur, sans espace vide
// à droite ni scroll horizontal. En dessous de ce zoom, dézoomer ne sert à
// rien (le contenu ne peut pas être plus large que l'écran).
export function computeMinZoomForWeekWidth(containerWidthPx: number): number {
  const availableForDays = containerWidthPx - GUTTER_WIDTH;
  if (!Number.isFinite(availableForDays) || availableForDays <= 0) {
    return MIN_ZOOM_FALLBACK;
  }
  const exactFitZoom = availableForDays / (WEEK_DAYS_COUNT * BASE_DAY_COLUMN_WIDTH);
  return Math.min(MAX_ZOOM, Math.max(0.2, exactFitZoom));
}

// Zoom combiné (hauteur des heures + largeur des colonnes jour) partagé
// entre WeekView et DayView via la même clé localStorage. Chaque vue
// appelle ce hook indépendamment ; pas besoin de le faire remonter en props.
// `minZoom` permet à une vue (la Semaine, via computeMinZoomForWeekWidth)
// d'imposer un plancher de zoom plus élevé que le plancher par défaut.
export function useAgendaZoom({ minZoom = MIN_ZOOM_FALLBACK }: { minZoom?: number } = {}) {
  // Valeur persistée, lue via useSyncExternalStore : getServerZoom() rend
  // un zoom 1 identique serveur/client au premier rendu (pas de mismatch
  // d'hydratation), puis React se resynchronise automatiquement sur la
  // vraie valeur localStorage juste après, sans passer par un effect qui
  // appellerait setState (évite les rendus en cascade).
  const storedZoom = useSyncExternalStore(subscribeToStoredZoom, readStoredZoom, getServerZoom);

  // Valeur "live" pendant un pinch en cours ; `null` = pas de geste actif,
  // on affiche alors storedZoom.
  const [liveZoom, setLiveZoom] = useState<number | null>(null);

  const clamp = useCallback((z: number) => Math.min(MAX_ZOOM, Math.max(minZoom, z)), [minZoom]);
  const zoom = clamp(liveZoom ?? storedZoom);

  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  // `minZoom` peut changer (redimensionnement de la Semaine) ; les handlers
  // de pinch ci-dessous sont stables (deps []), donc on lit toujours le
  // plancher courant via cette ref plutôt qu'une valeur figée à leur création.
  const minZoomRef = useRef(minZoom);
  useEffect(() => {
    minZoomRef.current = minZoom;
  }, [minZoom]);

  const gestureRef = useRef<{ startDistance: number; startZoom: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingZoomRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onTouchStart = useCallback((e: ReactTouchEvent) => {
    if (e.touches.length === 2) {
      gestureRef.current = {
        startDistance: touchDistance(e.touches[0], e.touches[1]),
        startZoom: zoomRef.current,
      };
    }
  }, []);

  const onTouchMove = useCallback((e: ReactTouchEvent) => {
    const gesture = gestureRef.current;
    if (!gesture || e.touches.length !== 2 || gesture.startDistance <= 0) return;
    const ratio = touchDistance(e.touches[0], e.touches[1]) / gesture.startDistance;
    const next = gesture.startZoom * ratio;
    pendingZoomRef.current = Math.min(MAX_ZOOM, Math.max(minZoomRef.current, next));
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingZoomRef.current !== null) {
        setLiveZoom(pendingZoomRef.current);
        pendingZoomRef.current = null;
      }
    });
  }, []);

  // Persistance en fin de geste uniquement (pas à chaque touchmove) pour
  // éviter d'écrire en boucle dans localStorage pendant le pinch.
  const onTouchEnd = useCallback((e: ReactTouchEvent) => {
    if (e.touches.length >= 2 || !gestureRef.current) return;
    gestureRef.current = null;
    // Si touchend arrive avant que le rAF en attente d'onTouchMove ait pu
    // s'exécuter, zoomRef.current retarde encore d'une frame sur le zoom
    // réellement pincé : on annule ce rAF et on utilise sa valeur en attente
    // pour la persistance, plutôt que de persister une valeur périmée puis
    // laisser le rAF la corriger visuellement après coup (CLICK-PATH-403).
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const zoomFinal = pendingZoomRef.current ?? zoomRef.current;
    pendingZoomRef.current = null;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(zoomFinal));
    } catch {
      // Navigation privée / stockage désactivé : on ignore silencieusement,
      // le zoom reste seulement en mémoire pour cette session.
    }
    setLiveZoom(null);
  }, []);

  return {
    zoom,
    touchHandlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
