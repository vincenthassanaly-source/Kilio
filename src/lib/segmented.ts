// Classes du contrôle segmenté, dans un module sans directive "use client" :
// elles servent aussi aux rendus serveur.
// Composant interactif : components/SegmentedControl.tsx.

export const SEGMENT_CADRE = "flex gap-1 rounded-2xl bg-surface-alt p-1";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

export function segmentClasse(actif: boolean, taille: "md" | "sm" = "md") {
  return `relative flex min-h-11 flex-1 items-center justify-center rounded-xl px-1 text-center ${
    taille === "sm" ? "text-[13px]" : "text-[13.5px]"
  } font-semibold transition-colors ${FOCUS} ${actif ? "bg-kcal text-on-kcal" : "text-ink-2 hover:text-ink"}`;
}

/**
 * Variante pour un segment dont le fond actif est une pastille glissante
 * (voir `SegmentedPill` dans `components/SegmentedControl.tsx`) plutôt que
 * la classe statique `bg-kcal` : le fond est retiré de la classe, le label
 * doit alors être enveloppé dans un `<span className="relative ...">` pour
 * rester au-dessus de la pastille (positionnée en `absolute inset-0`).
 */
export function segmentClasseGlissant(taille: "md" | "sm" = "md") {
  return segmentClasse(false, taille).replace("text-ink-2 hover:text-ink", "");
}
