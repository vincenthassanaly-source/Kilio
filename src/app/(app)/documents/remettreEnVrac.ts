import { definirDocumentEnVrac } from "@/app/actions/documents-vrac";
import { showActionToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";

/**
 * « Remettre en vrac » : renvoie un document déjà classé dans l'onglet Vrac
 * pour le retrier avec Gemini. Sans confirmation (seul un drapeau change, le
 * document garde tout) : un message propose « Annuler » juste après, qui le
 * remet exactement en place. Renvoie vrai si le document est passé en vrac.
 * Un échec s'affiche en toast (contrat T1, voir lib/actions/runAction.ts).
 */
export async function remettreEnVrac(document: { id: string; nom: string }): Promise<boolean> {
  const resultat = await runAction(() => definirDocumentEnVrac(document.id, true), {
    erreur: `« ${document.nom} » n'a pas pu être remis en vrac. Réessaie.`,
  });
  if (!resultat.ok) return false;

  showActionToast(`« ${document.nom} » remis en vrac`, {
    ariaLabel: `Annuler la remise en vrac de « ${document.nom} »`,
    onAction: () => {
      void runAction(() => definirDocumentEnVrac(document.id, false), {
        erreur: `La remise en vrac de « ${document.nom} » n'a pas pu être annulée. Réessaie.`,
      });
    },
  });
  return true;
}
