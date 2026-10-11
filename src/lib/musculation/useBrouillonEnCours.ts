"use client";

import { useEffect, useState } from "react";
import { EVENEMENT_BROUILLON, lireBrouillon } from "./brouillon";
import type { Brouillon } from "./seance";

/**
 * Séance en cours stockée sur le téléphone. `undefined` pendant la lecture,
 * `null` s'il n'y en a pas. Se met à jour quand une séance démarre, est
 * abandonnée ou terminée (évènement EVENEMENT_BROUILLON).
 */
export function useBrouillonEnCours(): Brouillon | null | undefined {
  const [brouillon, setBrouillon] = useState<Brouillon | null | undefined>(undefined);

  useEffect(() => {
    let actif = true;
    const lire = () => {
      void lireBrouillon().then((lu) => {
        if (actif) setBrouillon(lu);
      });
    };
    lire();
    window.addEventListener(EVENEMENT_BROUILLON, lire);
    return () => {
      actif = false;
      window.removeEventListener(EVENEMENT_BROUILLON, lire);
    };
  }, []);

  return brouillon;
}
