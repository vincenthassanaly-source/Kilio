// Calculs de zoom et de déplacement de l'aperçu agrandi d'une page. Purs, sans DOM.
//
// La vue est une transformation CSS `translate(x, y) scale(echelle)` appliquée à l'image avec
// l'origine au centre du conteneur. Les points (doigts, souris) sont exprimés relativement au
// centre du conteneur : un point `p` de l'image se retrouve à l'écran en `t + echelle × p`.

export type Point = { x: number; y: number };
export type Taille = { largeur: number; hauteur: number };
export type Vue = { echelle: number; x: number; y: number };

export const VUE_INITIALE: Vue = { echelle: 1, x: 0, y: 0 };
export const ZOOM_MAX = 6;
/** Échelle atteinte par un double-toucher sur une page entière. */
export const ZOOM_DOUBLE_TOUCHER = 2.5;

const borner = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Taille à l'écran de l'image ajustée au conteneur sans déformation (`object-fit: contain`). */
export function tailleAffichee(image: Taille, conteneur: Taille): Taille {
  const rapport = Math.min(conteneur.largeur / image.largeur, conteneur.hauteur / image.hauteur);
  return { largeur: image.largeur * rapport, hauteur: image.hauteur * rapport };
}

/**
 * Borne la vue : l'échelle reste dans [1, ZOOM_MAX], et l'image zoomée ne laisse jamais de vide
 * d'un côté tant qu'elle dépasse le conteneur. Sur un axe où elle tient entièrement, elle reste centrée.
 */
export function bornerVue(vue: Vue, image: Taille, conteneur: Taille): Vue {
  const echelle = borner(vue.echelle, 1, ZOOM_MAX);
  const affichee = tailleAffichee(image, conteneur);
  const maxX = Math.max(0, (affichee.largeur * echelle - conteneur.largeur) / 2);
  const maxY = Math.max(0, (affichee.hauteur * echelle - conteneur.hauteur) / 2);
  // `+ 0` ramène un éventuel -0 à 0 (borner(v, -0, 0) peut rendre -0).
  return { echelle, x: borner(vue.x, -maxX, maxX) + 0, y: borner(vue.y, -maxY, maxY) + 0 };
}

/** Passe à l'échelle `echelle` en gardant sous `point` le même endroit de l'image. */
export function zoomerAutour(vue: Vue, echelle: number, point: Point, image: Taille, conteneur: Taille): Vue {
  const cible = borner(echelle, 1, ZOOM_MAX);
  const rapport = cible / vue.echelle;
  return bornerVue(
    { echelle: cible, x: point.x - (point.x - vue.x) * rapport, y: point.y - (point.y - vue.y) * rapport },
    image,
    conteneur
  );
}

/**
 * Vue pendant un pincement à deux doigts, d'après la vue au début du geste (`vue0`, `milieu0`,
 * `distance0`) et l'état courant (`milieu`, `distance`). Écarter les doigts zoome, les déplacer
 * ensemble déplace l'image.
 */
export function pincer(
  vue0: Vue,
  milieu0: Point,
  distance0: number,
  milieu: Point,
  distance: number,
  image: Taille,
  conteneur: Taille
): Vue {
  if (distance0 <= 0) return vue0;
  const echelle = borner(vue0.echelle * (distance / distance0), 1, ZOOM_MAX);
  const rapport = echelle / vue0.echelle;
  return bornerVue(
    { echelle, x: milieu.x - (milieu0.x - vue0.x) * rapport, y: milieu.y - (milieu0.y - vue0.y) * rapport },
    image,
    conteneur
  );
}

/** Ramène un point de l'écran (px) à des coordonnées relatives au centre du conteneur. */
export function relatifAuCentre(client: Point, zone: { left: number; top: number; width: number; height: number }): Point {
  return { x: client.x - (zone.left + zone.width / 2), y: client.y - (zone.top + zone.height / 2) };
}
