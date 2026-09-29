"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { isModuleRootPath } from "@/lib/navigation/registry";

export type NavDirection = "avance" | "recule";

// Attribut posé sur <html> juste avant `startViewTransition()`, lu par les
// règles `::view-transition-old(root)` / `::view-transition-new(root)` de
// globals.css pour choisir le sens du slide. Retiré une fois la transition
// terminée (ou avortée) pour ne jamais laisser une valeur périmée traîner.
const NAV_DIRECTION_ATTR = "navDirection";

// Délai de sécurité purement lié à l'animation : au-delà, le callback de
// `startViewTransition` se résout même si le pathname n'a pas rejoint la
// cible, pour ne jamais laisser la View Transition elle-même bloquée
// indéfiniment. En pratique ce filet ne joue quasiment jamais de rôle actif
// : `SEUIL_INDICATEUR_MS` (largement plus court) a déjà résolu la promesse
// bien avant. Ne pilote ni l'indicateur de chargement ni `enAttente` —
// voir `TIMEOUT_ABANDON_MS` pour ça.
const TIMEOUT_NAVIGATION_MS = 3000;

// Au-delà de ce (court) délai sans que le pathname cible n'ait été atteint,
// on ne laisse plus l'écran totalement figé sans retour visuel : la
// transition en cours est résolue immédiatement (voir plus bas), révélant
// tel quel l'état courant du DOM (déjà le skeleton `loading.tsx` de la route
// cible si elle a eu le temps de commencer à streamer, sinon encore
// l'ancienne page) surmonté d'un indicateur discret (`useNavigationEnCours`,
// lu par ex. par TabSwipeWrapper). La navigation réelle continue en tâche de
// fond, hors View Transition dès cet instant, donc visible en direct dès
// qu'elle aboutit — sans attendre le filet de sécurité `TIMEOUT_NAVIGATION_MS`.
const SEUIL_INDICATEUR_MS = 180;

// Garde-fou final, bien plus long que les deux délais ci-dessus : si le
// pathname réel n'a toujours pas rejoint la cible après ce délai (navigation
// qui échoue silencieusement, panne réseau...), l'indicateur de chargement
// est coupé pour ne pas laisser un spinner éternel à l'écran. Tant que ce
// délai n'est pas écoulé, l'indicateur reste affiché même après
// `TIMEOUT_NAVIGATION_MS` : la latence réseau + Supabase + un éventuel cold
// start de fonction serverless (Vercel Hobby) dépasse couramment 3s, et
// couper l'indicateur à ce moment-là — alors que la navigation réelle est
// toujours en vol — donnait l'impression au tap de n'avoir rien fait,
// poussant à retaper (voir rapport 2026-09-11).
const TIMEOUT_ABANDON_MS = 12000;

type Listener = () => void;

// Store externe minimal (pas de Context) : `navigate()` peut être déclenché
// depuis n'importe quel composant (TransitionLink, BottomNav,
// TabSwipeWrapper...) sans lien de parenté React garanti avec celui qui
// affiche l'indicateur de chargement.
let navigationEnCours = false;
const listenersNavigationEnCours = new Set<Listener>();

function setNavigationEnCours(value: boolean) {
  if (navigationEnCours === value) return;
  navigationEnCours = value;
  listenersNavigationEnCours.forEach((listener) => listener());
}

/** Vrai tant qu'une navigation déclenchée par `useViewTransitionNavigate` a
 * dépassé `SEUIL_INDICATEUR_MS` sans avoir atteint sa cible : sert à afficher
 * un indicateur de chargement discret (voir TabSwipeWrapper). */
export function useNavigationEnCours(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listenersNavigationEnCours.add(listener);
      return () => listenersNavigationEnCours.delete(listener);
    },
    () => navigationEnCours,
    () => false
  );
}

type NavigationEnAttente = {
  target: string;
  resolve: () => void;
  seuilId: ReturnType<typeof setTimeout>;
  timeoutId: ReturnType<typeof setTimeout>;
  abandonId: ReturnType<typeof setTimeout>;
};

// Au niveau du module (pas d'une instance du hook) : le composant qui lance
// la navigation (ex. une tuile de /plus, une carte de liste, un bouton
// retour) se démonte justement quand `usePathname()` change, donc son propre
// `useEffect([pathname])` ne s'exécute jamais et ne pourrait pas libérer la
// promesse en attente. Seul un état partagé permet à n'importe quelle
// instance restée montée (BottomNav, TabSwipeWrapper dans le layout) de la
// résoudre à l'arrivée, sans attendre `SEUIL_INDICATEUR_MS` ni laisser
// l'indicateur allumé jusqu'à `TIMEOUT_ABANDON_MS`. Toujours au plus une
// navigation en attente, y compris entre instances différentes.
let enAttente: NavigationEnAttente | null = null;

// Déduit le sens avance/recule à partir de la hiérarchie des deux chemins
// (ex. /objectifs -> /objectifs/abc = avance, l'inverse = recule) quand
// l'appelant ne précise pas explicitement de direction (cas des onglets de
// la barre du bas, dont le sens suit l'ordre des onglets et pas la
// hiérarchie des routes — voir TabSwipeWrapper/BottomNav). Undefined si les
// deux chemins ne sont pas dans une relation parent/enfant (ex. bascule
// entre deux onglets sœurs comme /nutrition/journal <-> /nutrition/recettes) :
// dans ce cas le simple fondu existant s'applique, sans slide.
function deriveDirection(pathname: string, href: string): NavDirection | undefined {
  const cible = href.split("?")[0].split("#")[0];
  if (cible === pathname) return undefined;
  if (cible.startsWith(`${pathname}/`) || (pathname === "/" && cible !== "/")) return "avance";
  if (pathname.startsWith(`${cible}/`) || (cible === "/" && pathname !== "/")) return "recule";
  return undefined;
}

/**
 * Navigue vers `href` en enrobant `router.push` dans
 * `document.startViewTransition` quand l'API est disponible, avec un slide
 * directionnel (voir règles `::view-transition-old(root)` /
 * `::view-transition-new(root)` conditionnées par `[data-nav-direction]`
 * dans globals.css). `direction` peut être imposée explicitement (onglets de
 * la barre du bas, dont le sens suit l'ordre des onglets) ; sinon déduite de
 * la hiérarchie des deux chemins (`deriveDirection`). Feature detection
 * pure : fallback silencieux sur `router.push` direct sur les navigateurs
 * qui ne supportent pas encore l'API (Safari, Firefox), aucune erreur levée.
 *
 * `router.push` ne renvoie rien à attendre : lui seul dans le callback,
 * `startViewTransition` capturerait l'état "après" dès la fin (synchrone)
 * de cet appel, avant que la navigation App Router (fetch RSC + rendu de la
 * page cible) ne soit réellement effective, figeant l'écran sur l'ancienne
 * route jusqu'à ce que le vrai changement de DOM survienne (bascule brutale
 * sans transition visible). Le callback renvoie donc une Promise qui ne se
 * résout qu'une fois `usePathname()` reflète effectivement `href` (voir
 * l'effet ci-dessous) — ou, si la navigation tarde, dès `SEUIL_INDICATEUR_MS`
 * (l'indicateur de chargement prend le relais, voir plus bas). L'indicateur
 * reste ensuite affiché jusqu'à l'arrivée réelle ou, en dernier recours,
 * jusqu'à `TIMEOUT_ABANDON_MS`.
 */
export function useViewTransitionNavigate() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const courante = enAttente;
    if (courante && courante.target === pathname) {
      clearTimeout(courante.seuilId);
      clearTimeout(courante.timeoutId);
      clearTimeout(courante.abandonId);
      enAttente = null;
      setNavigationEnCours(false);
      courante.resolve();
    }
  }, [pathname]);

  return useCallback(
    (href: string, direction?: NavDirection) => {
      const target = href.split("?")[0].split("#")[0];

      // Une navigation vers cette même cible est déjà en attente : ignorer
      // ce tap plutôt que relancer push()/replace() depuis zéro. L'App
      // Router de Next.js ne fusionne ni n'annule les navigations
      // concurrentes — dispatchAction (app-router-instance.js) marque
      // l'action en cours `discarded` dès qu'une nouvelle ACTION_NAVIGATE
      // est dispatchée puis démarre immédiatement une requête RSC
      // indépendante — donc retaper pendant l'attente ne fait qu'ajouter
      // une requête concurrente sans jamais laisser la première aboutir,
      // ce qui explique qu'il fallait parfois plusieurs tentatives.
      // L'indicateur de chargement (déjà affiché, voir SEUIL_INDICATEUR_MS)
      // reste le seul retour visuel nécessaire pendant l'attente.
      if (enAttente?.target === target) return;

      // Transition entre deux routes racine de module (ex. /nutrition ->
      // /taches, ou /plus -> /agenda) : `replace` au lieu de `push`, pour ne
      // jamais empiler plus d'une entrée "module racine" au-dessus de
      // l'accueil — la flèche retour matérielle revient donc toujours
      // directement à l'accueil en un seul geste, quel que soit le nombre de
      // modules racine visités entretemps. Quitter l'accueil elle-même reste
      // un `push` : son entrée doit rester dans l'historique comme point
      // d'ancrage, sinon plus aucune entrée "/" n'y subsisterait pour que la
      // flèche retour puisse y revenir. La navigation en profondeur dans un
      // module (drill-down, ex. /taches -> /taches/listes/abc) n'est jamais
      // concernée : ni pathname ni target n'y correspond à une racine.
      const useReplace = pathname !== "/" && isModuleRootPath(pathname) && isModuleRootPath(target);
      const push = (h: string) => (useReplace ? router.replace(h) : router.push(h));

      if (typeof document !== "undefined" && "startViewTransition" in document) {
        const root = document.documentElement;
        const resolved = direction ?? deriveDirection(pathname, href);

        if (resolved) root.dataset[NAV_DIRECTION_ATTR] = resolved;
        else delete root.dataset[NAV_DIRECTION_ATTR];

        const transition = (
          document as Document & {
            startViewTransition: (callback: () => void | Promise<void>) => { finished: Promise<void> };
          }
        ).startViewTransition(() => {
          push(href);

          // Même pathname que l'actuel (query/hash seuls diffèrent, ou
          // onglet déjà actif) : `usePathname()` ne changera jamais, rien à
          // attendre (cas déjà écarté côté direction par `deriveDirection`).
          if (target === pathname) return;

          return new Promise<void>((resolve) => {
            const courante: NavigationEnAttente = {
              target,
              resolve,
              seuilId: setTimeout(() => {
                if (enAttente !== courante) return;
                // `flushSync` garantit que l'indicateur est bien peint avant
                // que `resolve()` ne fasse capturer l'état "new" par la View
                // Transition : sans ça, la mise à jour (planifiée via un
                // `setTimeout`, donc batchée par React 18) risquerait de ne
                // pas encore être dans le DOM au moment de la capture.
                flushSync(() => setNavigationEnCours(true));
                resolve();
              }, SEUIL_INDICATEUR_MS),
              // N'abandonne que l'animation (la promesse de la View
              // Transition) : ne touche ni à l'indicateur ni à
              // `enAttente`, qui doivent rester tant que la navigation
              // réelle n'a pas abouti (voir TIMEOUT_ABANDON_MS) ou échoué.
              timeoutId: setTimeout(() => {
                resolve();
              }, TIMEOUT_NAVIGATION_MS),
              abandonId: setTimeout(() => {
                if (enAttente !== courante) return;
                enAttente = null;
                setNavigationEnCours(false);
                resolve();
              }, TIMEOUT_ABANDON_MS),
            };
            // Une navigation vers une autre cible remplace celle en attente
            // (l'App Router abandonne de toute façon la première) : on libère
            // sa View Transition tout de suite plutôt que de la laisser
            // figée jusqu'à son propre timeout.
            if (enAttente) {
              clearTimeout(enAttente.seuilId);
              clearTimeout(enAttente.timeoutId);
              clearTimeout(enAttente.abandonId);
              enAttente.resolve();
            }
            enAttente = courante;
          });
        });

        transition.finished
          .catch(() => {})
          .finally(() => {
            delete root.dataset[NAV_DIRECTION_ATTR];
          });
      } else {
        push(href);
      }
    },
    [router, pathname]
  );
}
