"use client";

import { motion, AnimatePresence } from "framer-motion";

/** Bouton rond à coche, remplace les `<input type="checkbox">` natifs pour
 * matcher le style de la maquette (cercle plein coché, contour sinon).
 * Micro-feedback au check : léger "pop" du cercle + tracé du check qui se
 * dessine, ~180ms — assez court pour ne pas ralentir la perception du tap.
 *
 * `hitSlop` étend la zone de tap invisible au-delà du cercle visuel (overlay
 * `position: absolute` sur un bouton `position: relative`, donc sans
 * agrandir la boîte du bouton dans le flux ni décaler le layout des listes
 * existantes — voir reports/2026-09-16-fix-dashboard-audit-constats-1-2.md).
 * Par défaut 11px (cercle 22px -> cible 44×44px), sûr partout où une seule
 * coche existe par carte/ligne isolée (ex. TaskCard, CourseItemRow). Les
 * listes qui empilent plusieurs coches dans une même carte avec un `gap`
 * serré (Dashboard "Aujourd'hui", étapes d'objectif, items de note,
 * sous-tâches) passent une valeur plus petite, calculée pour que deux zones
 * de tap voisines ne se chevauchent jamais (2×hitSlop ≤ gap entre lignes). */
export function CheckToggle({
  checked,
  onToggle,
  disabled,
  size = 22,
  hitSlop = 11,
  color = "var(--accent-kcal)",
  label,
  className = "",
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: number;
  hitSlop?: number;
  color?: string;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      aria-label={label}
      aria-pressed={checked}
      className={`relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2 ${className}`}
    >
      {hitSlop > 0 && <span aria-hidden="true" className="absolute" style={{ inset: -hitSlop }} />}
      <motion.span
        className="flex items-center justify-center rounded-full border-2"
        style={{
          width: size,
          height: size,
          // `--control-border` (≥ 3:1) au lieu de `--line` (≈ 1,3:1), T5.
          borderColor: checked ? color : "var(--control-border)",
          background: checked ? color : "transparent",
        }}
        animate={checked ? { scale: [1, 1.12, 1] } : { scale: 1 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnimatePresence>
          {checked && (
            <motion.svg
              width={size * 0.5}
              height={size * 0.5}
              viewBox="0 0 12 12"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <path d="M1 6l3.2 3.2L11 2" stroke="var(--on-accent)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.span>
    </button>
  );
}
