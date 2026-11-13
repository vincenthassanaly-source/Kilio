"use client";

import { dismissToast, showActionToast } from "@/components/toast/toast-store";
import { masquerElement, reafficherElement } from "./elementsMasques";
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
 *
 * Le minuteur vit au niveau du module (pas dans un composant) : il survit à une
 * navigation dans l'app (SPA), la suppression part donc même si la personne
 * quitte l'écran pendant le délai. Un rechargement complet ou la fermeture de
 * l'app l'annule.
 *
 * `masque` : pour une suppression qui renvoie vers une autre liste (depuis un
 * écran de détail), l'élément est aussi inscrit dans le store partagé
 * `elementsMasques`, lu par la liste, qui le cache pendant le délai.
 */
export function supprimerAvecAnnulation({
  texte,
  ariaLabel,
  masque,
  masquer: masquerLocal,
  restaurer: restaurerLocal,
  supprimer,
  erreur,
  onSupprime,
}: {
  texte: string;
  ariaLabel: string;
  masque?: { type: string; id: string };
  masquer?: () => void;
  restaurer?: () => void;
  supprimer: () => Promise<ActionResult<unknown> | unknown>;
  erreur: string;
  /** Reçoit la valeur renvoyée par `supprimer` (ex. suppression mise en file hors ligne). */
  onSupprime?: (data: unknown) => void;
}) {
  const restaurer = () => {
    if (masque) reafficherElement(masque.type, masque.id);
    restaurerLocal?.();
  };
  if (masque) masquerElement(masque.type, masque.id);
  masquerLocal?.();
  let annule = false;
  let lance = false;
  const timer = window.setTimeout(async () => {
    if (annule) return;
    lance = true;
    const resultat = await runAction(supprimer, { erreur, onError: restaurer });
    if (resultat.ok) onSupprime?.(resultat.data);
  }, DELAI_ANNULATION_MS);

  const annuler = () => {
    if (annule || lance) return;
    annule = true;
    window.clearTimeout(timer);
    restaurer();
  };

  const idToast = showActionToast(texte, {
    ariaLabel,
    dureeMs: DELAI_ANNULATION_MS,
    onAction: annuler,
  });

  return {
    /**
     * Annule la suppression par code (sans que la personne touche « Annuler ») :
     * à utiliser quand une autre action rend la suppression différée dangereuse
     * (ex. du texte vient d'être ajouté à ce qui allait être supprimé). Sans effet
     * une fois l'appel serveur parti.
     */
    annuler: () => {
      annuler();
      dismissToast(idToast);
    },
  };
}
