"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { lireDiagnosticComplet, type DiagnosticRepos } from "@/lib/musculation/diagnosticRepos";
import { metaText } from "@/lib/ui";

function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR");
}

function ligne(e: DiagnosticRepos): string {
  if (e.source === "push") {
    return `${heure(e.a)} · push · ${e.affichee ? "notification affichée" : "non affichée (app visible)"}`;
  }
  return `${heure(e.a)} · page · audio ${e.audioAvant}→${e.audioApres} · bips ${e.bips ? "oui" : "NON"} · écran ${e.visible ? "allumé" : "éteint"}`;
}

/**
 * Journal de fin de repos, visible sur `/musculation/seance?diag=1` : après une séance,
 * montre pour chaque repos si les bips de la page et la notification push ont joué.
 */
export function PanneauDiagnosticRepos() {
  const actif = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).has("diag"),
    () => false,
  );
  const [entrees, setEntrees] = useState<DiagnosticRepos[]>([]);

  useEffect(() => {
    if (!actif) return;
    let annule = false;
    const charger = () => {
      void lireDiagnosticComplet().then((liste) => {
        if (!annule) setEntrees(liste);
      });
    };
    charger();
    const intervalle = window.setInterval(charger, 3000);
    return () => {
      annule = true;
      window.clearInterval(intervalle);
    };
  }, [actif]);

  if (!actif) return null;
  return (
    <section aria-label="Diagnostic fin de repos" className="rounded-2xl border border-line p-3">
      <h2 className={`${metaText} font-semibold`}>Diagnostic fin de repos</h2>
      {entrees.length === 0 ? (
        <p className={metaText}>Aucun signal enregistré pour l&apos;instant.</p>
      ) : (
        <ul className={`${metaText} mt-1 flex flex-col gap-1`}>
          {entrees.map((e) => (
            <li key={`${e.source}-${e.a}`}>{ligne(e)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
