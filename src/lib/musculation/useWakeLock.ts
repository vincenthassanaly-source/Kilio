"use client";

import { useEffect } from "react";

/**
 * Garde l'écran allumé tant que `actif` : en salle de sport on pose le
 * téléphone entre deux séries et le minuteur de repos doit rester visible.
 * Le verrou est relâché par le navigateur quand l'app passe en arrière-plan ;
 * il est redemandé au retour au premier plan. Sans API (ancien navigateur),
 * ne fait rien.
 */
export function useWakeLock(actif: boolean): void {
  useEffect(() => {
    if (!actif || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinelle: WakeLockSentinel | null = null;
    let annule = false;

    async function demander() {
      try {
        const obtenue = await navigator.wakeLock.request("screen");
        if (annule) {
          void obtenue.release();
          return;
        }
        sentinelle = obtenue;
      } catch {
        // Refusé (économie d'énergie, onglet masqué) : l'écran suivra les réglages de l'appareil.
      }
    }

    const auRetour = () => {
      if (document.visibilityState === "visible") void demander();
    };

    void demander();
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      annule = true;
      document.removeEventListener("visibilitychange", auRetour);
      void sentinelle?.release().catch(() => {});
    };
  }, [actif]);
}
