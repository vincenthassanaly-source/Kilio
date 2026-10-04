"use client";

import { useEffect, useState } from "react";
import { heureParis } from "@/lib/date/paris";

/**
 * Heure courante (Paris, `HH:MM`), rafraîchie chaque minute et au retour au
 * premier plan : la PWA reste ouverte des heures, les trous libres et leur
 * résumé ne doivent pas rester figés sur l'heure du premier rendu (le repère
 * « maintenant » de la grille, lui, avance déjà seul).
 */
export function useHeureCourante(): string {
  const [heure, setHeure] = useState(heureParis);
  useEffect(() => {
    const maj = () => {
      if (!document.hidden) setHeure(heureParis());
    };
    const intervalle = setInterval(maj, 60_000);
    document.addEventListener("visibilitychange", maj);
    return () => {
      clearInterval(intervalle);
      document.removeEventListener("visibilitychange", maj);
    };
  }, []);
  return heure;
}
