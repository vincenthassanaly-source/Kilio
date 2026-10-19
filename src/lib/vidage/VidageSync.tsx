"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { showErrorToast } from "@/components/toast/toast-store";
import { queryKeys } from "@/lib/query/keys";
import { EVENEMENT_FEUILLE_EN_ATTENTE, synchroniserFeuilles } from "./local";

// Envoi différé après la dernière écriture : on n'envoie pas la feuille entière
// à chaque trait, seulement quand l'écriture marque une pause.
const DELAI_PAUSE_MS = 2_000;
// Rejeux tant qu'une feuille reste en attente (voir MusculationSync).
const DELAIS_REJEU_MS = [5_000, 20_000, 60_000];

/**
 * Envoie les feuilles de « Vider ma tête » écrites sur le téléphone : après une
 * pause d'écriture, au retour du réseau, au retour au premier plan et quand
 * l'app passe en arrière-plan (dernière chance avant que le navigateur ne la
 * suspende). Monté une fois dans providers.tsx : une feuille écrite hors ligne
 * part même si l'on n'ouvre plus jamais l'écran. Ne rend rien.
 */
export function VidageSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let actif = true;
    let pause: number | undefined;
    let rejeu: number | undefined;
    let tentative = 0;
    let refusAnnonce = false;

    async function envoyer() {
      const resultat = await synchroniserFeuilles();
      if (!actif) return;
      if (resultat.envoyees > 0) {
        // Le calendrier de relecture doit voir le jour écrit (ou vidé).
        queryClient.invalidateQueries({ queryKey: ["vidage", "mois"] });
      }
      // Feuille refusée par le serveur : elle reste sur le téléphone, on le dit une fois.
      if (resultat.refus.length > 0 && !refusAnnonce) {
        refusAnnonce = true;
        showErrorToast(`${resultat.refus[0]} La feuille reste sur ton téléphone.`);
      }
      if (resultat.restantes > 0 && resultat.refus.length === 0 && tentative < DELAIS_REJEU_MS.length) {
        window.clearTimeout(rejeu);
        rejeu = window.setTimeout(() => {
          tentative += 1;
          if (actif && navigator.onLine) void envoyer();
        }, DELAIS_REJEU_MS[tentative]);
      }
    }

    function relancer() {
      tentative = 0;
      void envoyer();
    }

    const apresEcriture = () => {
      window.clearTimeout(pause);
      pause = window.setTimeout(relancer, DELAI_PAUSE_MS);
    };
    const auRetourReseau = () => relancer();
    const auChangementDeVisibilite = () => {
      // En arrière-plan : on n'attend pas la pause. Au retour : on rattrape ce qui est resté.
      window.clearTimeout(pause);
      relancer();
    };

    relancer();
    window.addEventListener(EVENEMENT_FEUILLE_EN_ATTENTE, apresEcriture);
    window.addEventListener("online", auRetourReseau);
    window.addEventListener("pagehide", auChangementDeVisibilite);
    document.addEventListener("visibilitychange", auChangementDeVisibilite);
    return () => {
      actif = false;
      window.clearTimeout(pause);
      window.clearTimeout(rejeu);
      window.removeEventListener(EVENEMENT_FEUILLE_EN_ATTENTE, apresEcriture);
      window.removeEventListener("online", auRetourReseau);
      window.removeEventListener("pagehide", auChangementDeVisibilite);
      document.removeEventListener("visibilitychange", auChangementDeVisibilite);
    };
  }, [queryClient]);

  return null;
}
