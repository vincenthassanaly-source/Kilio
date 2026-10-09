"use client";

import type { CSSProperties, MouseEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { findNavItem } from "@/lib/navigation/registry";
import { useNavigationEdit } from "@/lib/navigation/NavigationEditContext";
import { PastilleInbox } from "@/components/PastilleInbox";
import { TransitionLink } from "@/components/TransitionLink";
import { card } from "@/lib/ui";

function ModuleTile({ href, isEditing }: { href: string; isEditing: boolean }) {
  const mod = findNavItem(href);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: href });

  if (!mod) return null;

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    // "none" bloquerait tout scroll vertical dès qu'un doigt touche une
    // tuile ; "manipulation" laisse le navigateur récupérer la main sur un
    // geste tenu mais quasi immobile (le cas exact d'un appui long) avant
    // que l'activation à 400ms n'ait eu la main, ce qui casse le drag une
    // fois le tremblement démarré. "pan-y" interdit tout geste horizontal
    // natif (le navigateur doit donc laisser passer ces mouvements à
    // dnd-kit) tout en laissant le scroll vertical fonctionner pour un
    // simple swipe — meilleur compromis pour un drag 2D dans une grille.
    touchAction: "pan-y",
  };

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    // En mode édition, un tap sur une tuile ne doit pas naviguer (comme
    // l'écran d'accueil iOS en mode jiggle) : seuls le drag et la sortie du
    // mode édition (bouton "Terminé" ou tap en dehors) restent actifs.
    // Le <Link> reste toujours monté (jamais remplacé par un <div>) pour ne
    // pas démonter l'élément sous le doigt en plein geste quand le
    // tremblement démarre : dnd-kit tolère un nœud qui change de props,
    // pas un qui disparaît en cours de pointerdown.
    if (isEditing) e.preventDefault();
  }

  return (
    <TransitionLink
      ref={setNodeRef}
      href={mod.href}
      onClick={handleClick}
      data-nav-edit-tile
      style={style}
      className={`${card} flex flex-col gap-2.5${isEditing ? " select-none plus-tuile-edition" : ""}`}
      {...attributes}
      {...listeners}
    >
      <span
        className="relative flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: `color-mix(in oklch, ${mod.accentVar} 12%, transparent)` }}
      >
        {mod.icon(mod.accentVar)}
        {mod.href === "/inbox" && <PastilleInbox className="-right-1.5 -top-1.5" />}
      </span>
      <div>
        <p className="font-display text-[15px] font-semibold text-ink">{mod.label}</p>
        {mod.description && <p className="text-[12.5px] text-ink-2 text-pretty">{mod.description}</p>}
      </div>
    </TransitionLink>
  );
}

export function ModulesGrid() {
  const { ordreGrillePlus, isEditing } = useNavigationEdit();
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <SortableContext items={ordreGrillePlus} strategy={rectSortingStrategy}>
      <div className="grid grid-cols-2 gap-3">
        {ordreGrillePlus.map((href, index) => (
          <motion.div
            key={href}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, delay: index * 0.03 }}
            whileTap={!isEditing && !reduceMotion ? { scale: 0.96 } : undefined}
          >
            <ModuleTile href={href} isEditing={isEditing} />
          </motion.div>
        ))}
      </div>
    </SortableContext>
  );
}
