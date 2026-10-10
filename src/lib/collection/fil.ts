// Logique pure du fil vidéo plein écran du module Collection : sélection des
// vidéos d'un classeur et calcul de l'index affiché à partir du scroll.

import { estTypeVideo } from "./video";

/** Ne garde que les vidéos TikTok/YouTube, dans l'ordre reçu (celui de la grille). */
export function videosDuFil<T extends { type: string }>(items: readonly T[]): T[] {
  return items.filter((item) => estTypeVideo(item.type));
}

/** Index de la vidéo `id` dans le fil, ou 0 si elle est introuvable. */
export function indexDepart(videos: readonly { id: string }[], id: string): number {
  const index = videos.findIndex((v) => v.id === id);
  return index === -1 ? 0 : index;
}

/** Index de l'écran visible pour une position de scroll donnée, borné au fil. */
export function indexDepuisScroll(scrollTop: number, hauteurEcran: number, total: number): number {
  if (total <= 0 || hauteurEcran <= 0) return 0;
  return Math.min(total - 1, Math.max(0, Math.round(scrollTop / hauteurEcran)));
}

/** Index cible d'un pas de navigation (−1 / +1), sans boucle en fin de fil. */
export function indexApresPas(courant: number, pas: -1 | 1, total: number): number {
  return Math.min(total - 1, Math.max(0, courant + pas));
}
