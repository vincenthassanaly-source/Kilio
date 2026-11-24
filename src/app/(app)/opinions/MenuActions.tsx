"use client";

import { useEffect, useRef, useState } from "react";

export type ActionMenu = {
  libelle: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Suppression (annulable par toast) : rangée en fin de menu, texte neutre, rouge au survol. */
  suppression?: boolean;
};

// Cible tactile de 44 px, comme les autres menus « … » de l'app.
const item =
  "flex min-h-11 w-full items-center px-3.5 text-left text-body font-medium transition-colors hover:bg-surface-alt active:bg-surface-alt disabled:opacity-40 focus-visible:bg-surface-alt focus-visible:outline-none";

/**
 * Variante locale du menu partagé `@/components/MenuActions` (même clavier),
 * qui ajoute le rangement des suppressions après un séparateur. Le bouton reste
 * sans contour : il se répète sous chaque proposition et ne doit pas peser sur
 * la lecture.
 *
 * Menu « … » des actions de gestion (modifier, reprendre, supprimer) : la
 * lecture reste épurée, la gestion est à un tap. Les suppressions viennent
 * toujours en dernier, après un séparateur, jamais en tête de menu.
 */
export function MenuActions({ libelle, actions }: { libelle: string; actions: readonly ActionMenu[] }) {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const courantes = actions.filter((a) => !a.suppression);
  const suppressions = actions.filter((a) => a.suppression);

  const elementsActifs = () =>
    Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

  // À l'ouverture, le focus va au premier choix (clavier et lecteur d'écran).
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

  function choisir(action: ActionMenu) {
    setOuvert(false);
    action.onSelect();
  }

  function auClavier(e: React.KeyboardEvent) {
    if (!ouvert) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOuvert(false);
      declencheur.current?.focus();
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

  const bouton = (action: ActionMenu) => (
    <button
      key={action.libelle}
      type="button"
      role="menuitem"
      disabled={action.disabled}
      onClick={() => choisir(action)}
      className={`${item} ${action.suppression ? "text-ink-2 hover:text-alert focus-visible:text-alert" : "text-ink"}`}
    >
      {action.libelle}
    </button>
  );

  return (
    <div ref={racine} className="relative shrink-0" onKeyDown={auClavier}>
      <button
        ref={declencheur}
        type="button"
        aria-label={libelle}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 transition-[color,background-color,transform] hover:bg-surface-alt active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
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
          aria-label={libelle}
          className="absolute right-0 top-[calc(100%+6px)] z-30 flex w-64 max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-float"
        >
          {courantes.map(bouton)}
          {courantes.length > 0 && suppressions.length > 0 && (
            <span className="mx-3.5 my-1 h-px bg-line" role="separator" />
          )}
          {suppressions.map(bouton)}
        </div>
      )}
    </div>
  );
}
