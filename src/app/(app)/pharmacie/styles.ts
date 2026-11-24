// Fragments de classes propres au module Pharmacie.
//
// `card` (lib/ui) impose `p-4` et `bg-surface` : y ajouter `p-0` ou un fond
// teinté ne fait rien, car Tailwind émet `p-4` et `bg-surface` après ces
// valeurs. Les conteneurs sans marge interne et les fiches teintées partent
// donc de la même carte, sans ces deux propriétés.
const carteSansFond = "rounded-card border border-line shadow-card";

/** Carte de liste dont les lignes portent leur propre marge (groupe repliable, noms commerciaux). */
export const carteNue = `${carteSansFond} bg-surface`;

/** Fiche du référentiel : carte teintée à 7 % de la couleur de la classe (`--classe`). */
export const carteClasse = `${carteSansFond} p-4 bg-[color-mix(in_oklch,var(--classe)_7%,var(--surface))]`;

const anneau = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

/**
 * Pastille de choix (filtres des huiles, profil d'une pathologie) : même
 * grammaire que les chips de filtre des Tâches — 44 px, contour de contrôle
 * (≥ 3:1) au repos, actif plein en vert Kcal comme un segment.
 */
export function classePuce(actif: boolean): string {
  return `inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-label font-semibold transition-[color,background-color,border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97] ${anneau} ${
    actif ? "border-kcal bg-kcal text-on-kcal" : "border-control-border bg-surface text-ink"
  }`;
}

/** Pastille-lien vers une autre fiche (composant d'une association, protocole d'une classe). */
export const pastilleLien = `inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-3.5 text-label font-semibold text-ink transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-surface-alt active:scale-[0.97] ${anneau}`;
