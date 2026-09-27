"use client";

import { showActionToast } from "@/components/toast/toast-store";
import { runAction } from "./runAction";
import type { ActionResult } from "./result";

// Délai pendant lequel la suppression reste annulable : celui du toast.
const DELAI_ANNULATION_MS = 6000;

/**
 * Suppression « annulable » pour les données qu'on ne sait pas restaurer
 * côté serveur (fichier retiré du Storage, sous-tâche…) : l'élément est
 * masqué tout de suite, un toast « Annuler » s'affiche, et la Server Action
 * n'est appelée qu'à l'expiration du délai. « Annuler » ne fait donc aucun
 * appel réseau, il réaffiche simplement l'élément.
 *
 * Patron généralisé depuis Courses (constat T2 de l'audit), où la
 * restauration après coup est possible ; ici on diffère l'appel plutôt que
 * de restaurer. Limite assumée : si l'app est fermée pendant le délai, la
 * suppression n'a pas lieu (l'élément réapparaît au prochain chargement) —
 * on préfère ce sens-là à une perte de données.
 */
export function supprimerAvecAnnulation({
  texte,
  ariaLabel,
  masquer,
  restaurer,
  supprimer,
  erreur,
  onSupprime,
}: {
  texte: string;
  ariaLabel: string;
  masquer: () => void;
  restaurer: () => void;
  supprimer: () => Promise<ActionResult<unknown> | unknown>;
  erreur: string;
  onSupprime?: () => void;
}) {
  masquer();
  let annule = false;
  const timer = window.setTimeout(async () => {
    if (annule) return;
    const resultat = await runAction(supprimer, { erreur, onError: restaurer });
    if (resultat.ok) onSupprime?.();
  }, DELAI_ANNULATION_MS);

  showActionToast(texte, {
    ariaLabel,
    dureeMs: DELAI_ANNULATION_MS,
    onAction: () => {
      annule = true;
      window.clearTimeout(timer);
      restaurer();
    },
  });
}
