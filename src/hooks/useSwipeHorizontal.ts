"use client";

import { useRef } from "react";

// Distance horizontale minimum pour qu'un geste soit considéré comme un
// swipe intentionnel (plutôt qu'un tap ou un léger tremblement du doigt).
const SEUIL_SWIPE_HORIZONTAL_PX = 50;
// Tolérance verticale : au-delà, le geste est un scroll de page, pas un
// swipe de période — on n'interfère pas (pas de preventDefault) et on
// annule la détection pour ce geste.
const TOLERANCE_SWIPE_VERTICAL_PX = 60;

export type SensSwipe = "suivant" | "precedent";

/**
 * Détection d'un swipe horizontal intentionnel sur mobile, extraite de
 * `agenda/AgendaView.tsx` (module de référence) pour être réutilisée sur
 * d'autres écrans à navigation temporelle (Journal Nutrition, Historique
 * des habitudes...) avec les mêmes seuils/tolérances.
 *
 * Appelle `onSwipe("suivant" | "precedent")` une fois le geste terminé si
 * (et seulement si) il s'agit bien d'un swipe horizontal : le nom des sens
 * correspond directement aux classes CSS `agenda-glisse-suivant` /
 * `agenda-glisse-precedent` de `globals.css`. Le scroll vertical de la page
 * n'est jamais bloqué (aucun `preventDefault`).
 *
 * Un élément scrollable horizontalement sous le doigt peut être exclu de la
 * détection en le marquant `data-swipe-ignore` (voir `AgendaView.tsx` pour
 * le détail de cette mécanique).
 *
 * Conflits de gestes (T13, vague 2) :
 * - une zone qui a son propre swipe (Journal, historique Habitudes) porte
 *   `data-swipe-zone` sur l'élément qui reçoit ces handlers : un geste
 *   commencé dedans n'est alors pas interprété par une zone englobante
 *   (swipe entre onglets de `TabSwipeWrapper`) ;
 * - un geste commencé sur une poignée de glisser-déposer
 *   (`data-drag-handle`) n'est jamais un swipe ;
 * - un geste à plusieurs doigts (pinch-zoom) n'est jamais un swipe.
 */
export function useSwipeHorizontal(onSwipe: (sens: SensSwipe) => void) {
  // Point de départ du geste en cours (null si aucun geste).
  const toucheDebutRef = useRef<{ x: number; y: number } | null>(null);
  // true dès que le geste en cours s'est révélé vertical (scroll de page) :
  // on ne déclenche alors plus `onSwipe` à la fin, sans avoir bloqué le
  // scroll natif (aucun preventDefault n'est appelé ici).
  const swipeAnnulePourGesteRef = useRef(false);
  // Élément scrollable horizontalement le plus proche sous le doigt au
  // démarrage du geste (marqué `[data-swipe-ignore]`), et son scrollLeft à
  // cet instant — voir AgendaView.tsx pour le détail de cette mécanique.
  const swipeIgnoreElRef = useRef<HTMLElement | null>(null);
  const swipeIgnoreScrollLeftDebutRef = useRef(0);

  function onTouchStart(e: React.TouchEvent) {
    const cible = e.target as HTMLElement;
    const zone = cible.closest<HTMLElement>("[data-swipe-zone]");
    if (
      e.touches.length > 1 ||
      cible.closest("[data-drag-handle]") ||
      (zone && zone !== e.currentTarget && (e.currentTarget as HTMLElement).contains(zone))
    ) {
      toucheDebutRef.current = null;
      return;
    }
    const ignoreEl = cible.closest<HTMLElement>("[data-swipe-ignore]");
    swipeIgnoreElRef.current = ignoreEl;
    swipeIgnoreScrollLeftDebutRef.current = ignoreEl?.scrollLeft ?? 0;
    const touche = e.touches[0];
    toucheDebutRef.current = { x: touche.clientX, y: touche.clientY };
    swipeAnnulePourGesteRef.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    const debut = toucheDebutRef.current;
    if (!debut || swipeAnnulePourGesteRef.current) return;
    if (e.touches.length > 1) {
      swipeAnnulePourGesteRef.current = true;
      return;
    }
    const touche = e.touches[0];
    if (Math.abs(touche.clientY - debut.y) > TOLERANCE_SWIPE_VERTICAL_PX) {
      swipeAnnulePourGesteRef.current = true;
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    const debut = toucheDebutRef.current;
    const annule = swipeAnnulePourGesteRef.current;
    const ignoreEl = swipeIgnoreElRef.current;
    const aDefileHorizontalement =
      ignoreEl !== null && Math.abs(ignoreEl.scrollLeft - swipeIgnoreScrollLeftDebutRef.current) > 2;
    toucheDebutRef.current = null;
    swipeAnnulePourGesteRef.current = false;
    swipeIgnoreElRef.current = null;
    if (!debut) return;

    const touche = e.changedTouches[0];
    const deltaX = touche.clientX - debut.x;
    const deltaY = touche.clientY - debut.y;
    if (
      annule ||
      aDefileHorizontalement ||
      Math.abs(deltaX) < SEUIL_SWIPE_HORIZONTAL_PX ||
      Math.abs(deltaY) > TOLERANCE_SWIPE_VERTICAL_PX
    ) {
      return;
    }

    onSwipe(deltaX < 0 ? "suivant" : "precedent");
  }

  return { onTouchStart, onTouchMove, onTouchEnd };
}
