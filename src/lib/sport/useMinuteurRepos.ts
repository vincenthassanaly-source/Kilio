"use client";

import { useEffect, useRef, useState } from "react";
import { vibrate } from "@/lib/haptics";
import type { Repos } from "./seance";

// Un signal de fin plus ancien que ça n'est plus annoncé : rouvrir l'app après
// une longue pause ne doit pas faire sonner un repos terminé depuis longtemps.
const FENETRE_SIGNAL_MS = 10_000;

let contexteAudio: AudioContext | null = null;

/**
 * À appeler dans un geste de l'utilisateur (le tap sur ✓) : les navigateurs
 * n'autorisent le son qu'après une interaction, et le minuteur sonnera
 * plus tard, hors de tout geste.
 */
export function deverrouillerAudio(): void {
  if (typeof window === "undefined") return;
  try {
    const Constructeur =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructeur) return;
    contexteAudio ??= new Constructeur();
    if (contexteAudio.state === "suspended") void contexteAudio.resume();
  } catch {
    // Pas de son : la vibration et l'affichage suffisent.
  }
}

function bip(frequence: number, debutS: number, dureeS: number): void {
  const contexte = contexteAudio;
  if (!contexte || contexte.state !== "running") return;
  const oscillateur = contexte.createOscillator();
  const gain = contexte.createGain();
  oscillateur.frequency.value = frequence;
  gain.gain.setValueAtTime(0.0001, contexte.currentTime + debutS);
  gain.gain.exponentialRampToValueAtTime(0.25, contexte.currentTime + debutS + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, contexte.currentTime + debutS + dureeS);
  oscillateur.connect(gain).connect(contexte.destination);
  oscillateur.start(contexte.currentTime + debutS);
  oscillateur.stop(contexte.currentTime + debutS + dureeS + 0.05);
}

/** Fin de repos : deux bips et une vibration (quand l'appareil les permet). */
export function signalerFinRepos(): void {
  vibrate([220, 90, 220]);
  bip(880, 0, 0.18);
  bip(1175, 0.26, 0.28);
}

/**
 * Secondes restantes du repos en cours (0 sans repos), rafraîchies 4 fois par
 * seconde. Le calcul part de l'heure de fin enregistrée, pas d'un décompte :
 * le temps reste juste après une mise en veille ou un changement d'appli.
 * `surFin` est appelé une fois à l'échéance, si elle vient d'être atteinte.
 */
export function useMinuteurRepos(repos: Repos | null, surFin: () => void): number {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const surFinRef = useRef(surFin);
  useEffect(() => {
    surFinRef.current = surFin;
  });
  const dejaAnnonce = useRef<string | null>(null);

  useEffect(() => {
    if (!repos) return;
    const fin = new Date(repos.finA).getTime();

    function rafraichir() {
      const instant = Date.now();
      setMaintenant(instant);
      if (instant >= fin && dejaAnnonce.current !== repos!.finA) {
        dejaAnnonce.current = repos!.finA;
        if (instant - fin <= FENETRE_SIGNAL_MS) surFinRef.current();
      }
    }

    const intervalle = window.setInterval(rafraichir, 250);
    const auRetour = () => {
      if (document.visibilityState === "visible") rafraichir();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      window.clearInterval(intervalle);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [repos]);

  if (!repos) return 0;
  // Plancher au début du repos : tant que l'horloge locale n'est pas rafraîchie
  // (premier quart de seconde), on affiche la durée pleine plutôt qu'un temps faux.
  const instant = Math.max(maintenant, new Date(repos.debutA).getTime());
  return Math.max(0, Math.ceil((new Date(repos.finA).getTime() - instant) / 1000));
}
