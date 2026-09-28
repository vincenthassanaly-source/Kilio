"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/**
 * Gestion du focus d'un dialogue (constat T14 de l'audit) :
 * - à l'ouverture, le focus va dans le dialogue (sur son conteneur, pour ne
 *   pas ouvrir le clavier virtuel d'un champ sur mobile) ;
 * - Tab / Maj+Tab restent piégés dans le dialogue ;
 * - Échap ferme ;
 * - à la fermeture, le focus revient à l'élément qui l'avait ouvert.
 * Le conteneur doit porter `tabIndex={-1}`.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const conteneur = ref.current;
    if (!conteneur) return;
    const precedent = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Un enfant avec `autoFocus` (ex. le champ de SuggestionModal, dont le
    // seul but est de taper immédiatement) a déjà le focus à ce stade :
    // React l'applique pendant le commit, avant cet effet. Ne pas le
    // reprendre pour le conteneur dans ce cas.
    if (!conteneur.contains(document.activeElement)) {
      conteneur.focus({ preventScroll: true });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !conteneur) return;
      const elements = Array.from(conteneur.querySelectorAll<HTMLElement>(FOCUSABLES)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }
      const premier = elements[0];
      const dernier = elements[elements.length - 1];
      const actif = document.activeElement;
      if (event.shiftKey && (actif === premier || actif === conteneur)) {
        event.preventDefault();
        dernier.focus();
      } else if (!event.shiftKey && actif === dernier) {
        event.preventDefault();
        premier.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (precedent && document.contains(precedent)) precedent.focus({ preventScroll: true });
    };
  }, [ref]);
}
