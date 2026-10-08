"use client";

import { basculerTheme } from "@/lib/theme";

const toggleTheme = basculerTheme;

function AppearanceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-kcal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5z" />
    </svg>
  );
}

// Les deux libellés sont rendus côté serveur, la classe `dark:` choisit
// lequel afficher : pas d'état React, donc pas de mismatch d'hydratation.
export function AppearanceRow() {
  return (
    <div className="flex items-center justify-between gap-3 py-3.5">
      <span className="flex items-center gap-2.5 text-[14px] font-medium text-ink">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "color-mix(in oklch, var(--accent-kcal) 12%, transparent)" }}
        >
          <AppearanceIcon />
        </span>
        Apparence
      </span>
      <button
        type="button"
        onClick={toggleTheme}
        className="min-h-11 rounded-full bg-surface-alt px-4 text-[13px] font-semibold text-ink transition active:scale-[0.97] hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
      >
        <span className="dark:hidden">Clair</span>
        <span className="hidden dark:inline">Sombre</span>
      </button>
    </div>
  );
}
