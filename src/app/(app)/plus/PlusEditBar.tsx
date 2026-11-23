"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigationEdit } from "@/lib/navigation/NavigationEditContext";
import { consommerParamEdition } from "./paramEdition";

// Indicateur de sortie du mode édition (voir Phase 2.3 du rapport) : un
// appui long sur une tuile de ModulesGrid entre en mode édition (géré par
// NavigationEditProvider, via l'activationConstraint delay de dnd-kit) ;
// ce bouton, ou un tap en dehors des tuiles, en sort. « Personnaliser la
// navigation » (Réglages) y entre aussi directement, via `/plus?edition=1`.
export function PlusEditBar() {
  const { isEditing, enterEditing, exitEditing } = useNavigationEdit();

  // Lu dans un effet (et non via useSearchParams) : la page reste dans la
  // coquille statique, sans frontière Suspense à ajouter.
  useEffect(() => {
    if (consommerParamEdition()) enterEditing();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule lecture, à l'arrivée sur Plus
  }, []);

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
