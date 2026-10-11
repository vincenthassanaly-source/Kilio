// Animations d'exercices (vidéos WebM transparentes rendues avec Hyperframes,
// servies depuis public/animations/musculation). La colonne `exercices.animation`
// porte la clé ; seules les clés connues ici donnent une URL, ce qui évite de
// construire un chemin à partir d'une valeur arbitraire de la base.
//
// Garder cette liste identique à ANIMATIONS de public/sw.js (précache hors ligne) :
// animations.test.ts compare les deux.

export const ANIMATIONS = ["elevation-laterale", "developpe-couche", "developpe-couche-incline"] as const;

export type CleAnimation = (typeof ANIMATIONS)[number];

const DOSSIER = "/animations/musculation";

export function estCleAnimation(valeur: unknown): valeur is CleAnimation {
  return typeof valeur === "string" && (ANIMATIONS as readonly string[]).includes(valeur);
}

/** Clé reconnue, ou `null` (exercice sans animation : rien n'est affiché). */
export function cleAnimationOuNull(valeur: unknown): CleAnimation | null {
  return estCleAnimation(valeur) ? valeur : null;
}

export const urlVideo = (cle: CleAnimation) => `${DOSSIER}/${cle}.webm`;
/** Image fixe prise au sommet du mouvement. */
export const urlPoster = (cle: CleAnimation) => `${DOSSIER}/${cle}.webp`;
