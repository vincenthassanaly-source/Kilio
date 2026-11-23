"use client";

import { useEffect, useSyncExternalStore } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { choisirTheme, lirePreferenceTheme, suivreThemeSysteme, type PreferenceTheme } from "@/lib/theme";
import { Pastille, ReglageEntete } from "./ReglageUi";

function AppearanceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-kcal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5z" />
    </svg>
  );
}

const OPTIONS = [
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
  { value: "system", label: "Système" },
] as const satisfies readonly { value: PreferenceTheme; label: string }[];

// Petit magasin autour du cookie de thème : le choix vit hors de React
// (cookie + localStorage), useSyncExternalStore le relit après chaque
// changement sans désaccord d'hydratation (rien n'est coché côté serveur).
const EVENEMENT = "kilio-theme-change";
function abonner(rappel: () => void) {
  window.addEventListener(EVENEMENT, rappel);
  return () => window.removeEventListener(EVENEMENT, rappel);
}

export function AppearanceRow() {
  const preference = useSyncExternalStore<PreferenceTheme | null>(abonner, lirePreferenceTheme, () => null);

  // En « Système », l'app suit un changement de thème de l'OS sans recharger.
  useEffect(() => suivreThemeSysteme(), []);

  function changer(suivante: PreferenceTheme) {
    choisirTheme(suivante);
    window.dispatchEvent(new Event(EVENEMENT));
  }

  return (
    <div className="flex flex-col gap-2.5 py-3.5">
      <ReglageEntete
        icone={
          <Pastille>
            <AppearanceIcon />
          </Pastille>
        }
        titre="Apparence"
      />
      <SegmentedControl
        ariaLabel="Apparence"
        options={OPTIONS}
        // Avant hydratation (préférence inconnue côté serveur), aucun
        // segment n'est actif plutôt qu'un faux « Système ».
        value={(preference ?? "") as PreferenceTheme}
        onChange={changer}
        taille="sm"
      />
    </div>
  );
}
