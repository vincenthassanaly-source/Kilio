// Animations d'exercices (vidéos WebM transparentes rendues avec Hyperframes,
// servies depuis public/animations/musculation). La colonne `exercices.animation`
// porte la clé ; seules les clés connues ici donnent une URL, ce qui évite de
// construire un chemin à partir d'une valeur arbitraire de la base.
//
// Garder cette liste identique à ANIMATIONS de public/sw.js (précache hors ligne) :
// animations.test.ts compare les deux.

export const ANIMATIONS = [
  "elevation-laterale",
  "developpe-couche",
  "developpe-couche-incline",
  "planche",
  "planche-laterale",
  "crunch",
  "abdos-ciseaux",
  "releve-jambe-barres-paralleles",
  "extension-dos-hyperextension",
  "leg-curl-assis",
  "extension-jambes",
  "adduction-hanche",
  "presse-mollets",
  "presse-cuisses-horizontale",
  "tirage-poitrine-poulie",
  "curl-marteau",
  "curl-biceps",
  "extension-triceps-poulie-haute",
  "chest-press-machine",
  "developpe-epaules-machine",
  "extension-triceps-machine",
  "butterfly",
  "curl-biceps-machine",
  "tirage-poitrine-prise-serree",
  "releve-genoux-allonge",
  "toucher-orteils",
  "developpe-couche-barre",
  "curl-biceps-barre",
  "shrug-haltere",
  "extension-triceps-corde",
  "curl-marteau-poulie",
  "tirage-visage",
  "squat-barre",
  "releve-bassin-barre",
  "rowing-haltere",
  "curl-poignets-inverse-haltere",
  "seal-row-haltere",
  "ecarte-haltere",
  "developpe-arnold-haltere",
  "developpe-militaire-haltere",
  "elevation-frontale-haltere",
  "elevation-y-banc-incline",
  "dips-banc",
  "dips-sol",
  "tractions",
  "tractions-supination",
  "rowing-poulie-assis",
  "rowing-assis-machine",
  "rowing-penche-haltere",
  "rowing-incline-buste-appuye",
  "oiseau-penche-haltere",
  "elevation-disque-frontale",
  "developpe-epaules-haltere",
  "superman",
  "dead-bug",
  "sit-up-jackknife",
] as const;

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
