"use client";

import { useCallback, useEffect, useRef } from "react";
import { vibrate } from "@/lib/haptics";

// Appui long sur une ligne de Courses : renomme l'article (le tap simple le
// coche). Même réglage que l'appui long des Tâches (450 ms, annulé au-delà de
// 8 px de glisser, donc par un défilement). Le clic qui suit un appui long
// réussi est avalé pour ne pas cocher l'article en plus. Le clic droit (souris)
// ouvre aussi le renommage.
export const DELAI_APPUI_LONG_MS = 450;
const TOLERANCE_APPUI_LONG_PX = 8;

export function useAppuiLong(onAppuiLong: () => void) {
  const minuteur = useRef<number | null>(null);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const declenche = useRef(false);
  const rappel = useRef(onAppuiLong);

  useEffect(() => {
    rappel.current = onAppuiLong;
  });

  const annuler = useCallback(() => {
    if (minuteur.current !== null) window.clearTimeout(minuteur.current);
    minuteur.current = null;
    depart.current = null;
  }, []);
  useEffect(() => annuler, [annuler]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      declenche.current = false;
      depart.current = { x: e.clientX, y: e.clientY };
      minuteur.current = window.setTimeout(() => {
        minuteur.current = null;
        declenche.current = true;
        vibrate(20);
        rappel.current();
      }, DELAI_APPUI_LONG_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = depart.current;
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > TOLERANCE_APPUI_LONG_PX) annuler();
    },
    onPointerUp: annuler,
    onPointerCancel: annuler,
    onPointerLeave: annuler,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      // Appui long tactile déjà traité par le minuteur ; sinon clic droit.
      if (declenche.current || minuteur.current !== null) return;
      rappel.current();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!declenche.current) return;
      declenche.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
