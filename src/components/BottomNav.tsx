"use client";

import { PastilleInbox } from "@/components/PastilleInbox";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import { useViewTransitionNavigate } from "@/hooks/useViewTransitionNavigate";
import { findNavItem, resolveActiveHref } from "@/lib/navigation/registry";
import { useNavigationEdit, BOTTOM_BAR_SLOT_PREFIX } from "@/lib/navigation/NavigationEditContext";

const PLUS_ICON = (c: string) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
  </svg>
);

// layoutId partagé par le fond de l'onglet actif (les 4 slots ET le bouton
// "Plus") : à tout instant un seul d'entre eux le monte, et framer-motion
// anime automatiquement sa position/taille entre l'ancien et le nouveau
// slot actif (transition "layout" classique, pas besoin d'AnimatePresence
// puisqu'il n'y a jamais deux instances montées en même temps).
const ACTIVE_PILL_LAYOUT_ID = "bottom-nav-active-pill";

// Transition spring douce (comportement normal) vs. quasi-instantanée si
// `prefers-reduced-motion: reduce` est actif. Le pill est animé par
// framer-motion via des mutations directes de `transform` (Web Animations
// API), pas par la propriété CSS `transition` : une règle dans globals.css
// n'aurait donc aucune prise dessus, contrairement aux autres animations
// (CSS keyframes, View Transitions) déjà neutralisées là-bas. `useReducedMotion`
// est la seule façon effective de respecter la préférence ici.
function pillTransition(reduceMotion: boolean) {
  return reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 500, damping: 40 };
}

// `motion(Link)` plutôt qu'un `motion.span` interne : le feedback tactile
// doit s'appliquer à toute la zone cliquable (icône + label), pas juste à
// un enfant, pour un "press" naturel au doigt sur toute la cible.
const MotionLink = motion(Link);

// Fond de l'onglet actif : enfant supplémentaire du slot, positionné derrière
// l'icône + le label (grâce à l'ordre de peinture des éléments flex, qui
// place cet élément `position: absolute` sous les items flex statiques
// suivants). N'intercepte aucun événement pointer (`pointer-events: none`)
// et ne touche ni au ref `setNodeRef` de useDroppable ni à l'outline de
// dépôt, portés par le slot parent.
// Rayon concentrique : la pile (comme le slot lui-même, cf. rounded-[19px]
// plus bas) épouse le rayon de <nav> (26px) moins son padding (7px) = 19px,
// pas une valeur arbitraire — sinon la pile paraît "flotter" dans son coin
// au lieu de suivre le contour de la barre.
function ActivePill({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.div
      layoutId={ACTIVE_PILL_LAYOUT_ID}
      className="absolute inset-0 rounded-[19px] pointer-events-none"
      style={{ background: "var(--accent-kcal-soft)" }}
      transition={pillTransition(reduceMotion)}
    />
  );
}

// Chaque emplacement configurable est une zone `useDroppable` distincte
// (id `bottombar-slot-{index}`, lu par NavigationEditContext.handleDragEnd)
// pour que déposer une tuile de ModulesGrid dessus l'épingle à cet index.
function BottomNavSlot({
  href,
  index,
  active,
  isDropTarget,
  reduceMotion,
  onClick,
}: {
  href: string;
  index: number;
  active: boolean;
  isDropTarget: boolean;
  reduceMotion: boolean;
  onClick: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const item = findNavItem(href);
  const { setNodeRef, isOver } = useDroppable({ id: `${BOTTOM_BAR_SLOT_PREFIX}${index}` });

  if (!item) return null;

  const color = active ? "var(--accent-kcal)" : "var(--ink-3)";
  const showDropRing = isDropTarget && isOver;

  return (
    <MotionLink
      ref={setNodeRef}
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      whileTap={reduceMotion ? undefined : { scale: 0.94 }}
      className="relative flex flex-col items-center gap-0.5 rounded-[19px] px-3 py-[7px] transition-colors"
      style={{
        outline: showDropRing ? "2px dashed var(--accent-kcal)" : undefined,
        outlineOffset: showDropRing ? "2px" : undefined,
      }}
    >
      {active && <ActivePill reduceMotion={reduceMotion} />}
      {item.icon(color)}
      {item.href === "/inbox" && <PastilleInbox className="right-1.5 top-0.5" />}
      <span className="text-[11px]" style={{ color, fontWeight: active ? 700 : 500 }}>
        {item.label}
      </span>
    </MotionLink>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const navigate = useViewTransitionNavigate();
  const { modulesBarreBasse, activeHref } = useNavigationEdit();
  const reduceMotion = useReducedMotion() ?? false;

  // Un drag est en cours depuis ModulesGrid (voir NavigationEditContext) :
  // les 4 emplacements deviennent des zones de dépôt visibles.
  const isDropTarget = activeHref !== null;

  const activeItemHref = resolveActiveHref(pathname);
  // Le bouton "Plus" est actif soit sur /plus elle-même (qui n'est pas un
  // item du registre NAV_ITEMS, donc activeItemHref y vaut toujours null),
  // soit dès que l'onglet résolu n'est ni l'accueil ni l'un des 4 modules
  // actuellement épinglés en barre du bas (ex. /agenda tant qu'Agenda n'est
  // pas épinglé).
  const plusActive =
    pathname === "/plus" ||
    pathname.startsWith("/plus/") ||
    (activeItemHref !== null && !modulesBarreBasse.includes(activeItemHref));

  // Ordre visuel complet des emplacements de la barre (les 4 slots
  // configurables puis "Plus" toujours en dernier) : sert à déterminer le
  // sens du slide selon que l'onglet ciblé est visuellement à droite ou à
  // gauche de l'onglet actif, indépendamment de la hiérarchie des routes.
  const ordreVisuel = [...modulesBarreBasse, "/plus"];
  function indexVisuel(href: string | null): number {
    if (href === null) return ordreVisuel.length - 1;
    const index = ordreVisuel.indexOf(href);
    return index !== -1 ? index : ordreVisuel.length - 1;
  }

  function handleClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
    // Ne bloque la navigation native de <Link> (et son prefetch) que si
    // l'API View Transitions est disponible : sinon on laisse Next.js gérer
    // la navigation comme avant, sans rien casser sur Safari/Firefox.
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      e.preventDefault();
      const indexActuel = indexVisuel(activeItemHref);
      const indexCible = indexVisuel(href);
      const direction = indexCible === indexActuel ? undefined : indexCible > indexActuel ? "avance" : "recule";
      navigate(href, direction);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+14px)]">
      {/* `view-transition-name` : sort la barre de la transition "root" (sinon elle
          glisse et se dédouble avec la page, voir globals.css) — elle reste
          fixe pendant que seule la page change. */}
      <nav
        className="flex items-center gap-0.5 rounded-[26px] border border-line bg-nav p-[7px] shadow-card backdrop-blur-xl"
        style={{ viewTransitionName: "bottom-nav" }}
      >
        {modulesBarreBasse.map((href, index) => (
          <BottomNavSlot
            key={`${href}-${index}`}
            href={href}
            index={index}
            active={activeItemHref === href}
            isDropTarget={isDropTarget}
            reduceMotion={reduceMotion}
            onClick={(e) => handleClick(e, href)}
          />
        ))}
        <MotionLink
          href="/plus"
          onClick={(e) => handleClick(e, "/plus")}
          aria-current={plusActive ? "page" : undefined}
          whileTap={reduceMotion ? undefined : { scale: 0.94 }}
          className="relative flex flex-col items-center gap-0.5 rounded-[19px] px-3 py-[7px] transition-colors"
        >
          {plusActive && <ActivePill reduceMotion={reduceMotion} />}
          {PLUS_ICON(plusActive ? "var(--accent-kcal)" : "var(--ink-3)")}
          {/* L'inbox est rangée dans « Plus » sauf si on l'a épinglée en barre. */}
          {!modulesBarreBasse.includes("/inbox") && <PastilleInbox className="right-1.5 top-0.5" />}
          <span
            className="text-[11px]"
            style={{ color: plusActive ? "var(--accent-kcal)" : "var(--ink-3)", fontWeight: plusActive ? 700 : 500 }}
          >
            Plus
          </span>
        </MotionLink>
      </nav>
    </div>
  );
}
