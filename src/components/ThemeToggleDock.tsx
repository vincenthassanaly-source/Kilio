"use client";

import { useEffect, useRef } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

// Au-delà de ce défilement (px), le bouton thème s'efface : il est fixe, et
// recouvrirait sinon le texte aligné à droite des en-têtes de carte qui
// remontent sous lui.
const SEUIL_DEFILEMENT = 40;

/**
 * Bouton thème fixe en haut à droite, effacé (et rendu inactif, donc ni cliquable
 * ni atteignable au clavier) tant que l'écran est défilé. Il revient en haut de
 * page. L'état passe par un attribut et `inert`, pas par un état React : aucun
 * rendu à chaque événement de défilement.
 */
export function ThemeToggleDock() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dock = ref.current;
    if (!dock) return;
    function onScroll(e: Event) {
      const cible = e.target;
      // Seul le conteneur principal défile (les listes internes ne comptent pas).
      if (!(cible instanceof HTMLElement) || cible.tagName !== "MAIN" || !dock) return;
      const defile = cible.scrollTop > SEUIL_DEFILEMENT;
      dock.dataset.defile = defile ? "oui" : "non";
      dock.inert = defile;
    }
    // Les évènements `scroll` ne remontent pas : on les capte en phase de capture.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  return (
    <div
      ref={ref}
      data-defile="non"
      className="fixed right-4 z-40 transition-opacity duration-150 data-[defile=oui]:pointer-events-none data-[defile=oui]:opacity-0"
      style={{ top: "calc(env(safe-area-inset-top) + 14px)", viewTransitionName: "theme-toggle" }}
    >
      <ThemeToggle />
    </div>
  );
}
