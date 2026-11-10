"use client";

import { useEffect, useRef, useState } from "react";

export type ListeChoix = { id: string; nom: string; couleur: string | null };

type Props = {
  listes: readonly ListeChoix[];
  /** « toutes » ou l'id d'une liste. */
  valeur: string;
  onChange: (id: string) => void;
};

const TOUTES: ListeChoix = { id: "toutes", nom: "Toutes", couleur: null };

// Cible tactile de 44 px (guide UX : zone minimale).
const item =
  "flex min-h-11 w-full items-center gap-2.5 px-3.5 text-left text-body font-medium transition hover:bg-surface-alt active:bg-surface-alt focus-visible:bg-surface-alt focus-visible:outline-none";

function Pastille({ couleur }: { couleur: string | null }) {
  return (
    <span
      className="h-[9px] w-[9px] shrink-0 rounded-full"
      style={{ background: couleur ?? "var(--ink-3)" }}
      aria-hidden="true"
    />
  );
}

/**
 * Sélecteur de liste : un tap ouvre le menu, un second choisit. Remplace la
 * rangée de pastilles qui vivait dans la modale « Filtres et tri ».
 */
export function ListeSelect({ listes, valeur, onChange }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const choix = [TOUTES, ...listes];
  const active = choix.find((l) => l.id === valeur) ?? TOUTES;

  const elements = () => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);

  // À l'ouverture, le focus va à la liste active (clavier et lecteur d'écran).
  useEffect(() => {
    if (!ouvert) return;
    const el = menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ?? elements()[0];
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
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

  function auClavier(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      fermer(true);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const els = elements();
    if (els.length === 0) return;
    e.preventDefault();
    const courant = els.indexOf(document.activeElement as HTMLButtonElement);
    const suivant = e.key === "ArrowDown" ? (courant + 1) % els.length : (courant - 1 + els.length) % els.length;
    els[suivant].focus();
  }

  return (
    <div ref={racine} className="relative min-w-0" onKeyDown={auClavier}>
      <button
        ref={declencheur}
        type="button"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label={`Liste : ${active.nom}`}
        onClick={() => setOuvert((o) => !o)}
        className="flex min-h-11 max-w-full items-center gap-2 rounded-full border border-control-border bg-surface px-3.5 text-label font-semibold text-ink transition-colors hover:bg-surface-alt active:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
      >
        {active.id !== "toutes" && <Pastille couleur={active.couleur} />}
        <span className="min-w-0 truncate">{active.nom}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 text-ink-3 transition-transform motion-reduce:transition-none ${ouvert ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {ouvert && (
        <div
          ref={menu}
          role="menu"
          aria-label="Choisir une liste"
          data-swipe-ignore
          className="absolute left-0 top-[calc(100%+8px)] z-30 flex max-h-[min(60vh,22rem)] w-64 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto overflow-x-hidden rounded-2xl border border-line bg-surface py-1 shadow-card"
        >
          {choix.map((l, i) => {
            const actif = l.id === valeur;
            return (
              <div key={l.id} className="contents">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={actif}
                  onClick={() => {
                    fermer(true);
                    onChange(l.id);
                  }}
                  className={`${item} ${actif ? "text-kcal" : "text-ink"}`}
                >
                  {l.id === "toutes" ? <span className="w-[9px] shrink-0" aria-hidden="true" /> : <Pastille couleur={l.couleur} />}
                  <span className="min-w-0 flex-1 truncate">{l.nom}</span>
                  {actif && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  )}
                </button>
                {i === 0 && <span className="mx-3.5 my-1 h-px bg-line" role="separator" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
