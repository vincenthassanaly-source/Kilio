"use client";

import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { useSwipeHorizontal, type SensSwipe } from "@/hooks/useSwipeHorizontal";
import { useViewTransitionNavigate, useNavigationEnCours } from "@/hooks/useViewTransitionNavigate";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { useNavigationEdit } from "@/lib/navigation/NavigationEditContext";

// Routes possédant leur propre swipe horizontal interne (changement de
// jour/semaine, historique...) : les événements `onTouchStart/Move/End` de
// React bubblent jusqu'à `<main>`, donc attacher aussi les handlers de swipe
// entre onglets sur ces routes exactes déclencherait les deux détections
// pour un même geste et casserait le swipe interne (constaté sur Agenda).
// Exclues du swipe entre onglets sur `<main>` même si épinglées en barre du
// bas — mais une bande dédiée tout en haut de l'écran (`ZoneSwipeHaut`
// ci-dessous, au-dessus du sélecteur de vues Jour/Semaine/Mois/Liste sur
// Agenda) réactive quand même le swipe entre onglets sur ces routes, sans
// conflit puisque `<main>` n'y a aucun handler attaché.
// « Vider ma tête » : un trait de stylet horizontal ne doit jamais changer d'onglet.
const ROUTES_SWIPE_INTERNE = ["/agenda", "/vider-ma-tete"];

// Hauteur (hors safe-area) de la bande vide en haut de `<main>`, au-dessus
// du contenu de page : sert à la fois de `paddingTop` de `<main>` et de
// hauteur pour `ZoneSwipeHaut`, pour que les deux valeurs ne divergent
// jamais.
const HAUTEUR_ZONE_HAUT_PX = 64;

/**
 * Enrobe le `<main>` commun à toutes les pages de `(app)` pour détecter un
 * swipe horizontal entre les onglets épinglés en barre du bas. L'ordre suivi
 * est celui, dynamique et personnalisable, de `modulesBarreBasse`
 * (`NavigationEditContext`) — pas de notion d'ordre linéaire pour "Plus",
 * toujours exclu de ce tableau. Le hook de détection (`useSwipeHorizontal`,
 * déjà utilisé par Agenda et le Journal Nutrition pour naviguer entre dates)
 * n'est réellement branché sur `<main>` que sur les routes exactes présentes
 * dans `modulesBarreBasse` et hors `ROUTES_SWIPE_INTERNE` : sur les
 * sous-routes (/agenda/..., /nutrition/journal, /nutrition/recettes...) et
 * sur Agenda lui-même, les handlers ne sont pas attachés du tout, pour ne
 * jamais entrer en conflit avec un swipe dates/semaines déjà présent sur ces
 * écrans.
 *
 * Porte aussi la restauration du scroll (`useScrollRestoration`) : `<main>`
 * étant le seul conteneur scrollable de l'app (pas `window`) et restant
 * monté d'une navigation à l'autre, un seul hook ici couvre génériquement
 * toutes les listes scrollables de l'app.
 */
export function TabSwipeWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const navigate = useViewTransitionNavigate();
  const navigationEnCours = useNavigationEnCours();
  const { modulesBarreBasse } = useNavigationEdit();

  const indexOngletActif = modulesBarreBasse.indexOf(pathname);
  const actif = indexOngletActif !== -1 && !ROUTES_SWIPE_INTERNE.includes(pathname);

  function handleSwipe(sens: SensSwipe) {
    // Garde sur `indexOngletActif` (pas `actif`) : `actif` ne vaut jamais
    // `true` sur les routes de `ROUTES_SWIPE_INTERNE`, alors que
    // `ZoneSwipeHaut` a justement besoin d'y déclencher la navigation.
    if (indexOngletActif === -1) return;
    const prochainIndex = indexOngletActif + (sens === "suivant" ? 1 : -1);
    if (prochainIndex < 0 || prochainIndex >= modulesBarreBasse.length) return;
    navigate(modulesBarreBasse[prochainIndex], sens === "suivant" ? "avance" : "recule");
  }

  const swipeHandlers = useSwipeHorizontal(handleSwipe);

  // Deuxième instance dédiée à `ZoneSwipeHaut` : indépendante de
  // `swipeHandlers` ci-dessus (qui reste, elle, réservée à `<main>`) mais
  // réutilise la même `handleSwipe`, donc la même logique de navigation.
  const swipeHandlersZoneHaut = useSwipeHorizontal(handleSwipe);
  const estOngletEpingle = modulesBarreBasse.includes(pathname);
  const zoneSwipeHautActive = ROUTES_SWIPE_INTERNE.includes(pathname) && estOngletEpingle;

  const mainRef = useRef<HTMLElement>(null);
  useScrollRestoration(mainRef);

  return (
    <>
      {navigationEnCours && (
        <div
          className="fixed inset-x-0 z-50 h-[3px] overflow-hidden"
          style={{ top: "env(safe-area-inset-top)" }}
        >
          <div className="kilio-barre-navigation-progression h-full w-1/3" style={{ background: "var(--accent-kcal)" }} />
        </div>
      )}
      {zoneSwipeHautActive && (
        <div
          className="fixed inset-x-0 top-0 z-30"
          style={{ height: `calc(env(safe-area-inset-top) + ${HAUTEUR_ZONE_HAUT_PX}px)` }}
          {...swipeHandlersZoneHaut}
        />
      )}
      <main
        ref={mainRef}
        className="flex-1 overflow-x-hidden overflow-y-auto px-4"
        style={{
          paddingTop: `calc(env(safe-area-inset-top) + ${HAUTEUR_ZONE_HAUT_PX}px)`,
          paddingBottom: "calc(env(safe-area-inset-bottom) + 112px)",
          overscrollBehaviorY: "contain",
        }}
        {...(actif ? swipeHandlers : {})}
      >
        {children}
      </main>
    </>
  );
}
