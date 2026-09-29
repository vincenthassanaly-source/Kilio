"use client";

import { useEffect, useRef, useState } from "react";
import { EVENEMENT_FILE_AJOUT, flushQueue, preloadOfflineDb } from "./queue";

// Rejeux automatiques après une mise en file, tant qu'il reste des actions :
// une erreur réseau peut survenir alors que le navigateur se croit en ligne
// (connexion faible, réseau captif), auquel cas aucun évènement `online` ne
// viendra jamais relancer la file. Au-delà, le retour au premier plan, un
// retour réseau ou le prochain lancement prennent le relais.
export const DELAIS_REJEU_MS = [5_000, 20_000, 60_000];

// Écoute online/offline et rejoue la file d'attente au retour en ligne.
// Monté une seule fois dans src/app/providers.tsx (comme ToastHost) pour
// couvrir toute l'app, pas seulement l'écran actif.
//
// `onSynced` est appelé après un rejeu qui a synchronisé OU abandonné au
// moins une action. À la reconnexion, TanStack Query relance aussi les
// requêtes mises en pause hors ligne : ce refetch peut lire le serveur AVANT
// le rejeu et écraser le cache optimiste avec l'ancien état. Invalider les
// données une fois la file rejouée garantit que l'écran reflète l'état réel
// — y compris quand une action a été abandonnée plutôt que synchronisée
// (ex. un article resté optimiste avec un id temporaire, cf. flush-policy.ts).
export function useOnlineSync(onSynced?: () => void) {
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine
  );
  const onSyncedRef = useRef(onSynced);
  useEffect(() => {
    onSyncedRef.current = onSynced;
  });

  useEffect(() => {
    let minuteur: number | undefined;
    let tentative = 0;
    let actif = true;

    // Renvoie le nombre d'actions encore en file après le rejeu.
    async function rejouer(): Promise<number> {
      const { synced, abandoned, restantes } = await flushQueue();
      if (synced > 0 || abandoned > 0) onSyncedRef.current?.();
      return restantes;
    }

    function planifierRejeu() {
      window.clearTimeout(minuteur);
      if (!actif || tentative >= DELAIS_REJEU_MS.length) return;
      minuteur = window.setTimeout(async () => {
        tentative++;
        // Hors ligne : l'évènement `online` prend le relais.
        if (!actif || !navigator.onLine) return;
        if ((await rejouer()) > 0) planifierRejeu();
      }, DELAIS_REJEU_MS[tentative]);
    }

    async function rejouerEtSurveiller() {
      tentative = 0;
      if ((await rejouer()) > 0) planifierRejeu();
    }

    // Hors du chemin critique : Dexie se télécharge une fois l'écran rendu.
    const demarrage = () => {
      // Au cas où l'app est rouverte alors que des actions étaient restées en
      // attente d'une session précédente déjà en ligne.
      if (navigator.onLine) void rejouerEtSurveiller();
      else void preloadOfflineDb().catch(() => {});
    };
    // Safari n'a pas requestIdleCallback (même repli que preloadAddTaskForm.ts).
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(demarrage, { timeout: 3000 });
    } else {
      window.setTimeout(demarrage, 200);
    }

    function handleOnline() {
      setIsOnline(true);
      void rejouerEtSurveiller();
    }
    function handleOffline() {
      setIsOnline(false);
    }
    // Retour au premier plan : rattrape une file restée en attente pendant que
    // l'app était en arrière-plan (les minuteurs y sont suspendus).
    function handleVisibility() {
      if (document.visibilityState === "visible" && navigator.onLine) void rejouerEtSurveiller();
    }
    function handleEnfile() {
      tentative = 0;
      planifierRejeu();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(EVENEMENT_FILE_AJOUT, handleEnfile);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      actif = false;
      window.clearTimeout(minuteur);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(EVENEMENT_FILE_AJOUT, handleEnfile);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return { isOnline };
}
