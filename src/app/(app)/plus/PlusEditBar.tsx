"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useNavigationEdit } from "@/lib/navigation/NavigationEditContext";

// Indicateur de sortie du mode édition (voir Phase 2.3 du rapport) : un
// appui long sur une tuile de ModulesGrid entre en mode édition (géré par
// NavigationEditProvider, via l'activationConstraint delay de dnd-kit) ;
// ce bouton, ou un tap en dehors des tuiles, en sort.
export function PlusEditBar() {
  const { isEditing, exitEditing } = useNavigationEdit();

  return (
    <AnimatePresence>
      {isEditing ? (
        <motion.button
          type="button"
          data-nav-edit-exit
          onClick={exitEditing}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative rounded-full bg-kcal px-3.5 py-1.5 text-small font-semibold text-on-kcal after:absolute after:-inset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
        >
          Terminé
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
