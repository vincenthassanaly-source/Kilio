"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type ActionMenu = {
  libelle: string;
  onSelect: () => void;
  icone?: ReactNode;
  disabled?: boolean;
};

// Cible tactile de 44 px par choix.
const ITEM =
  "flex min-h-11 w-full items-center gap-3 px-3.5 text-left text-body font-medium text-ink transition-colors hover:bg-surface-alt active:bg-surface-alt disabled:opacity-40 focus-visible:bg-surface-alt focus-visible:outline-none";

/**
 * Menu « … » d'un en-tête ou d'une carte : range les actions de gestion rares
 * (Réorganiser, Modifier, Archiver…) hors de la lecture. Clavier : le focus va
 * au premier choix à l'ouverture, flèches haut/bas, Échap rend le focus au
 * bouton ; un toucher ailleurs referme.
 */
export function MenuActions({
  actions,
  libelle = "Plus d'actions",
  libelleMenu,
}: {
  actions: readonly ActionMenu[];
  /** Nom accessible du bouton « … ». */
  libelle?: string;
  /** Nom accessible du menu ouvert. */
  libelleMenu: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const choixActifs = () => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

  useEffect(() => {
    if (ouvert) choixActifs()[0]?.focus();
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("pointerdown", dehors);
    return () => document.removeEventListener("pointerdown", dehors);
  }, [ouvert]);

  function auClavier(e: KeyboardEvent) {
    if (e.key === "Escape" && ouvert) {
      e.preventDefault();
      setOuvert(false);
      declencheur.current?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const choix = choixActifs();
    if (choix.length === 0) return;
    e.preventDefault();
    const courant = choix.indexOf(document.activeElement as HTMLButtonElement);
    const suivant = e.key === "ArrowDown" ? (courant + 1) % choix.length : (courant - 1 + choix.length) % choix.length;
    choix[suivant].focus();
  }

  if (actions.length === 0) return null;

  return (
    <div ref={racine} className="relative" onKeyDown={auClavier}>
      <button
        ref={declencheur}
        type="button"
        aria-label={libelle}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-control-border text-ink transition-[color,background-color,transform] hover:bg-surface-alt active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {ouvert && (
        <div
          ref={menu}
          role="menu"
          aria-label={libelleMenu}
          className="absolute right-0 top-[calc(100%+8px)] z-30 flex w-60 flex-col overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-float"
        >
          {actions.map((action) => (
            <button
              key={action.libelle}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => {
                setOuvert(false);
                action.onSelect();
              }}
              className={ITEM}
            >
              {action.icone}
              {action.libelle}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
