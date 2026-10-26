"use client";

import { useEffect } from "react";

// Champs qui ouvrent le clavier virtuel (hors cases à cocher, boutons, etc.).
const TYPES_SANS_CLAVIER = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "file", "color", "image"]);

function ouvreLeClavier(cible: EventTarget | null): boolean {
  if (!(cible instanceof HTMLElement)) return false;
  if (cible instanceof HTMLTextAreaElement) return true;
  if (cible instanceof HTMLInputElement) return !TYPES_SANS_CLAVIER.has(cible.type);
  return cible.isContentEditable;
}

/**
 * Pose `data-saisie` sur <html> tant qu'un champ de texte a le focus : la barre
 * du bas et les boutons flottants (`data-masquer-saisie`, voir globals.css)
 * s'effacent alors. Avec `interactiveWidget: "resizes-content"` (layout.tsx) les
 * éléments `fixed` remontent au-dessus du clavier et mangeraient la zone de
 * saisie sur un petit écran. Ne rend rien.
 */
export function MasquageSaisie() {
  useEffect(() => {
    const racine = document.documentElement;
    const auFocus = (e: FocusEvent) => {
      if (ouvreLeClavier(e.target)) racine.dataset.saisie = "";
    };
    const aLaPerte = () => {
      // Le focus passe d'un champ à l'autre : on laisse le temps au suivant de le prendre.
      requestAnimationFrame(() => {
        if (!ouvreLeClavier(document.activeElement)) delete racine.dataset.saisie;
      });
    };
    document.addEventListener("focusin", auFocus);
    document.addEventListener("focusout", aLaPerte);
    return () => {
      document.removeEventListener("focusin", auFocus);
      document.removeEventListener("focusout", aLaPerte);
      delete racine.dataset.saisie;
    };
  }, []);

  return null;
}
