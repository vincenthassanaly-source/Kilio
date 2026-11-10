"use client";

import { useEffect, useState } from "react";
import { EVENEMENT_FILE_AJOUT, compterFileAttente } from "@/lib/offline/queue";

const INTERVALLE_MS = 4_000;

/**
 * Pastille discrète quand l'app est hors ligne ou qu'il reste des écritures en
 * file (courses, tâches, habitudes…) : on voit ce qui attend au lieu de le
 * deviner. Invisible en ligne quand la file est vide. Annoncée en `status`.
 */
export function IndicateurConnexion() {
  const [enLigne, setEnLigne] = useState(true);
  const [enAttente, setEnAttente] = useState(0);

  useEffect(() => {
    let actif = true;
    async function actualiser() {
      setEnLigne(navigator.onLine);
      try {
        const n = await compterFileAttente();
        if (actif) setEnAttente(n);
      } catch {
        // Base locale indisponible : on garde le dernier compte connu.
      }
    }
    void actualiser();
    window.addEventListener("online", actualiser);
    window.addEventListener("offline", actualiser);
    window.addEventListener(EVENEMENT_FILE_AJOUT, actualiser);
    return () => {
      actif = false;
      window.removeEventListener("online", actualiser);
      window.removeEventListener("offline", actualiser);
      window.removeEventListener(EVENEMENT_FILE_AJOUT, actualiser);
    };
  }, []);

  const visible = !enLigne || enAttente > 0;

  // Tant que quelque chose attend (rejeu en cours, hors ligne), on suit la file
  // à intervalle régulier ; sinon les évènements ci-dessus suffisent.
  useEffect(() => {
    if (!visible) return;
    const minuteur = window.setInterval(() => {
      setEnLigne(navigator.onLine);
      void compterFileAttente().then(setEnAttente, () => {});
    }, INTERVALLE_MS);
    return () => window.clearInterval(minuteur);
  }, [visible]);
  const attente = enAttente > 0 ? `${enAttente} en attente` : null;
  const texte = !enLigne ? (attente ? `Hors ligne · ${attente}` : "Hors ligne") : `${attente} de synchronisation`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
    >
      {visible && (
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-small font-medium text-ink-2 shadow-float">
          <span aria-hidden className="h-2 w-2 rounded-full bg-warning" />
          {texte}
        </span>
      )}
    </div>
  );
}
