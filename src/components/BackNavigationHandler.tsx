"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { showToast } from "@/components/toast/toast-store";
import { useNavigationEdit } from "@/lib/navigation/NavigationEditContext";
import { parentRoute, retourHistoriqueAutorise } from "@/lib/navigation/parentRoute";

// Délai (ms) pendant lequel un second retour sur l'accueil quitte l'app.
const DELAI_DOUBLE_RETOUR_MS = 2000;

type EtatGarde = { kilioGarde?: boolean } | null;

// Garde installée une seule fois par chargement de document (insensible au
// double montage de StrictMode).
let gardeInstallee = false;

// Next réécrit le `history.state` de l'entrée vers laquelle on revient, ce
// qui efface un drapeau posé dessus : la garde est donc identifiée par la clé
// de son entrée (API Navigation, stable aux remplacements d'état), avec le
// drapeau dans le state en repli sur les navigateurs sans cette API.
type NavigationApi = {
  currentEntry: { key: string } | null;
  entries: () => { key: string }[];
};
const CLE_GARDE_STOCKAGE = "kilio:garde-retour";
let cleGarde: string | null = null;

function apiNavigation(): NavigationApi | null {
  return (window as unknown as { navigation?: NavigationApi }).navigation ?? null;
}

function estSurGarde(): boolean {
  const cle = apiNavigation()?.currentEntry?.key;
  if (cle && cleGarde) return cle === cleGarde;
  return (window.history.state as EtatGarde)?.kilioGarde === true;
}

/**
 * Rend le bouton/geste « retour » du téléphone prévisible :
 * - depuis une page, il mène toujours à son parent logique (voir
 *   `parentRoute`), quel que chemin ait été pris pour y arriver ;
 * - depuis l'accueil, un premier retour affiche « Appuie encore pour
 *   quitter », un second dans les 2 s quitte l'app.
 *
 * Les couches qui gèrent déjà leur propre retour (`useBackClose`, mode
 * édition de la navigation) poussent des entrées d'historique sur la MÊME
 * URL : un popstate qui n'a pas changé de chemin n'est donc jamais corrigé.
 *
 * Le routeur de Next enregistre son propre écouteur `popstate` avant le
 * nôtre et le traite en premier ; React commit même le nouveau chemin
 * avant que notre écouteur ne s'exécute. On ne peut donc pas lire « la
 * page d'où l'on vient » dans `usePathname()` au moment du popstate :
 * `changement` garde la dernière transition de chemin (et son horodatage)
 * pour la retrouver. Notre correction (`router.replace(parent)`) s'applique
 * ensuite par-dessus la navigation de Next.
 *
 * Mécanisme de sortie : au chargement, l'entrée courante devient une
 * « garde » (entrée de base) et on repousse une entrée identique au-dessus.
 * Arriver sur la garde = retour depuis la toute première page. Sur
 * l'accueil, on reste volontairement sur la garde : le retour suivant
 * quitte alors nativement l'app (aucune entrée avant elle).
 */
export function BackNavigationHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const { modulesBarreBasse } = useNavigationEdit();

  const pathnameRef = useRef(pathname);
  const changementRef = useRef<{ de: string; vers: string; instant: number } | null>(null);
  const modulesRef = useRef(modulesBarreBasse);
  useEffect(() => {
    if (pathnameRef.current !== pathname) {
      changementRef.current = { de: pathnameRef.current, vers: pathname, instant: performance.now() };
      pathnameRef.current = pathname;
    }
    modulesRef.current = modulesBarreBasse;
  });

  useEffect(() => {
    if (!gardeInstallee) {
      gardeInstallee = true;
      const nav = apiNavigation();
      let gardeExistante: string | null = null;
      try {
        // Rechargement du document : la garde posée avant existe encore
        // dans l'historique, inutile d'en empiler une seconde.
        const cle = sessionStorage.getItem(CLE_GARDE_STOCKAGE);
        if (cle && nav?.entries().some((entree) => entree.key === cle)) gardeExistante = cle;
      } catch {}
      if (gardeExistante) {
        cleGarde = gardeExistante;
      } else {
        const etat = (window.history.state ?? {}) as Record<string, unknown>;
        window.history.replaceState({ ...etat, kilioGarde: true }, "");
        cleGarde = nav?.currentEntry?.key ?? null;
        try {
          if (cleGarde) sessionStorage.setItem(CLE_GARDE_STOCKAGE, cleGarde);
        } catch {}
        window.history.pushState({}, "", window.location.href);
      }
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    // Chemin sur lequel on attend le second retour (null = pas en attente).
    let armeSur: string | null = null;

    function handlePopState(event: PopStateEvent) {
      const surGarde = estSurGarde();
      const arrivee = window.location.pathname;

      // Page d'où l'on vient : si Next a déjà fait commit le nouveau chemin
      // pendant cet événement, c'est l'origine de cette transition.
      const changement = changementRef.current;
      const dejaCommite = changement !== null && changement.vers === arrivee && changement.instant >= event.timeStamp;
      const courant = dejaCommite ? changement.de : pathnameRef.current;

      // Même chemin, pas la garde : couche (modale, menu, mode édition) ou
      // changement de query, géré par son propre code.
      if (!surGarde && arrivee === courant) return;

      const parent = parentRoute(courant, modulesRef.current);

      // Fiches du référentiel : le retour suit l'historique réel (voir
      // `retourHistoriqueAutorise`). Hors garde, Next affiche déjà la bonne
      // page : rien à corriger.
      const historique = retourHistoriqueAutorise(courant, arrivee);
      if (historique && !surGarde) return;

      if (surGarde) {
        // Déjà en attente du second retour sur cette page : un second retour
        // réel quitte nativement (aucun popstate). Une arrivée sur la garde
        // ne vient donc que d'une couche (modale) ouverte puis refermée
        // pendant le délai : on la laisse à son propre code.
        if (armeSur === courant) return;

        if (parent === null) {
          showToast("Appuie encore pour quitter", DELAI_DOUBLE_RETOUR_MS);
          armeSur = courant;
          // Next a pu afficher la page de lancement (URL de la garde) :
          // remettre l'accueil, en remplaçant la garde.
          if (arrivee !== "/") router.replace("/");
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            timer = null;
            armeSur = null;
            // Toujours sur la garde (pas de navigation entre-temps) :
            // restaurer l'entrée de l'accueil au-dessus d'elle.
            if (estSurGarde()) {
              window.history.pushState({}, "", "/");
            }
          }, DELAI_DOUBLE_RETOUR_MS);
        } else if (arrivee === parent || historique) {
          // Next affiche déjà la page de la garde, qui est le parent (ou une
          // page du référentiel autorisée) : il suffit de remettre une
          // entrée au-dessus d'elle.
          window.history.pushState({}, "", window.location.pathname + window.location.search);
        } else {
          router.push(parent);
        }
        return;
      }

      // Retour vers une entrée qui n'est pas le parent logique : on la
      // remplace par le parent.
      if (parent !== null && arrivee !== parent) router.replace(parent);
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  return null;
}
