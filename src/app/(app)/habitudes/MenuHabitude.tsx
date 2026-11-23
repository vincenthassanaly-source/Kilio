"use client";

import { useEffect, useRef, useState } from "react";

const item =
  "flex min-h-11 w-full items-center px-3.5 text-left text-body font-medium text-ink transition-colors hover:bg-surface-alt active:bg-surface-alt disabled:opacity-40 focus-visible:bg-surface-alt focus-visible:outline-none";

/**
 * Menu « … » d'une carte d'habitude : les actions de gestion (Modifier,
 * Archiver), rangées hors de la zone de coche pour ne pas encombrer la carte.
 */
export function MenuHabitude({
  nom,
  disabled = false,
  onModifier,
  onArchiver,
}: {
  nom: string;
  disabled?: boolean;
  onModifier: () => void;
  onArchiver: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const choix = () => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

  useEffect(() => {
    if (ouvert) choix()[0]?.focus();
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("pointerdown", dehors);
    return () => document.removeEventListener("pointerdown", dehors);
  }, [ouvert]);

  function choisir(action: () => void) {
    setOuvert(false);
    action();
  }

  function auClavier(e: React.KeyboardEvent) {
    if (e.key === "Escape" && ouvert) {
      e.preventDefault();
      setOuvert(false);
      declencheur.current?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const liste = choix();
    if (liste.length === 0) return;
    e.preventDefault();
    const courant = liste.indexOf(document.activeElement as HTMLButtonElement);
    const suivant = e.key === "ArrowDown" ? (courant + 1) % liste.length : (courant - 1 + liste.length) % liste.length;
    liste[suivant].focus();
  }

  return (
    <div ref={racine} className="relative shrink-0" onKeyDown={auClavier}>
      <button
        ref={declencheur}
        type="button"
        aria-label={`Actions pour « ${nom} »`}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        disabled={disabled}
        onClick={() => setOuvert((o) => !o)}
        className="relative -my-1.5 -mr-1.5 flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 transition-[color,background-color,opacity,transform] hover:bg-surface-alt active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
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
          aria-label={`Actions pour « ${nom} »`}
          className="absolute right-0 top-[calc(100%+6px)] z-30 flex w-48 flex-col overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-float"
        >
          <button type="button" role="menuitem" onClick={() => choisir(onModifier)} className={item}>
            Modifier
          </button>
          <button type="button" role="menuitem" onClick={() => choisir(onArchiver)} className={item}>
            Archiver
          </button>
        </div>
      )}
    </div>
  );
}
