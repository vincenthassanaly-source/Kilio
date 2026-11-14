"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

// Anime la bascule entre le bouton "+ Ajouter" fermé (`trigger`) et le
// formulaire ouvert (`children`) des 14 écrans qui partagent ce pattern
// présentationnel. `mode="wait"` évite que les deux états se chevauchent
// (hauteurs différentes) pendant la transition. `initial={false}` empêche
// l'animation d'entrée au tout premier montage (pas de saut de layout au
// chargement de la page).
export function AnimatedAddCard({
  open,
  trigger,
  children,
}: {
  open: boolean;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.18 };
  const initial = reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 };
  const animate = { opacity: 1, scale: 1 };
  const exit = reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {open ? (
        <motion.div key="content" initial={initial} animate={animate} exit={exit} transition={transition}>
          {children}
        </motion.div>
      ) : (
        <motion.div key="trigger" initial={initial} animate={animate} exit={exit} transition={transition}>
          {trigger}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
