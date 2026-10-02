"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { showToast } from "@/components/toast/toast-store";
import { queryKeys } from "@/lib/query/keys";
import { EVENEMENT_SEANCE_EN_ATTENTE, synchroniserSeances } from "./brouillon";

// Rejeux automatiques tant qu'une séance reste en attente (une erreur réseau
// peut survenir alors que le navigateur se croit en ligne, auquel cas aucun
// évènement `online` ne viendra) : mêmes délais que lib/offline/useOnlineSync.
const DELAIS_REJEU_MS = [5_000, 20_000, 60_000];

/**
 * Envoie les séances de sport terminées hors ligne dès que possible : au
 * lancement de l'app, au retour du réseau, au retour au premier plan et après
 * chaque fin de séance. Monté une fois dans providers.tsx : une séance
 * terminée en salle part même si l'on n'ouvre plus jamais l'écran Sport.
 * Ne rend rien.
 */
export function SportSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let actif = true;
    let minuteur: number | undefined;
    let tentative = 0;

    async function envoyer(annoncer: boolean) {
      const resultat = await synchroniserSeances();
      if (!actif) return;
      if (resultat.envoyees > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.sportDerniereSeance });
        if (annoncer) showToast(resultat.envoyees > 1 ? "Séances de sport synchronisées" : "Séance de sport synchronisée");
      }
      if (resultat.restantes > 0 && resultat.refus.length === 0 && tentative < DELAIS_REJEU_MS.length) {
        window.clearTimeout(minuteur);
        minuteur = window.setTimeout(() => {
          tentative += 1;
          if (actif && navigator.onLine) void envoyer(true);
        }, DELAIS_REJEU_MS[tentative]);
      }
    }

    function relancer(annoncer: boolean) {
      tentative = 0;
      void envoyer(annoncer);
    }

    const auRetourReseau = () => relancer(true);
    const auRetourPremierPlan = () => {
      if (document.visibilityState === "visible") relancer(true);
    };
    // Après « Terminer » l'écran de séance annonce lui-même le résultat.
    const apresFinDeSeance = () => relancer(false);

    relancer(true);
    window.addEventListener("online", auRetourReseau);
    document.addEventListener("visibilitychange", auRetourPremierPlan);
    window.addEventListener(EVENEMENT_SEANCE_EN_ATTENTE, apresFinDeSeance);
    return () => {
      actif = false;
      window.clearTimeout(minuteur);
      window.removeEventListener("online", auRetourReseau);
      document.removeEventListener("visibilitychange", auRetourPremierPlan);
      window.removeEventListener(EVENEMENT_SEANCE_EN_ATTENTE, apresFinDeSeance);
    };
  }, [queryClient]);

  return null;
}
