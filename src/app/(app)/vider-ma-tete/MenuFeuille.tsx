"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  /** La feuille a déjà un texte transcrit : « Retranscrire » et « Voir le texte ». */
  aTranscription: boolean;
  enTranscription: boolean;
  /** Faux sur une feuille vide : rien à transcrire. */
  peutTranscrire: boolean;
  /** Faux sur une feuille vide : rien à effacer. */
  peutEffacer: boolean;
  onTranscrire: () => void;
  onVoirTexte: () => void;
  onEffacer: () => void;
};

// Cible tactile de 44 px (guide UX : zone minimale, 8 px d'écart entre cibles voisines).
const item =
  "flex min-h-11 w-full items-center gap-3 px-3.5 text-left text-[14.5px] font-medium transition hover:bg-surface-alt active:bg-surface-alt disabled:opacity-40 focus-visible:bg-surface-alt focus-visible:outline-none";

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function Rotation() {
  return (
    <svg className="animate-spin motion-reduce:animate-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

/**
 * Menu « … » de l'en-tête : les actions rares de la feuille (transcrire, relire le texte,
 * effacer), rangées loin de la zone d'écriture pour qu'un geste de paume ne les déclenche pas.
 */
export function MenuFeuille({ aTranscription, enTranscription, peutTranscrire, peutEffacer, onTranscrire, onVoirTexte, onEffacer }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const elementsActifs = () => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

  // À l'ouverture, le focus va au premier choix possible (clavier et lecteur d'écran).
  useEffect(() => {
    if (ouvert) elementsActifs()[0]?.focus();
  }, [ouvert]);

  // Toucher ailleurs ferme le menu.
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("pointerdown", dehors);
    return () => document.removeEventListener("pointerdown", dehors);
  }, [ouvert]);

  function fermer(rendreLeFocus: boolean) {
    setOuvert(false);
    if (rendreLeFocus) declencheur.current?.focus();
  }

  function choisir(action: () => void) {
    fermer(false);
    action();
  }

  function auClavier(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      fermer(true);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const choix = elementsActifs();
    if (choix.length === 0) return;
    e.preventDefault();
    const courant = choix.indexOf(document.activeElement as HTMLButtonElement);
    const suivant = e.key === "ArrowDown" ? (courant + 1) % choix.length : (courant - 1 + choix.length) % choix.length;
    choix[suivant].focus();
  }

  const libelleTranscrire = enTranscription ? "Transcription en cours…" : aTranscription ? "Retranscrire" : "Transcrire";

  return (
    <div ref={racine} className="relative" onKeyDown={auClavier}>
      <button
        ref={declencheur}
        type="button"
        aria-label={enTranscription ? "Transcription en cours…" : "Plus d'actions"}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-busy={enTranscription}
        onClick={() => setOuvert((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink transition hover:bg-surface-alt active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
      >
        {enTranscription ? (
          <Rotation />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        )}
      </button>

      {ouvert && (
        <div
          ref={menu}
          role="menu"
          aria-label="Actions de la feuille"
          className="absolute right-0 top-[calc(100%+8px)] z-30 flex w-60 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
        >
          <button
            type="button"
            role="menuitem"
            disabled={!peutTranscrire || enTranscription}
            onClick={() => choisir(onTranscrire)}
            className={`${item} text-ink`}
          >
            {enTranscription ? (
              <Rotation />
            ) : (
              <Icone>
                <path d="M5 6h14M5 12h14M5 18h9" />
              </Icone>
            )}
            {libelleTranscrire}
          </button>
          {aTranscription && (
            <button type="button" role="menuitem" onClick={() => choisir(onVoirTexte)} className={`${item} text-ink`}>
              <Icone>
                <path d="M6 3h9l4 4v14H6z" />
                <path d="M14 3v5h5M9 13h6M9 17h6" />
              </Icone>
              Voir le texte
            </button>
          )}
          <span className="mx-3.5 my-1 h-px bg-line" role="separator" />
          <button type="button" role="menuitem" disabled={!peutEffacer} onClick={() => choisir(onEffacer)} className={`${item} text-alert`}>
            <Icone>
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
            </Icone>
            Effacer la feuille
          </button>
        </div>
      )}
    </div>
  );
}
