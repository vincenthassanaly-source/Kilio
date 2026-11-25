// Boutons des écrans immersifs du Scanner (viseur, recadrage, aperçu) : fond noir
// indépendant du thème (exception « Scanner » de DESIGN.md), donc blanc translucide
// au lieu des tokens, mais même géométrie et même retour au tap que `primaryButton` /
// `secondaryButton` (16 px de rayon, 44 px de haut, `active:scale-[0.97]`).
//
// Ni marge interne ni retour à la ligne ici : le projet n'utilise pas tailwind-merge, donc
// l'appelant les choisit (`px-4 whitespace-nowrap`…) sans deux classes concurrentes.
const base =
  "inline-flex min-h-11 items-center justify-center rounded-2xl text-sm font-semibold transition-[background-color,opacity,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

/** Action secondaire sur fond noir (Annuler, Importer, Terminer…). */
export const boutonImmersif = `${base} bg-white/15 hover:bg-white/25`;

/** Action principale sur fond noir : aplat blanc, texte noir. */
export const boutonImmersifPrincipal = `${base} bg-white text-black focus-visible:ring-offset-2 focus-visible:ring-offset-black`;

/** Bouton rond à icône seule (fermer, page précédente / suivante). */
export const boutonRondImmersif =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 transition-[background-color,opacity,transform] duration-150 ease-[var(--ease-out)] hover:bg-white/25 active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
