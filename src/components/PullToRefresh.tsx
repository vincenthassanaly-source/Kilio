"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";

const PULL_THRESHOLD = 70;
const MAX_PULL = 96;
const PULL_RESISTANCE = 0.5;

function findScrollParent(el: HTMLElement | null): HTMLElement | Element | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (style.overflowY === "auto" || style.overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return document.scrollingElement;
}

/** Détecte un tiré vers le bas quand le conteneur scrollable ancêtre est en
 * haut de page (scrollTop === 0), affiche un indicateur, puis déclenche un
 * refresh à la fin du geste. `main` porte déjà `overscroll-behavior-y:
 * contain` (voir globals.css) pour désactiver le pull-to-refresh natif du
 * navigateur et éviter le conflit visuel avec cet indicateur custom. */
export function PullToRefresh({
  children,
  onRefresh,
}: {
  children: React.ReactNode;
  onRefresh?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  // Distance courante lue à la fin du geste : un état React ne peut pas servir
  // à décider d'un effet de bord (un updater doit rester pur).
  const distanceRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    // T13 : ni pendant un glisser-déposer (poignée `data-drag-handle`, ex.
    // réordonner une tâche), ni pendant un geste à plusieurs doigts.
    if (e.touches.length > 1 || (e.target as HTMLElement).closest("[data-drag-handle]")) return;
    const scrollParent = findScrollParent(containerRef.current);
    if (!scrollParent || scrollParent.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
    setIsPulling(true);
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      distanceRef.current = 0;
      setPullDistance(0);
      return;
    }
    distanceRef.current = Math.min(MAX_PULL, delta * PULL_RESISTANCE);
    setPullDistance(distanceRef.current);
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    startY.current = null;
    setIsPulling(false);

    if (distanceRef.current < PULL_THRESHOLD) {
      distanceRef.current = 0;
      setPullDistance(0);
      return;
    }

    distanceRef.current = PULL_THRESHOLD;
    setPullDistance(PULL_THRESHOLD);
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      router.refresh();
      window.setTimeout(() => {
        distanceRef.current = 0;
        setRefreshing(false);
        setPullDistance(0);
      }, 400);
    }
  }, [onRefresh, router]);

  // Geste interrompu (geste système, défilement repris par le navigateur) :
  // sans cela, l'espace de l'indicateur resterait ouvert en haut de la page.
  const handleTouchCancel = useCallback(() => {
    pulling.current = false;
    startY.current = null;
    distanceRef.current = 0;
    setIsPulling(false);
    setPullDistance(0);
  }, []);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: pullDistance,
          transition: isPulling ? "none" : "height 0.2s ease-out",
        }}
        aria-hidden={pullDistance === 0}
      >
        <div
          className={`h-5 w-5 rounded-full border-2 ${refreshing && !reduceMotion ? "animate-spin" : ""}`}
          style={{
            borderColor: "var(--line)",
            borderTopColor: "var(--accent-kcal)",
            opacity: Math.min(1, pullDistance / PULL_THRESHOLD),
            transform: refreshing || reduceMotion ? undefined : `rotate(${pullDistance * 3}deg)`,
          }}
        />
      </div>
      {children}
    </div>
  );
}
