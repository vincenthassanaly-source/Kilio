"use client";

import { useLayoutEffect, type RefObject } from "react";
import { usePathname } from "next/navigation";

const STORAGE_PREFIX = "kilio:scroll:";

// Délai max (ms) pendant lequel on attend que le contenu soit assez haut pour
// atteindre la position sauvegardée (squelette, données réseau...).
const DELAI_MAX_RESTAURATION_MS = 3000;
// Un changement de route est un « retour » si un popstate vient juste de
// précéder (le routeur de Next commit le chemin dans la foulée).
const FENETRE_RETOUR_MS = 2000;

let dernierPopstate = Number.NEGATIVE_INFINITY;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    dernierPopstate = performance.now();
  });
}

/**
 * Restaure l'offset de scroll de `ref` (le `<main>` commun à toutes les
 * pages de `(app)`, voir TabSwipeWrapper — pas `window`, l'app ne scrolle
 * jamais la fenêtre) lors d'un RETOUR (popstate) sur une route déjà visitée,
 * et le persiste en continu dans `sessionStorage` (clé = pathname) pendant
 * que l'utilisateur scrolle. Toute autre arrivée (lien, onglet) repart en
 * haut, comme une navigation neuve. `<main>` restant monté d'une navigation
 * à l'autre (layout partagé de `(app)`, seuls ses enfants changent), un seul
 * appel de ce hook dans TabSwipeWrapper couvre génériquement toutes les
 * listes scrollables de l'app.
 *
 * Au retour, le contenu n'est souvent pas encore rendu (squelette, données
 * en cours de chargement) : `<main>` est trop court et le navigateur plafonne
 * le scroll, ce qui écrasait la position sauvegardée par 0. On réessaie donc
 * à chaque frame jusqu'à ce que la hauteur suffise (ou délai max / geste de
 * l'utilisateur), sans rien sauvegarder pendant l'attente.
 */
export function useScrollRestoration(ref: RefObject<HTMLElement | null>) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const cle = `${STORAGE_PREFIX}${pathname}`;
    const estRetour = performance.now() - dernierPopstate < FENETRE_RETOUR_MS;

    let cible = 0;
    if (estRetour) {
      try {
        const sauvegarde = sessionStorage.getItem(cle);
        if (sauvegarde) cible = Number(sauvegarde);
      } catch {
        // sessionStorage indisponible (navigation privée stricte...) : on
        // reste simplement en haut de page, sans bloquer le rendu.
      }
    }
    if (!Number.isFinite(cible) || cible < 0) cible = 0;

    let enAttente = false;
    let rafId = 0;
    let delaiId: ReturnType<typeof setTimeout> | undefined;

    function arreterAttente() {
      enAttente = false;
      cancelAnimationFrame(rafId);
      clearTimeout(delaiId);
    }

    if (cible === 0) {
      if (el.scrollTop !== 0) el.scrollTop = 0;
    } else {
      el.scrollTop = cible;
      if (Math.abs(el.scrollTop - cible) > 1) {
        // Contenu trop court pour l'instant : on patiente sans sauvegarder.
        enAttente = true;
        const essayer = () => {
          if (!enAttente) return;
          el.scrollTop = cible;
          if (Math.abs(el.scrollTop - cible) <= 1) {
            arreterAttente();
          } else {
            rafId = requestAnimationFrame(essayer);
          }
        };
        rafId = requestAnimationFrame(essayer);
        // Position inatteignable (contenu devenu plus court) : on abandonne.
        delaiId = setTimeout(arreterAttente, DELAI_MAX_RESTAURATION_MS);
      }
    }

    function handleScroll() {
      if (enAttente) return;
      try {
        sessionStorage.setItem(cle, String(el!.scrollTop));
      } catch {
        // Idem : échec silencieux, la restauration est un confort, pas une
        // garantie fonctionnelle.
      }
    }

    // Un geste de l'utilisateur prend le dessus sur la restauration en cours.
    el.addEventListener("scroll", handleScroll, { passive: true });
    el.addEventListener("touchstart", arreterAttente, { passive: true });
    el.addEventListener("wheel", arreterAttente, { passive: true });
    return () => {
      arreterAttente();
      el.removeEventListener("scroll", handleScroll);
      el.removeEventListener("touchstart", arreterAttente);
      el.removeEventListener("wheel", arreterAttente);
    };
  }, [ref, pathname]);
}
