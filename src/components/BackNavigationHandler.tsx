"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { showToast } from "@/components/toast/toast-store";
import { useNavigationEdit } from "@/lib/navigation/NavigationEditContext";
import { parentRoute } from "@/lib/navigation/parentRoute";

// Délai (ms) pendant lequel un second retour sur l'accueil quitte l'app.
const DELAI_DOUBLE_RETOUR_MS = 2000;

type EtatGarde = { kilioGarde?: boolean } | null;

// Garde installée une seule fois par chargement de document (insensible au
// double montage de StrictMode).
let gardeInstallee = false;

/**
 * Rend le bouton/geste « retour » du téléphone prévisible :
 * - depuis une page, il mène toujours à son parent logique (voir
 *   `parentRoute`), quel que chemin ait été pris pour y arriver ;
 * - depuis l'accueil, un premier retour affiche « Appuie encore pour
 *   quitter », un second dans les 2 s quitte l'app.
 *
 * Les couches qui gèrent déjà leur propre retour (`useBackClose`, mode
 * édition de la navigation) poussent des entrées d'historique sur la MÊME
 * URL : un popstate qui n'a pas changé de chemin n'est donc jamais intercepté.
 *
 * Mécanisme : au chargement, l'entrée courante devient une « garde »
 * (entrée de base) et on repousse une entrée identique au-dessus. Arriver
 * sur la garde = retour depuis la toute première page : on l'intercepte
 * avant le routeur de Next (phase de capture) au lieu de quitter l'app.
 * Sur l'accueil, on reste volontairement sur la garde : le retour suivant
 * quitte alors nativement l'app (aucune entrée avant elle).
 */
export function BackNavigationHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const { modulesBarreBasse } = useNavigationEdit();

  const pathnameRef = useRef(pathname);
  const modulesRef = useRef(modulesBarreBasse);
  useEffect(() => {
    pathnameRef.current = pathname;
    modulesRef.current = modulesBarreBasse;
  });

  useEffect(() => {
    if (!gardeInstallee) {
      gardeInstallee = true;
      const etat = (window.history.state ?? {}) as Record<string, unknown>;
      window.history.replaceState({ ...etat, kilioGarde: true }, "");
      window.history.pushState({}, "", window.location.href);
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    // Chemin sur lequel on attend le second retour (null = pas en attente).
    let armeSur: string | null = null;

    function handlePopState(event: PopStateEvent) {
      const etat = window.history.state as EtatGarde;
      const surGarde = etat?.kilioGarde === true;
      const courant = pathnameRef.current;

      // Même chemin, pas la garde : couche (modale, menu, mode édition) ou
      // changement de query, géré par son propre code.
      if (!surGarde && window.location.pathname === courant) return;

      const parent = parentRoute(courant, modulesRef.current);

      // Déjà en attente du second retour sur cette page : un second retour
      // réel quitte nativement (aucun popstate). Une arrivée sur la garde ne
      // vient donc que d'une couche (modale) ouverte puis refermée pendant
      // le délai : on la laisse à son propre code.
      if (surGarde && armeSur === courant) return;

      if (surGarde) {
        event.stopImmediatePropagation();
        if (parent === null) {
          showToast("Appuie encore pour quitter", DELAI_DOUBLE_RETOUR_MS);
          armeSur = courant;
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            timer = null;
            armeSur = null;
            // Toujours sur la garde (pas de navigation entre-temps) :
            // restaurer l'entrée de l'accueil au-dessus d'elle.
            if ((window.history.state as EtatGarde)?.kilioGarde) {
              window.history.pushState({}, "", "/");
            }
          }, DELAI_DOUBLE_RETOUR_MS);
        } else {
          router.push(parent);
        }
        return;
      }

      // Retour vers une entrée qui n'est pas le parent logique : on la
      // remplace par le parent, sans laisser le routeur de Next afficher
      // l'écran intermédiaire.
      if (parent !== null && window.location.pathname !== parent) {
        event.stopImmediatePropagation();
        router.replace(parent);
      }
    }

    window.addEventListener("popstate", handlePopState, true);
    return () => {
      window.removeEventListener("popstate", handlePopState, true);
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  return null;
}
