"use client";

import { useEffect, useRef, useState } from "react";
import { GlobalSearchBar } from "./GlobalSearchBar";
import { SaisieNaturelle } from "./SaisieNaturelle";

type ModeChamp = "ajouter" | "rechercher";

// Segment du sélecteur de mode : 36 px visibles, zone de tap étendue à 44 px.
const segment =
  "relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

function IconePlus() {
  return (
    <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconeLoupe() {
  return (
    <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.5-4.5" />
    </svg>
  );
}

/**
 * Champ unique de l'accueil : la saisie « Ajoute… » (phrase interprétée par
 * Gemini) et la recherche globale partagent le même champ, avec un sélecteur
 * de mode à gauche (« + » ajoute, loupe recherche). Le texte tapé est conservé
 * en changeant de mode.
 */
export function ChampAccueil() {
  const [mode, setMode] = useState<ModeChamp>("ajouter");
  const [texte, setTexte] = useState("");
  const racine = useRef<HTMLDivElement>(null);
  // Vrai seulement après un changement de mode par l'utilisateur : le champ
  // reprend alors le focus (jamais au premier affichage, qui ouvrirait le clavier).
  const refocaliser = useRef(false);

  useEffect(() => {
    if (!refocaliser.current) return;
    refocaliser.current = false;
    racine.current?.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
  }, [mode]);

  function choisir(suivant: ModeChamp) {
    if (suivant === mode) return;
    refocaliser.current = true;
    setMode(suivant);
  }

  const selecteur = (
    <div
      role="group"
      aria-label="Mode du champ"
      className="absolute left-1 top-1/2 z-10 flex -translate-y-1/2 gap-0.5 rounded-[14px] bg-surface p-0.5"
    >
      <button
        type="button"
        aria-pressed={mode === "ajouter"}
        aria-label="Mode ajout"
        title="Ajouter une tâche ou un événement"
        onClick={() => choisir("ajouter")}
        className={`${segment} ${mode === "ajouter" ? "bg-kcal text-on-kcal" : "text-ink-2 hover:bg-surface-alt"}`}
      >
        <IconePlus />
      </button>
      <button
        type="button"
        aria-pressed={mode === "rechercher"}
        aria-label="Mode recherche"
        title="Rechercher dans Kilio"
        onClick={() => choisir("rechercher")}
        className={`${segment} ${mode === "rechercher" ? "bg-kcal text-on-kcal" : "text-ink-2 hover:bg-surface-alt"}`}
      >
        <IconeLoupe />
      </button>
    </div>
  );

  return (
    <div ref={racine} data-testid="champ-accueil">
      {mode === "ajouter" ? (
        <SaisieNaturelle valeur={texte} onValeur={setTexte} prefixe={selecteur} />
      ) : (
        <GlobalSearchBar valeur={texte} onValeur={setTexte} prefixe={selecteur} />
      )}
    </div>
  );
}
